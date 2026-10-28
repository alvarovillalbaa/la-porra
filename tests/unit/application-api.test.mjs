import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../../public/src/api.mjs';
import { ORACLE_CATEGORY_IDS } from '../../public/src/protocol.mjs';

// Authored T2 fetch-stub cases only. No server, database, real session or browser.
const time = '2026-10-28T12:00:00.000Z';
const mutationId = '01b879a9-c6bd-4b7c-8f69-d862e999275f';
const token = 'c'.repeat(32);
const clone = value => structuredClone(value);
const group = () => ({ id: 'group', name: 'Amistades', role: 'owner', memberCount: 1, tournamentId: 'tournament', permissions: { canInvite: true, canLeave: false } });
const context = () => ({ groupId: 'group', tournamentId: 'tournament', name: 'Torneo de prueba', mode: 'replay', rulesetVersionId: 'fixture_rules', rulesState: 'active', rules: [{ label: 'Regla de prueba', description: 'Datos escritos para este caso.' }], pendingPolicies: [] });
const prediction = () => ({ revisionId: 'revision', homeGoals: 2, awayGoals: 1, qualifierId: 'home', updatedAt: time });
const match = () => ({ id: 'match', kind: 'knockout', roundLabel: 'Ronda de prueba', matchdayLabel: 'Jornada 1', home: { id: 'home', name: 'Local' }, away: { id: 'away', name: 'Visitante' },
  kickoffAt: time, cutoffAt: time, revealAt: time, status: 'scheduled', canEdit: false, editReason: 'Permiso decidido por el servidor', qualifierLabel: 'Equipo que se clasifica', qualifierRequired: true,
  ownPrediction: null, pickVisibility: 'hidden', otherPredictions: null, historyVisibility: 'hidden' });
const oracle = () => ({ revisionId: null, canEdit: false, editReason: 'Permiso del servidor', cutoffAt: null, pickVisibility: 'hidden', rankingVisibility: 'hidden',
  categories: ORACLE_CATEGORY_IDS.map(id => ({ id, label: id, description: 'Categoría de prueba', pointsUnits: 20, minSelections: 1, maxSelections: id === 'semifinalists' ? 2 : 1,
    options: [{ id: 'option_a', label: 'Opción A', description: '' }, { id: 'option_b', label: 'Opción B', description: '' }], selectedIds: [] })), otherPicks: null });
const picks = () => Object.fromEntries(ORACLE_CATEGORY_IDS.map(id => [id, ['option_a']]));
const ranking = () => ({ filter: 'overall', availableFilters: ['overall', 'oracle'], visibility: 'hidden', computedAt: null, rows: [] });
const envelope = (data, mutation = false) => ({ data, serverTime: time, viewerId: 'member', ...(mutation ? { replayed: false } : {}) });
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const apiFor = data => createApi({ fetch: async () => response(data) });
const rejected = (operation, code, status = 0) => assert.rejects(operation, error => { assert.ok(error instanceof ApiError); assert.equal(error.code, code); assert.equal(error.status, status); return true; });

test('session reads return the entire validated envelope with same-origin transport flags', async () => {
  let call;
  const data = envelope({ state: 'member', user: { id: 'member', displayName: 'Álvaro' }, csrfToken: token });
  const api = createApi({ fetch: async (path, options) => { call = { path, options }; return response(data); } });
  assert.deepEqual(await api.session(), data);
  assert.equal(call.path, '/api/session'); assert.equal(call.options.credentials, 'same-origin');
  assert.equal(call.options.redirect, 'error'); assert.equal(call.options.cache, 'no-store');
  assert.equal(call.options.method, 'GET'); assert.equal(call.options.body, undefined);
  assert.equal(Object.hasOwn(call.options.headers, 'Authorization'), false);
});

