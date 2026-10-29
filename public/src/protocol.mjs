// Wire identifiers only; scoring and authorization remain server-owned.
export const ORACLE_CATEGORY_IDS = Object.freeze([
  'champion', 'runnerUp', 'semifinalists', 'goldenBoot', 'goldenBall',
  'goldenGlove', 'youngPlayer', 'cinderella', 'flop', 'worstGoalDifference',
]);
export const RANKING_FILTERS = Object.freeze(['overall', 'matchday', 'group_stage', 'knockout', 'oracle']);
const MUTATIONS = new Set(['createGroup', 'redeemInvitation', 'createInvitation', 'revokeInvitation', 'leaveGroup', 'savePrediction', 'saveOracle']);

export class ProtocolError extends Error {
  constructor(code = 'protocol_invalid') {
    const safe = code === 'invalid_request' ? code : 'protocol_invalid';
    super(safe); this.name = 'ProtocolError'; this.code = safe;
  }
}
const fail = () => { throw new ProtocolError(); };

function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) fail();
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
  }
  return value;
}
function array(value, maximum = 10000) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) fail();
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
  }
  return value;
}
function text(value, maximum = 200, nonblank = true) {
  if (typeof value !== 'string' || value.length > maximum || (nonblank && !value.trim()) || value.includes('\0')) fail();
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index); if (!(next >= 0xdc00 && next <= 0xdfff)) fail();
    } else if (code >= 0xdc00 && code <= 0xdfff) fail();
  }
  return value;
}
export function validateId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail();
  return value;
}
export function validateCsrfToken(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(value)) fail();
  return value;
}
function invitationCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(value)) fail();
  return value;
}
function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail();
  return value;
}
function boolean(value) { if (typeof value !== 'boolean') fail(); return value; }
function choice(value, choices) { if (!choices.includes(value)) fail(); return value; }
function nullable(value, parse) { return value === null ? null : parse(value); }
function iso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) fail();
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction) => `.${(fraction ?? '').padEnd(3, '0')}Z`)) fail();
  return value;
}
function ids(value, maximum = 10000) {
  const result = array(value, maximum).map(validateId);
  if (new Set(result).size !== result.length) fail();
  return result;
}
function unique(values, field) { if (new Set(values.map(value => value[field])).size !== values.length) fail(); return values; }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function group(value) {
  const input = record(value, ['id', 'name', 'role', 'memberCount', 'tournamentId', 'permissions']);
  const permissions = record(input.permissions, ['canInvite', 'canLeave']);
  return { id: validateId(input.id), name: text(input.name), role: choice(input.role, ['owner', 'member']), memberCount: integer(input.memberCount),
    tournamentId: nullable(input.tournamentId, validateId), permissions: { canInvite: boolean(permissions.canInvite), canLeave: boolean(permissions.canLeave) } };
}
function member(value) {
  const input = record(value, ['id', 'displayName', 'joinedAt']);
  return { id: validateId(input.id), displayName: text(input.displayName), joinedAt: iso(input.joinedAt) };
}
function invitation(value, receipt = false) {
  const input = record(value, ['id', 'code', 'expiresAt', 'usesRemaining', 'revoked']);
  if (!receipt && input.code !== null) fail();
  return { id: validateId(input.id), code: receipt ? invitationCode(input.code) : null,
    expiresAt: iso(input.expiresAt), usesRemaining: integer(input.usesRemaining), revoked: boolean(input.revoked) };
}
function context(value, groupId) {
  const input = record(value, ['groupId', 'tournamentId', 'name', 'mode', 'rulesetVersionId', 'rulesState', 'rules', 'pendingPolicies']);
  if (groupId !== undefined && input.groupId !== groupId) fail();
  return { groupId: validateId(input.groupId), tournamentId: validateId(input.tournamentId), name: text(input.name),
    mode: choice(input.mode, ['live', 'archive', 'replay']), rulesetVersionId: validateId(input.rulesetVersionId), rulesState: choice(input.rulesState, ['draft', 'active']),
    rules: array(input.rules, 128).map(value => { const row = record(value, ['label', 'description']); return { label: text(row.label), description: text(row.description, 2000, false) }; }),
    pendingPolicies: array(input.pendingPolicies, 128).map(value => text(value, 500)) };
}
function team(value) { const input = record(value, ['id', 'name']); return { id: validateId(input.id), name: text(input.name) }; }
function prediction(value, match) {
  const input = record(value, ['revisionId', 'homeGoals', 'awayGoals', 'qualifierId', 'updatedAt']);
  const qualifierId = nullable(input.qualifierId, validateId);
  if (qualifierId !== null && match && (match.qualifierLabel === null || ![match.home.id, match.away.id].includes(qualifierId))) fail();
  return { revisionId: validateId(input.revisionId), homeGoals: integer(input.homeGoals, 0, 99), awayGoals: integer(input.awayGoals, 0, 99), qualifierId, updatedAt: iso(input.updatedAt) };
}
export function parseMatch(value) {
  const input = record(value, ['id', 'kind', 'roundLabel', 'matchdayLabel', 'home', 'away', 'kickoffAt', 'cutoffAt', 'revealAt', 'status',
    'canEdit', 'editReason', 'qualifierLabel', 'qualifierRequired', 'ownPrediction', 'pickVisibility', 'otherPredictions', 'historyVisibility']);
  const result = { id: validateId(input.id), kind: choice(input.kind, ['group', 'knockout']), roundLabel: text(input.roundLabel), matchdayLabel: text(input.matchdayLabel),
    home: team(input.home), away: team(input.away), kickoffAt: nullable(input.kickoffAt, iso), cutoffAt: nullable(input.cutoffAt, iso), revealAt: nullable(input.revealAt, iso),
    status: choice(input.status, ['scheduled', 'live', 'finished', 'postponed']), canEdit: boolean(input.canEdit), editReason: nullable(input.editReason, value => text(value, 500)),
    qualifierLabel: nullable(input.qualifierLabel, value => text(value)), qualifierRequired: boolean(input.qualifierRequired), ownPrediction: null, pickVisibility: choice(input.pickVisibility, ['hidden', 'visible']),
    otherPredictions: null, historyVisibility: choice(input.historyVisibility, ['hidden', 'visible']) };
  if (result.home.id === result.away.id || (result.kind === 'group' && result.qualifierLabel !== null)
    || (result.qualifierLabel === null && result.qualifierRequired)) fail();
  result.ownPrediction = nullable(input.ownPrediction, value => prediction(value, result));
  if (result.pickVisibility === 'hidden') { if (input.otherPredictions !== null) fail(); }
  else result.otherPredictions = unique(array(input.otherPredictions).map(value => {
    const row = record(value, ['memberId', 'displayName', 'prediction']);
    return { memberId: validateId(row.memberId), displayName: text(row.displayName), prediction: prediction(row.prediction, result) };
  }), 'memberId');
  return result;
}
function history(value, scope) {
  const input = record(value, ['groupId', 'matchId', 'visibility', 'revisions']);
  if (input.groupId !== scope.groupId || input.matchId !== scope.matchId) fail();
  const revisions = unique(array(input.revisions).map(value => {
    const row = record(value, ['id', 'memberId', 'displayName', 'createdAt', 'homeGoals', 'awayGoals', 'qualifierId', 'reason']);
    const qualifierId = nullable(row.qualifierId, validateId);
    if (qualifierId !== null && (scope.match.qualifierLabel === null || ![scope.match.home.id, scope.match.away.id].includes(qualifierId))) fail();
    return { id: validateId(row.id), memberId: validateId(row.memberId), displayName: text(row.displayName), createdAt: iso(row.createdAt),
      homeGoals: integer(row.homeGoals, 0, 99), awayGoals: integer(row.awayGoals, 0, 99), qualifierId, reason: nullable(row.reason, value => text(value, 500)) };
  }), 'id');
  const visibility = choice(input.visibility, ['hidden', 'visible']);
  if (visibility === 'hidden' && revisions.length) fail();
  return { groupId: validateId(input.groupId), matchId: validateId(input.matchId), visibility, revisions };
}
function selections(value, category, complete) {
  const selected = ids(value, category.maxSelections);
  if ((complete && selected.length < category.minSelections) || selected.some(id => !category.options.some(option => option.id === id))) fail();
  return selected;
}
function picks(value, categories, complete) {
  const input = record(value, ORACLE_CATEGORY_IDS);
  return Object.fromEntries(ORACLE_CATEGORY_IDS.map(id => [id, selections(input[id], categories.find(category => category.id === id), complete)]));
}
export function parseOracle(value) {
  const input = record(value, ['revisionId', 'canEdit', 'editReason', 'cutoffAt', 'pickVisibility', 'rankingVisibility', 'categories', 'otherPicks']);
  const categories = unique(array(input.categories, 10).map(value => {
    const row = record(value, ['id', 'label', 'description', 'pointsUnits', 'minSelections', 'maxSelections', 'options', 'selectedIds']);
    const options = unique(array(row.options, 8192).map(value => {
      const option = record(value, ['id', 'label', 'description']);
      return { id: validateId(option.id), label: text(option.label), description: text(option.description, 2000, false) };
    }), 'id');
    const result = { id: choice(row.id, ORACLE_CATEGORY_IDS), label: text(row.label), description: text(row.description, 2000, false),
      pointsUnits: integer(row.pointsUnits, Number.MIN_SAFE_INTEGER), minSelections: integer(row.minSelections, 0, options.length),
      maxSelections: integer(row.maxSelections, 0, options.length), options, selectedIds: [] };
    if (result.minSelections > result.maxSelections) fail();
    result.selectedIds = selections(row.selectedIds, result, false);
    return result;
  }), 'id');
  if (categories.length !== ORACLE_CATEGORY_IDS.length) fail();
  const pickVisibility = choice(input.pickVisibility, ['hidden', 'visible']);
  let otherPicks = null;
  if (pickVisibility === 'hidden') { if (input.otherPicks !== null) fail(); }
  else otherPicks = unique(array(input.otherPicks).map(value => {
    const row = record(value, ['memberId', 'displayName', 'picks']);
    return { memberId: validateId(row.memberId), displayName: text(row.displayName), picks: picks(row.picks, categories, false) };
  }), 'memberId');
  return { revisionId: nullable(input.revisionId, validateId), canEdit: boolean(input.canEdit), editReason: nullable(input.editReason, value => text(value, 500)),
    cutoffAt: nullable(input.cutoffAt, iso), pickVisibility, rankingVisibility: choice(input.rankingVisibility, ['hidden', 'visible']), categories, otherPicks };
}
function exactHitRanking(value, filter, visibility, pointRows) {
  if (filter === 'oracle') fail();
  const input = record(value, ['computedAt', 'rows']);
  const rows = unique(array(input.rows).map(value => {
    const row = record(value, ['memberId', 'displayName', 'rank', 'exactHitCount', 'settledMatchCount']);
    const settledMatchCount = integer(row.settledMatchCount);
    return { memberId: validateId(row.memberId), displayName: text(row.displayName), rank: integer(row.rank, 1),
      exactHitCount: integer(row.exactHitCount, 0, settledMatchCount), settledMatchCount };
  }), 'memberId');
  if (visibility === 'hidden' && rows.length) fail();
  if (visibility === 'visible') {
    const members = new Map(pointRows.map(row => [row.memberId, row.displayName]));
    if (rows.length !== pointRows.length || rows.some(row => members.get(row.memberId) !== row.displayName)) fail();
  }
  return { computedAt: nullable(input.computedAt, iso), rows };
}
function rankings(value, filter) {
  const hasExactHitRanking = value !== null && typeof value === 'object' && Object.hasOwn(value, 'exactHitRanking');
  const input = record(value, ['filter', 'availableFilters', 'visibility', 'computedAt', 'rows', ...(hasExactHitRanking ? ['exactHitRanking'] : [])]);
  if (input.filter !== filter) fail();
  const availableFilters = array(input.availableFilters, RANKING_FILTERS.length).map(value => choice(value, RANKING_FILTERS));
  if (new Set(availableFilters).size !== availableFilters.length || !availableFilters.includes(input.filter)) fail();
  const visibility = choice(input.visibility, ['hidden', 'visible']);
  const rows = unique(array(input.rows).map(value => {
    const row = record(value, ['memberId', 'displayName', 'rank', 'pointsUnits', 'settledCount', 'pendingCount']);
    return { memberId: validateId(row.memberId), displayName: text(row.displayName), rank: integer(row.rank, 1), pointsUnits: integer(row.pointsUnits, Number.MIN_SAFE_INTEGER),
      settledCount: integer(row.settledCount), pendingCount: integer(row.pendingCount) };
  }), 'memberId');
  if (visibility === 'hidden' && rows.length) fail();
  const result = { filter: choice(input.filter, RANKING_FILTERS), availableFilters, visibility, computedAt: nullable(input.computedAt, iso), rows };
  if (hasExactHitRanking) result.exactHitRanking = nullable(input.exactHitRanking, value => exactHitRanking(value, filter, visibility, rows));
  return result;
}
function session(value) {
  if (!value || typeof value !== 'object') fail();
  const state = Object.getOwnPropertyDescriptor(value, 'state');
  if (!state || !Object.hasOwn(state, 'value')) fail();
  if (state.value === 'unavailable') { record(value, ['state']); return { state: 'unavailable' }; }
  if (state.value === 'anonymous') {
    const input = record(value, ['state', 'loginPath']);
    const loginPath = text(input.loginPath, 1024);
    if (!loginPath.startsWith('/auth/') || loginPath.includes('#') || /[\\\u0000-\u0020\u007f]/.test(loginPath)) fail();
    const url = new URL(loginPath, 'https://same-origin.invalid');
    if (url.origin !== 'https://same-origin.invalid' || url.username || url.password || url.hash || !url.pathname.startsWith('/auth/')) fail();
    return { state: 'anonymous', loginPath };
  }
  const input = record(value, ['state', 'user', 'csrfToken']);
  if (input.state !== 'member') fail();
  const user = record(input.user, ['id', 'displayName']);
  return { state: 'member', user: { id: validateId(user.id), displayName: text(user.displayName) }, csrfToken: validateCsrfToken(input.csrfToken) };
}

