export const ORACLE_RULESET_VERSION = 'research-2026-oracle-v1';
export const ORACLE_CATEGORIES = Object.freeze([
  'champion', 'runnerUp', 'semifinalists', 'goldenBoot', 'goldenBall',
  'goldenGlove', 'youngPlayer', 'cinderella', 'flop', 'worstGoalDifference',
]);

// These are input budgets, not a choice of tournament size or eligible players.
const MAX_TEAMS = 256;
const MAX_PLAYERS = 8192;
const MAX_ID_LENGTH = 128;
const FINISHES = Object.freeze([
  'group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'runner_up', 'champion',
]);
const PLAYER_AWARDS = Object.freeze({ goldenBoot: 30, goldenBall: 24, goldenGlove: 20, youngPlayer: 16 });
const STAGE_FLOP_HALF_POINTS = Object.freeze({ group: 20, round_of_32: 14, round_of_16: 10, quarterfinal: 6 });
const TEAM_STATS = Object.freeze(['groupPoints', 'groupGoalsFor', 'groupGoalsAgainst', 'totalGoalsFor', 'totalGoalsAgainst']);
const has = (value, key) => Object.hasOwn(value, key);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function record(value, label, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be a plain record.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (keys && !keys.includes(key))) {
      throw new TypeError(`${label} has an unknown field.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!has(descriptor, 'value')) throw new TypeError(`${label} must contain data fields only.`);
  }
  return value;
}

function required(value, key, label) {
  if (!has(value, key)) throw new TypeError(`${label}.${key} is required.`);
  return value[key];
}

function identifier(value, label) {
  if (typeof value !== 'string' || !value || value.length > MAX_ID_LENGTH
    || value.trim() !== value || value.normalize('NFC') !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${label} must be a normalized nonempty identifier of at most 128 characters.`);
  }
  return value;
}