test('session identity and login-path discriminants never fabricate a member', async () => {
  for (const data of [
    { ...envelope({ state: 'member', user: { id: 'other', displayName: 'Otra persona' }, csrfToken: token }) },
    envelope({ state: 'anonymous', loginPath: '/auth/login' }),
    { ...envelope({ state: 'anonymous', loginPath: 'https://external.invalid/auth/login' }), viewerId: null },
    { ...envelope({ state: 'anonymous', loginPath: '/auth/login#' }), viewerId: null },
  ]) await rejected(apiFor(data).session(), 'protocol_invalid');
  assert.deepEqual((await apiFor({ data: { state: 'unavailable' }, viewerId: null, serverTime: time }).session()).data, { state: 'unavailable' });
  assert.equal((await apiFor({ data: { state: 'anonymous', loginPath: '/auth/login' }, viewerId: null, serverTime: time }).session()).data.loginPath, '/auth/login');
});

test('groups require every explicit permission and reject coercion or private anonymous envelopes', async () => {
  assert.deepEqual((await apiFor(envelope({ groups: [group()] })).groups()).data.groups, [group()]);
  const missing = group(); delete missing.permissions.canLeave;
  await rejected(apiFor(envelope({ groups: [missing] })).groups(), 'protocol_invalid');
  const coerced = group(); coerced.permissions.canInvite = 'true';
  await rejected(apiFor(envelope({ groups: [coerced] })).groups(), 'protocol_invalid');
  await rejected(apiFor({ ...envelope({ groups: [] }), viewerId: null }).groups(), 'protocol_invalid');
});

test('group reads enforce requested scope and keep invitation codes out of listings', async () => {
  const data = { group: group(), members: [{ id: 'member', displayName: 'Persona', joinedAt: time }], invitations: [{ id: 'invite', code: null, expiresAt: time, usesRemaining: 1, revoked: false }] };
  assert.deepEqual((await apiFor(envelope(data)).group('group')).data, data);
  await rejected(apiFor(envelope(data)).group('other_group'), 'protocol_invalid');
  const leaked = clone(data); leaked.invitations[0].code = 'private_code_123456789';
  await rejected(apiFor(envelope(leaked)).group('group'), 'protocol_invalid');
});

test('tournament context stays explicit and cannot cross groups or default a missing tournament', async () => {
  assert.equal((await apiFor(envelope({ context: null })).tournament('group')).data.context, null);
  assert.deepEqual((await apiFor(envelope({ context: context() })).tournament('group')).data.context, context());
  await rejected(apiFor(envelope({ context: context() })).tournament('other_group'), 'protocol_invalid');
  const incomplete = context(); delete incomplete.rulesState;
  await rejected(apiFor(envelope({ context: incomplete })).tournament('group'), 'protocol_invalid');
});

test('match visibility rejects leaked hidden picks and visible-null producer fallbacks', async () => {
  const hidden = match(); hidden.otherPredictions = [{ memberId: 'other', displayName: 'Otra', prediction: prediction() }];
  await rejected(apiFor(envelope({ context: context(), matches: [hidden] })).matches('group'), 'protocol_invalid');
  const visible = match(); visible.pickVisibility = 'visible';
  await rejected(apiFor(envelope({ context: context(), matches: [visible] })).matches('group'), 'protocol_invalid');
  visible.otherPredictions = [];
  assert.deepEqual((await apiFor(envelope({ context: context(), matches: [visible] })).matches('group')).data.matches[0].otherPredictions, []);
});

test('match predictions validate bounded goals and qualifier team identity without scoring', async () => {
  const value = match(); value.ownPrediction = prediction();
  const good = envelope({ context: context(), matches: [value] });
  assert.equal((await apiFor(good).matches('group')).data.matches[0].canEdit, false);
  for (const alter of [row => { row.ownPrediction.homeGoals = '2'; }, row => { row.ownPrediction.qualifierId = 'unknown_team'; }, row => { row.kind = 'group'; row.qualifierRequired = false; },
    row => { row.qualifierLabel = null; }, row => { row.qualifierLabel = null; row.qualifierRequired = false; }, row => { delete row.qualifierLabel; }]) {
    const invalid = clone(value); alter(invalid);
    await rejected(apiFor(envelope({ context: context(), matches: [invalid] })).matches('group'), 'protocol_invalid');
  }
  const withoutBonus = match(); withoutBonus.qualifierLabel = null; withoutBonus.qualifierRequired = false;
  assert.equal((await apiFor(envelope({ context: context(), matches: [withoutBonus] })).matches('group')).data.matches[0].qualifierLabel, null);
});