/** Parse and detach the entire producer envelope; nothing is repaired or coerced. */
export function parseEnvelope(operation, value, scope = {}) {
  const mutation = MUTATIONS.has(operation);
  const input = record(value, ['data', 'serverTime', 'viewerId', ...(mutation ? ['replayed'] : [])]);
  let data;
  if (operation === 'session') data = session(input.data);
  else if (operation === 'groups') { const row = record(input.data, ['groups']); data = { groups: unique(array(row.groups).map(group), 'id') }; }
  else if (operation === 'group') {
    const row = record(input.data, ['group', 'members', 'invitations']);
    data = { group: group(row.group), members: unique(array(row.members).map(member), 'id'), invitations: unique(array(row.invitations).map(value => invitation(value)), 'id') };
    if (data.group.id !== scope.groupId) fail();
  } else if (operation === 'tournament') {
    const row = record(input.data, ['context']); data = { context: nullable(row.context, value => context(value, scope.groupId)) };
  } else if (operation === 'matches') {
    const row = record(input.data, ['context', 'matches']); data = { context: context(row.context, scope.groupId), matches: unique(array(row.matches, 2048).map(parseMatch), 'id') };
  } else if (operation === 'history') data = history(input.data, scope);
  else if (operation === 'oracle') {
    const row = record(input.data, ['context', 'oracle']); data = { context: context(row.context, scope.groupId), oracle: parseOracle(row.oracle) };
  } else if (operation === 'rankings') {
    const row = record(input.data, ['context', 'rankings']); data = { context: context(row.context, scope.groupId), rankings: rankings(row.rankings, scope.filter) };
  } else if (operation === 'createGroup' || operation === 'redeemInvitation') { const row = record(input.data, ['group']); data = { group: group(row.group) }; }
  else if (operation === 'createInvitation') { const row = record(input.data, ['invitation']); data = { invitation: invitation(row.invitation, true) }; }
  else if (operation === 'revokeInvitation' || operation === 'leaveGroup') {
    const key = operation === 'leaveGroup' ? 'left' : 'revoked'; const row = record(input.data, [key]);
    if (row[key] !== true) fail(); data = { [key]: true };
  } else if (operation === 'savePrediction') {
    const row = record(input.data, ['groupId', 'matchId', 'prediction']);
    if (row.groupId !== scope.groupId || row.matchId !== scope.matchId) fail();
    data = { groupId: validateId(row.groupId), matchId: validateId(row.matchId), prediction: prediction(row.prediction, scope.match) };
  } else if (operation === 'saveOracle') {
    const row = record(input.data, ['groupId', 'revisionId']); if (row.groupId !== scope.groupId) fail();
    data = { groupId: validateId(row.groupId), revisionId: validateId(row.revisionId) };
  } else fail();
  const viewerId = operation === 'session' && data.state !== 'member' ? (input.viewerId === null ? null : fail()) : validateId(input.viewerId);
  if (operation === 'session' && data.state === 'member' && viewerId !== data.user.id) fail();
  return freeze({ data, serverTime: iso(input.serverTime), viewerId, ...(mutation ? { replayed: boolean(input.replayed) } : {}) });
}