function list(value, label, minimum, maximum) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TypeError(`${label} must be an array within its input budget.`);
  }
  // Sparse arrays must not evade field validation through map/filter callbacks.
  for (let index = 0; index < value.length; index++) {
    if (!has(value, index)) throw new TypeError(`${label} must not contain missing entries.`);
    if (!has(Object.getOwnPropertyDescriptor(value, String(index)), 'value')) {
      throw new TypeError(`${label} must contain data entries only.`);
    }
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean.`);
  return value;
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`${label} must be a safe integer within its range.`);
  return value;
}

function choice(value, options, label) {
  if (typeof value !== 'string' || !options.includes(value)) throw new RangeError(`${label} is not a supported policy or value.`);
  return value;
}

function optionalChoice(value, key, options, label) {
  return has(value, key) ? choice(value[key], options, `${label}.${key}`) : undefined;
}

function uniqueIds(values, label, known, maximum) {
  const seen = new Set();
  return list(values, label, 0, maximum).map(value => {
    const id = identifier(value, label);
    if (!known.has(id)) throw new RangeError(`${label} contains an unknown identifier.`);
    if (seen.has(id)) throw new RangeError(`${label} contains a duplicate identifier.`);
    seen.add(id);
    return id;
  });
}

function readRuleset(value) {
  const ruleset = record(value, 'ruleset', ['id', 'version', 'status', 'policies']);
  const id = identifier(required(ruleset, 'id', 'ruleset'), 'ruleset.id');
  choice(required(ruleset, 'version', 'ruleset'), [ORACLE_RULESET_VERSION], 'ruleset.version');
  choice(required(ruleset, 'status', 'ruleset'), ['draft'], 'ruleset.status');
  const policies = has(ruleset, 'policies')
    ? record(ruleset.policies, 'ruleset.policies', ['cinderellaTies', 'flop', 'worstGoalDifference']) : {};
  const cinderellaTies = optionalChoice(policies, 'cinderellaTies', ['all', 'pending'], 'ruleset.policies');
  let flop, worstGoalDifference;
  if (has(policies, 'flop')) {
    const supplied = record(policies.flop, 'ruleset.policies.flop', ['mode', 'sameStage', 'ties']);
    flop = {
      mode: optionalChoice(supplied, 'mode', ['fixed-worst', 'stage'], 'ruleset.policies.flop'),
      sameStage: optionalChoice(supplied, 'sameStage', ['all', 'worst-only'], 'ruleset.policies.flop'),
      ties: optionalChoice(supplied, 'ties', ['all', 'pending'], 'ruleset.policies.flop'),
    };
  }
  if (has(policies, 'worstGoalDifference')) {
    const supplied = record(policies.worstGoalDifference, 'ruleset.policies.worstGoalDifference', ['scope', 'ties']);
    worstGoalDifference = {
      scope: optionalChoice(supplied, 'scope', ['group', 'tournament'], 'ruleset.policies.worstGoalDifference'),
      ties: optionalChoice(supplied, 'ties', ['all', 'pending'], 'ruleset.policies.worstGoalDifference'),
    };
  }
  return { id, cinderellaTies, flop, worstGoalDifference };
}

function readSnapshot(value) {
  const snapshot = record(value, 'snapshot', ['id', 'tournamentId', 'teams', 'players']);
  const id = identifier(required(snapshot, 'id', 'snapshot'), 'snapshot.id');
  const tournamentId = identifier(required(snapshot, 'tournamentId', 'snapshot'), 'snapshot.tournamentId');
  const teams = new Map(), players = new Map();
  for (const value of list(required(snapshot, 'teams', 'snapshot'), 'snapshot.teams', 4, MAX_TEAMS)) {
    const team = record(value, 'snapshot team', ['id', 'pot', 'fifaRank']);
    const teamId = identifier(required(team, 'id', 'snapshot team'), 'snapshot team.id');
    if (teams.has(teamId)) throw new RangeError('Snapshot team identifiers must be unique.');
    const pot = integer(required(team, 'pot', 'snapshot team'), 'snapshot team.pot', 1);
    if (pot > 4) throw new RangeError('Snapshot pots must be between one and four.');
    teams.set(teamId, { id: teamId, pot, fifaRank: integer(required(team, 'fifaRank', 'snapshot team'), 'snapshot team.fifaRank', 1) });
  }
  for (const value of list(required(snapshot, 'players', 'snapshot'), 'snapshot.players', 0, MAX_PLAYERS)) {
    const player = record(value, 'snapshot player', ['id', 'teamId']);
    const playerId = identifier(required(player, 'id', 'snapshot player'), 'snapshot player.id');
    const teamId = identifier(required(player, 'teamId', 'snapshot player'), 'snapshot player.teamId');
    if (players.has(playerId)) throw new RangeError('Snapshot player identifiers must be unique.');
    if (!teams.has(teamId)) throw new RangeError('A snapshot player must reference a known team.');
    players.set(playerId, { id: playerId, teamId });
  }
  return { id, tournamentId, teams, players };
}

function readResult(value, snapshot) {
  const result = record(value, 'result', ['id', 'tournamentId', 'snapshotId', 'verified', 'final', 'teams', 'awards']);
  const id = identifier(required(result, 'id', 'result'), 'result.id');
  const tournamentId = identifier(required(result, 'tournamentId', 'result'), 'result.tournamentId');
  const snapshotId = identifier(required(result, 'snapshotId', 'result'), 'result.snapshotId');
  if (tournamentId !== snapshot.tournamentId || snapshotId !== snapshot.id) throw new RangeError('Result and snapshot bindings must match.');
  const verified = boolean(required(result, 'verified', 'result'), 'result.verified');
  const final = boolean(required(result, 'final', 'result'), 'result.final');
  const teams = new Map();
  for (const value of list(required(result, 'teams', 'result'), 'result.teams', 0, MAX_TEAMS)) {
    const team = record(value, 'result team', ['teamId', 'finish', ...TEAM_STATS]);
    const teamId = identifier(required(team, 'teamId', 'result team'), 'result team.teamId');
    if (!snapshot.teams.has(teamId)) throw new RangeError('Result teams must belong to the snapshot.');
    if (teams.has(teamId)) throw new RangeError('Result team identifiers must be unique.');
    const row = { teamId, finish: choice(required(team, 'finish', 'result team'), FINISHES, 'result team.finish') };
    for (const key of TEAM_STATS) row[key] = integer(required(team, key, 'result team'), `result team.${key}`);
    if (row.totalGoalsFor < row.groupGoalsFor || row.totalGoalsAgainst < row.groupGoalsAgainst) {
      throw new RangeError('Tournament goal totals cannot be smaller than group totals.');
    }
    row.groupGD = row.groupGoalsFor - row.groupGoalsAgainst;
    row.totalGD = row.totalGoalsFor - row.totalGoalsAgainst;
    if (![row.groupGD, row.totalGD].every(Number.isSafeInteger)) throw new RangeError('Goal differences must remain safe integers.');
    teams.set(teamId, row);
  }
  const completeFinal = final && teams.size === snapshot.teams.size;
  if (completeFinal) {
    const rows = [...teams.values()];
    if (rows.filter(team => team.finish === 'champion').length !== 1
      || rows.filter(team => team.finish === 'runner_up').length !== 1
      || rows.filter(team => FINISHES.indexOf(team.finish) >= 4).length !== 4) {
      throw new RangeError('Complete final results need one champion, one runner-up and four inclusive semifinalists.');
    }
  }
  const supplied = has(result, 'awards') ? record(result.awards, 'result.awards', Object.keys(PLAYER_AWARDS)) : {};
  const awards = new Map();
  for (const category of Object.keys(PLAYER_AWARDS)) {
    if (!has(supplied, category)) continue;
    const award = record(supplied[category], `result.awards.${category}`, ['verified', 'winnerIds']);
    awards.set(category, {
      verified: boolean(required(award, 'verified', `result.awards.${category}`), `result.awards.${category}.verified`),
      winnerIds: uniqueIds(required(award, 'winnerIds', `result.awards.${category}`), `${category}.winnerIds`, snapshot.players, MAX_PLAYERS),
    });
  }
  return { id, verified, completeFinal, teams, awards };
}

const waiting = (category, status, reason) => ({ category, status, awards: [], reason });
const pending = (category, reason) => waiting(category, 'pending', reason);
const policyRequired = (category, reason) => waiting(category, 'policy_required', reason);
function settled(category, awards) {
  return {
    category, status: 'settled',
    awards: awards.map(award => ({ id: award.id, halfPoints: award.halfPoints })).sort((a, b) => compare(a.id, b.id)),
    reason: null,
  };
}

// Compare only rule criteria. Identifier ordering is applied later for display.
function extremes(rows, comparator) {
  let winners = [];
  for (const row of rows) {
    const order = winners.length ? comparator(row, winners[0]) : -1;
    if (order < 0) winners = [row];
    else if (order === 0) winners.push(row);
  }
  return winners;
}

function awardTeams(category, winners, halfPoints, ties) {
  if (!winners.length) return pending(category, 'The recorded snapshot has no eligible team for this category.');
  if (winners.length > 1 && ties !== 'all') return policyRequired(category, 'An exact tie needs an explicit all-winners policy.');
  return settled(category, winners.map(team => ({ id: team.teamId, halfPoints })));
}

const worstGroup = (a, b) => compare(a.groupPoints, b.groupPoints) || compare(a.groupGD, b.groupGD) || compare(a.groupGoalsFor, b.groupGoalsFor);

function resolveTeamCategory(category, ruleset, snapshot, result) {
  const rows = [...result.teams.values()];
  if (category === 'champion' || category === 'runnerUp') {
    const finish = category === 'champion' ? 'champion' : 'runner_up';
    return settled(category, rows.filter(team => team.finish === finish).map(team => ({ id: team.teamId, halfPoints: category === 'champion' ? 40 : 24 })));
  }
  if (category === 'semifinalists') {
    return settled(category, rows.filter(team => FINISHES.indexOf(team.finish) >= 4).map(team => ({ id: team.teamId, halfPoints: 2 })));
  }
  if (category === 'cinderella') {
    if (!ruleset.cinderellaTies) return policyRequired(category, 'A Cinderella tie policy is required.');
    const eligible = rows.filter(team => snapshot.teams.get(team.teamId).pot === 4);
    const winners = extremes(eligible, (a, b) => compare(FINISHES.indexOf(b.finish), FINISHES.indexOf(a.finish))
      || compare(b.groupPoints, a.groupPoints) || compare(b.totalGD, a.totalGD)
      || compare(b.totalGoalsFor, a.totalGoalsFor)
      || compare(snapshot.teams.get(b.teamId).fifaRank, snapshot.teams.get(a.teamId).fifaRank));
    return awardTeams(category, winners, 20, ruleset.cinderellaTies);
  }
  if (category === 'worstGoalDifference') {
    const policy = ruleset.worstGoalDifference;
    if (!policy?.scope || !policy.ties) return policyRequired(category, 'Worst goal difference requires an explicit scope and tie policy.');
    const key = policy.scope === 'group' ? 'groupGD' : 'totalGD';
    return awardTeams(category, extremes(rows, (a, b) => compare(a[key], b[key])), 16, policy.ties);
  }
  const policy = ruleset.flop;
  if (!policy?.mode || !policy.ties || (policy.mode === 'stage' && !policy.sameStage)) {
    return policyRequired(category, 'Pufo needs a mode, tie policy and an explicit same-stage allocation in stage mode.');
  }
  const eligible = rows.filter(team => snapshot.teams.get(team.teamId).pot === 1);
  if (!eligible.length) return pending(category, 'The recorded snapshot has no pot-one team.');
  if (policy.mode === 'fixed-worst') {
    return awardTeams(category, extremes(eligible, (a, b) => compare(FINISHES.indexOf(a.finish), FINISHES.indexOf(b.finish)) || worstGroup(a, b)), 20, policy.ties);
  }
  const awards = [];
  for (const [finish, halfPoints] of Object.entries(STAGE_FLOP_HALF_POINTS)) {
    const stageTeams = eligible.filter(team => team.finish === finish);
    const winners = policy.sameStage === 'all' ? stageTeams : extremes(stageTeams, worstGroup);
    if (policy.sameStage === 'worst-only' && winners.length > 1 && policy.ties !== 'all') {
      return policyRequired(category, 'An exact same-stage Pufo tie needs an explicit all-winners policy.');
    }
    awards.push(...winners.map(team => ({ id: team.teamId, halfPoints })));
  }
  // Later-stage pot-one teams receive no award, hence a settled zero if picked.
  return settled(category, awards);
}

/**
 * Evaluate supplied records under draft rules only. Verified flags are inputs,
 * not independently checked authority. No tournament is selected or activated.
 */
export function resolveOracleOutcomes(input) {
  const value = record(input, 'Oracle input', ['ruleset', 'snapshot', 'result', 'revision']);
  const ruleset = readRuleset(required(value, 'ruleset', 'Oracle input'));
  const snapshot = readSnapshot(required(value, 'snapshot', 'Oracle input'));
  const result = readResult(required(value, 'result', 'Oracle input'), snapshot);
  const categories = ORACLE_CATEGORIES.map(category => {
    if (!result.verified) return pending(category, 'The supplied result revision is not verified.');
    if (has(PLAYER_AWARDS, category)) {
      const award = result.awards.get(category);
      if (!award?.verified || !award.winnerIds.length) return pending(category, 'A verified official award resolution with winners is required.');
      return settled(category, award.winnerIds.map(id => ({ id, halfPoints: PLAYER_AWARDS[category] })));
    }
    if (!result.completeFinal) return pending(category, 'Final results for every snapshot team are required.');
    return resolveTeamCategory(category, ruleset, snapshot, result);
  });
  return {
    tournamentId: snapshot.tournamentId, snapshotId: snapshot.id,
    rulesetId: ruleset.id, rulesetVersion: ORACLE_RULESET_VERSION,
    resultRevisionId: result.id, complete: categories.every(category => category.status === 'settled'), categories,
  };
}

function readRevision(value, snapshot, rulesetId) {
  const revision = record(value, 'revision', ['id', 'tournamentId', 'snapshotId', 'rulesetId', 'picks']);
  const id = identifier(required(revision, 'id', 'revision'), 'revision.id');
  const tournamentId = identifier(required(revision, 'tournamentId', 'revision'), 'revision.tournamentId');
  const snapshotId = identifier(required(revision, 'snapshotId', 'revision'), 'revision.snapshotId');
  const suppliedRulesetId = identifier(required(revision, 'rulesetId', 'revision'), 'revision.rulesetId');
  if (tournamentId !== snapshot.tournamentId || snapshotId !== snapshot.id || suppliedRulesetId !== rulesetId) {
    throw new RangeError('Pick revision, ruleset and snapshot bindings must match.');
  }
  const supplied = record(required(revision, 'picks', 'revision'), 'revision.picks', ORACLE_CATEGORIES);
  const picks = {};
  for (const category of ORACLE_CATEGORIES) {
    if (!has(supplied, category) || supplied[category] === null) {
      picks[category] = [];
      continue;
    }
    if (category === 'semifinalists') {
      picks[category] = uniqueIds(supplied[category], 'revision.picks.semifinalists', snapshot.teams, 4);
      continue;
    }
    const selected = identifier(supplied[category], `revision.picks.${category}`);
    const known = has(PLAYER_AWARDS, category) ? snapshot.players : snapshot.teams;
    if (!known.has(selected)) throw new RangeError(`revision.picks.${category} references an unknown identity of that kind.`);
    if (category === 'cinderella' && snapshot.teams.get(selected).pot !== 4) throw new RangeError('A Cinderella pick must belong to pot four.');
    if (category === 'flop' && snapshot.teams.get(selected).pot !== 1) throw new RangeError('A Pufo pick must belong to pot one.');
    picks[category] = [selected];
  }
  if (picks.champion.length && picks.champion[0] === picks.runnerUp[0]) throw new RangeError('Champion and runner-up picks cannot name the same team.');
  return { id, picks };
}

/** Score this revision against this result; do not append prior derived totals. */
export function scoreOraclePrediction(input) {
  const outcome = resolveOracleOutcomes(input);
  const snapshot = readSnapshot(input.snapshot);
  const revision = readRevision(required(input, 'revision', 'Oracle input'), snapshot, outcome.rulesetId);
  const categories = outcome.categories.map(row => {
    const matched = row.awards.filter(award => revision.picks[row.category].includes(award.id));
    return {
      category: row.category, status: row.status,
      halfPoints: row.status === 'settled' ? matched.reduce((total, award) => total + award.halfPoints, 0) : null,
      matchedIds: matched.map(award => award.id), reason: row.reason,
    };
  });
  const settledHalfPoints = categories.reduce((total, row) => total + (row.halfPoints ?? 0), 0);
  return { ...outcome, pickRevisionId: revision.id, settledHalfPoints, totalHalfPoints: outcome.complete ? settledHalfPoints : null, categories };
}