test('history requires its current match and enforces scope, hidden emptiness and qualifier options', async () => {
  const row = { id: 'revision', memberId: 'member', displayName: 'Persona', createdAt: time, homeGoals: 2, awayGoals: 1, qualifierId: 'home', reason: null };
  const data = { groupId: 'group', matchId: 'match', visibility: 'hidden', revisions: [] };
  await rejected(apiFor(envelope(data)).history('group', 'match'), 'context_required');
  assert.deepEqual((await apiFor(envelope(data)).history('group', 'match', { match: match() })).data, data);
  for (const altered of [{ ...data, revisions: [row] }, { ...data, matchId: 'other' }, { ...data, visibility: 'visible', revisions: [{ ...row, qualifierId: 'unknown' }] }]) {
    await rejected(apiFor(envelope(altered)).history('group', 'match', { match: match() }), 'protocol_invalid');
  }
  await rejected(apiFor(envelope({ ...data, visibility: 'visible', revisions: [row] })).history('group', 'match',
    { match: { ...match(), qualifierLabel: null, qualifierRequired: false } }), 'protocol_invalid');
});

test('Oráculo reads retain incomplete own choices but validate all ten categories and option identities', async () => {
  const value = oracle();
  assert.deepEqual((await apiFor(envelope({ context: context(), oracle: value })).oracle('group')).data.oracle, value);
  for (const alter of [row => { row.categories.pop(); }, row => { row.categories[0].id = row.categories[1].id; }, row => { row.categories[0].selectedIds = ['unknown']; }, row => { row.categories[0].maxSelections = 3; }]) {
    const invalid = clone(value); alter(invalid);
    await rejected(apiFor(envelope({ context: context(), oracle: invalid })).oracle('group'), 'protocol_invalid');
  }
});

test('Oráculo pick and ranking visibility are independent and hidden picks cannot leak', async () => {
  const value = oracle(); value.pickVisibility = 'visible'; value.otherPicks = []; value.rankingVisibility = 'hidden';
  assert.equal((await apiFor(envelope({ context: context(), oracle: value })).oracle('group')).data.oracle.rankingVisibility, 'hidden');
  const leaked = oracle(); leaked.otherPicks = [{ memberId: 'other', displayName: 'Otra', picks: picks() }];
  await rejected(apiFor(envelope({ context: context(), oracle: leaked })).oracle('group'), 'protocol_invalid');
  value.otherPicks = null;
  await rejected(apiFor(envelope({ context: context(), oracle: value })).oracle('group'), 'protocol_invalid');
});

test('rankings enforce the requested filter and hide rows without recomputing supplied ties', async () => {
  const value = ranking(); value.visibility = 'visible'; value.rows = ['first', 'second'].map(memberId => ({ memberId, displayName: memberId, rank: 1, pointsUnits: 21, settledCount: 1, pendingCount: 0 }));
  assert.deepEqual((await apiFor(envelope({ context: context(), rankings: value })).rankings('group', 'overall')).data.rankings.rows.map(row => row.rank), [1, 1]);
  await rejected(apiFor(envelope({ context: context(), rankings: value })).rankings('group', 'oracle'), 'protocol_invalid');
  value.visibility = 'hidden';
  await rejected(apiFor(envelope({ context: context(), rankings: value })).rankings('group', 'overall'), 'protocol_invalid');
});

test('mutations need an explicitly remembered valid CSRF token before any fetch', async () => {
  let calls = 0;
  const api = createApi({ fetch: async () => { calls += 1; return response(envelope({ group: group() }, true)); } });
  await rejected(api.createGroup({ mutationId, name: 'Amistades' }), 'csrf_unavailable');
  assert.throws(() => api.setCsrfToken('private\r\nheader'), { code: 'invalid_request' });
  assert.equal(calls, 0);
  api.setCsrfToken(token); assert.equal((await api.createGroup({ mutationId, name: 'Amistades' })).replayed, false);
  api.setCsrfToken(null); await rejected(api.createGroup({ mutationId, name: 'Amistades' }), 'csrf_unavailable');
});