/** Resource checks are input validation, never permission, deadline or score decisions. */
export function serializeMutation(operation, value, resource) {
  try {
    const keys = ['mutationId', ...(operation === 'createGroup' ? ['name'] : operation === 'redeemInvitation' ? ['code']
      : operation === 'savePrediction' ? ['baseRevisionId', 'homeGoals', 'awayGoals', 'qualifierId'] : operation === 'saveOracle' ? ['baseRevisionId', 'picks'] : [])];
    const input = record(value, keys);
    if (typeof input.mutationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.mutationId)) fail();
    const result = { mutationId: input.mutationId };
    if (operation === 'createGroup') result.name = text(input.name);
    else if (operation === 'redeemInvitation') result.code = invitationCode(input.code);
    else if (operation === 'savePrediction') {
      const match = parseMatch(resource), qualifierId = nullable(input.qualifierId, validateId);
      if ((match.qualifierLabel === null && qualifierId !== null) || (match.qualifierRequired && qualifierId === null)
        || (qualifierId !== null && ![match.home.id, match.away.id].includes(qualifierId))) fail();
      Object.assign(result, { baseRevisionId: nullable(input.baseRevisionId, validateId), homeGoals: integer(input.homeGoals, 0, 99), awayGoals: integer(input.awayGoals, 0, 99), qualifierId });
    } else if (operation === 'saveOracle') {
      const oracle = parseOracle(resource);
      Object.assign(result, { baseRevisionId: nullable(input.baseRevisionId, validateId), picks: picks(input.picks, oracle.categories, true) });
    } else if (!MUTATIONS.has(operation)) fail();
    return freeze(result);
  } catch { throw new ProtocolError('invalid_request'); }
}