test('all mutation routes preserve method, identity, CSRF and full replay envelopes', async () => {
  const calls = [], responses = [
    { group: group() }, { group: group() }, { invitation: { id: 'invite', code: 'i'.repeat(24), expiresAt: time, usesRemaining: 1, revoked: false } },
    { revoked: true }, { left: true }, { groupId: 'group', matchId: 'match', prediction: prediction() }, { groupId: 'group', revisionId: 'oracle_revision' },
  ];
  const api = createApi({ fetch: async (path, options) => { calls.push({ path, options }); return response(envelope(responses[calls.length - 1], true), 201); } });
  api.setCsrfToken(token);
  const results = [await api.createGroup({ mutationId, name: 'Amistades' }), await api.redeemInvitation({ mutationId, code: 'i'.repeat(24) }),
    await api.createInvitation('group', { mutationId }), await api.revokeInvitation('group', 'invite', { mutationId }), await api.leaveGroup('group', { mutationId }),
    await api.savePrediction('group', 'match', { mutationId, baseRevisionId: null, homeGoals: 2, awayGoals: 1, qualifierId: 'home' }, { match: match() }),
    await api.saveOracle('group', { mutationId, baseRevisionId: null, picks: picks() }, { oracle: oracle() })];
  assert.deepEqual(calls.map(({ path, options }) => [path, options.method]), [['/api/groups', 'POST'], ['/api/invitations/redeem', 'POST'], ['/api/groups/group/invitations', 'POST'],
    ['/api/groups/group/invitations/invite', 'DELETE'], ['/api/groups/group/membership', 'DELETE'], ['/api/groups/group/matches/match/prediction', 'PUT'], ['/api/groups/group/oracle', 'PUT']]);
  for (const { options } of calls) { assert.equal(options.headers['X-CSRF-Token'], token); assert.equal(JSON.parse(options.body).mutationId, mutationId); assert.equal(options.credentials, 'same-origin'); }
  assert.ok(results.every(result => result.viewerId === 'member' && result.serverTime === time && result.replayed === false));
  let release;
  const delayed = createApi({ fetch: async () => new Promise(resolve => { release = resolve; }) }); delayed.setCsrfToken(token);
  const input = { mutationId, name: 'Amistades' }, pending = delayed.createGroup(input); input.name = 'Changed after submission';
  release(response(envelope({ group: group() }, true)));
  assert.equal((await pending).data.group.name, 'Amistades');
  const wrongName = apiFor(envelope({ group: { ...group(), name: 'Otro nombre' } }, true)); wrongName.setCsrfToken(token);
  await rejected(wrongName.createGroup({ mutationId, name: 'Amistades' }), 'protocol_invalid');
});

test('mutation serializers reject spoofed ownership, invalid UUIDs and numeric coercion', async () => {
  let calls = 0;
  const api = createApi({ fetch: async () => { calls += 1; throw new Error('must not fetch'); } }); api.setCsrfToken(token);
  await rejected(api.createGroup({ mutationId, name: 'Amistades', role: 'owner' }), 'invalid_request');
  await rejected(api.createGroup({ mutationId: 'not-a-uuid', name: 'Amistades' }), 'invalid_request');
  await rejected(api.savePrediction('group', 'match', { mutationId, baseRevisionId: null, homeGoals: '2', awayGoals: 1, qualifierId: 'home' }, { match: match() }), 'invalid_request');
  assert.equal(calls, 0);
});

test('prediction saves validate their supplied match without deciding its permission or local deadline', async () => {
  const api = apiFor(envelope({ groupId: 'group', matchId: 'match', prediction: prediction() }, true)); api.setCsrfToken(token);
  const input = { mutationId, baseRevisionId: null, homeGoals: 2, awayGoals: 1, qualifierId: 'home' };
  await rejected(api.savePrediction('group', 'match', input), 'context_required');
  await rejected(api.savePrediction('group', 'other_match', input, { match: match() }), 'invalid_request');
  await rejected(api.savePrediction('group', 'match', { ...input, qualifierId: 'unknown' }, { match: match() }), 'invalid_request');
  await rejected(api.savePrediction('group', 'match', { ...input, qualifierId: null }, { match: match() }), 'invalid_request');
  await rejected(api.savePrediction('group', 'match', input, { match: { ...match(), qualifierLabel: null, qualifierRequired: false } }), 'invalid_request');
  assert.equal((await api.savePrediction('group', 'match', input, { match: match() })).data.prediction.homeGoals, 2);
});

test('Oráculo submissions require every category and the producer option/cardinality bounds', async () => {
  const api = apiFor(envelope({ groupId: 'group', revisionId: 'oracle_revision' }, true)); api.setCsrfToken(token);
  const input = { mutationId, baseRevisionId: null, picks: picks() };
  await rejected(api.saveOracle('group', input), 'context_required');
  for (const alter of [value => { delete value.picks.champion; }, value => { value.picks.champion = []; }, value => { value.picks.champion = ['unknown']; }, value => { value.picks.semifinalists = ['option_a', 'option_a']; }]) {
    const invalid = clone(input); alter(invalid);
    await rejected(api.saveOracle('group', invalid, { oracle: oracle() }), 'invalid_request');
  }
  assert.equal((await api.saveOracle('group', input, { oracle: oracle() })).data.revisionId, 'oracle_revision');
});

test('prediction acknowledgements must match the detached submitted intent', async () => {
  let release, calls = 0;
  const api = createApi({ fetch: async () => { calls += 1; return new Promise(resolve => { release = resolve; }); } }); api.setCsrfToken(token);
  const input = { mutationId, baseRevisionId: null, homeGoals: 2, awayGoals: 1, qualifierId: 'home' };
  const pending = api.savePrediction('group', 'match', input, { match: match() }); input.homeGoals = 9;
  release(response(envelope({ groupId: 'group', matchId: 'match', prediction: prediction() }, true)));
  assert.equal((await pending).data.prediction.homeGoals, 2); assert.equal(calls, 1);
  const wrong = prediction(); wrong.homeGoals = 8;
  const invalid = apiFor(envelope({ groupId: 'group', matchId: 'match', prediction: wrong }, true)); invalid.setCsrfToken(token);
  await rejected(invalid.savePrediction('group', 'match', { ...input, homeGoals: 2 }, { match: match() }), 'protocol_invalid');
});

test('successful DTOs are detached and frozen rather than retaining mutable producer resources', async () => {
  const raw = envelope({ context: context(), matches: [match()] });
  const result = await apiFor(raw).matches('group');
  raw.data.matches[0].home.name = 'Mutado';
  assert.equal(result.data.matches[0].home.name, 'Local'); assert.equal(Object.isFrozen(result.data.matches[0].home), true);
  assert.throws(() => { result.data.matches[0].home.name = 'Mutado'; }, TypeError);
});

test('HTTP errors retain only finite codes and a 401 clears the remembered CSRF token', async () => {
  let calls = 0;
  const api = createApi({ fetch: async () => { calls += 1; return response({ error: { code: 'private-token-body' } }, 401); } }); api.setCsrfToken(token);
  await rejected(api.groups(), 'request_failed', 401);
  await rejected(api.createGroup({ mutationId, name: 'Amistades' }), 'csrf_unavailable'); assert.equal(calls, 1);
  await rejected(createApi({ fetch: async () => response({ error: { code: 'revision_conflict' } }, 409) }).groups(), 'revision_conflict', 409);
  assert.equal(new ApiError(500, 'private-token-body').message, 'request_failed');
});

test('caller aborts and network errors never retry or expose thrown private detail', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  const api = createApi({ fetch: async () => { calls += 1; throw new Error('private-network-detail'); } });
  await rejected(api.groups({ signal: controller.signal }), 'request_cancelled'); assert.equal(calls, 0);
  await rejected(api.groups(), 'network_error'); assert.equal(calls, 1);
  const during = new AbortController();
  const pendingApi = createApi({ fetch: (_path, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('private-abort-detail')), { once: true })) });
  const pending = pendingApi.groups({ signal: during.signal }); during.abort(); await rejected(pending, 'request_cancelled');
  const uncooperative = new AbortController(); let release, lateCancelled = 0;
  const lateApi = createApi({ fetch: () => new Promise(resolve => { release = resolve; }) });
  const late = lateApi.groups({ signal: uncooperative.signal }); uncooperative.abort(); await rejected(late, 'request_cancelled');
  release(new Response(new ReadableStream({ cancel() { lateCancelled += 1; return new Promise(() => {}); } }), { headers: { 'Content-Type': 'application/json' } }));
  await Promise.resolve(); await Promise.resolve(); assert.equal(lateCancelled, 1);
  const bodyAbort = new AbortController(); let reading, bodyCancelled = 0;
  const bodyStarted = new Promise(resolve => { reading = resolve; });
  const bodyApi = createApi({ fetch: async () => new Response(new ReadableStream({ pull() { reading(); },
    cancel() { bodyCancelled += 1; return new Promise(() => {}); } }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'application/json' } }) });
  const bodyPending = bodyApi.groups({ signal: bodyAbort.signal }); await bodyStarted; bodyAbort.abort();
  await rejected(bodyPending, 'request_cancelled'); assert.equal(bodyCancelled, 1);
});

test('a referenced 30-second deadline aborts a pending fetch and settles with a fixed error', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const api = createApi({ fetch: (_path, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('private-timeout-detail')), { once: true })) });
    const pending = api.groups(); t.mock.timers.tick(30000); await rejected(pending, 'request_timeout');
    const ignored = createApi({ fetch: () => new Promise(() => {}) }).groups();
    t.mock.timers.tick(30000); await rejected(ignored, 'request_timeout');
    let reading, cancelled = 0;
    const started = new Promise(resolve => { reading = resolve; });
    const stalled = createApi({ fetch: async () => new Response(new ReadableStream({ pull() { reading(); },
      cancel() { cancelled += 1; return new Promise(() => {}); } }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'application/json' } }) }).groups();
    await started; t.mock.timers.tick(30000); await rejected(stalled, 'request_timeout'); assert.equal(cancelled, 1);
  } finally { t.mock.timers.reset(); }
});

test('malformed JSON, invalid UTF8, extra envelope fields and byte-limit breaches fail visibly', async () => {
  for (const fetch of [async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    async () => new Response(new Uint8Array([255]), { headers: { 'Content-Type': 'application/json' } }),
    async () => response({ ...envelope({ groups: [] }), extra: 'private' }),
    async () => response(envelope({ groups: [] }), 201)]) await rejected(createApi({ fetch }).groups(), 'protocol_invalid');
  await rejected(createApi({ fetch: async () => response(envelope({ groups: [] }), 200, { 'Content-Length': String(2 * 1024 * 1024 + 1) }) }).groups(), 'response_too_large');
  let declaredCancelled = 0;
  const oversized = new Response(new ReadableStream({ cancel() { declaredCancelled += 1; return new Promise(() => {}); } }),
    { headers: { 'Content-Type': 'application/json', 'Content-Length': String(2 * 1024 * 1024 + 1) } });
  await rejected(createApi({ fetch: async () => oversized }).groups(), 'response_too_large'); assert.equal(declaredCancelled, 1);
  let sent = 0, cancelled = 0; const chunk = new Uint8Array(1024 * 1024);
  const stream = new ReadableStream({ pull(controller) { if (sent++ < 3) controller.enqueue(chunk); else controller.close(); }, cancel() { cancelled += 1; } }, { highWaterMark: 0 });
  await rejected(createApi({ fetch: async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } }) }).groups(), 'response_too_large');
  assert.equal(cancelled, 1);
});
