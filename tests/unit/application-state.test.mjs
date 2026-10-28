import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace } from '../../public/src/workspace.mjs';
import { ApiError } from '../../public/src/api.mjs';
import { ORACLE_CATEGORY_IDS } from '../../public/src/protocol.mjs';

// Authored T2 controller cases only. API responses and identities are deterministic;
// deferred stubs deliberately ignore abort so ownership checks must reject late data.
const time = '2026-01-01T12:00:00.000Z';
const clone = value => structuredClone(value);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
};
const prediction = (revisionId, homeGoals = 1, awayGoals = 0) => ({ revisionId, homeGoals, awayGoals, qualifierId: 'home', updatedAt: time });
const values = (homeGoals = '2', awayGoals = '1') => ({ homeGoals, awayGoals, qualifierId: 'home', baseRevisionId: null });
const selections = () => Object.fromEntries(ORACLE_CATEGORY_IDS.map(id => [id, [id === 'runnerUp' ? 'option_a' : 'option_b']]));

function harness() {
  const f = { viewer: 'viewer_a', handlers: {}, calls: {}, tokens: [], ids: [], changes: [] };
  f.groups = ['group_a', 'group_b'].map(id => ({ id, name: id, role: 'owner', memberCount: 1,
    tournamentId: `tournament_${id}`, permissions: { canInvite: true, canLeave: true } }));
  f.details = Object.fromEntries(f.groups.map(group => [group.id, { group: clone(group),
    members: [{ id: f.viewer, displayName: 'Persona de prueba', joinedAt: time }], invitations: [] }]));
  f.contexts = Object.fromEntries(f.groups.map(group => [group.id, { groupId: group.id, tournamentId: group.tournamentId,
    name: `Torneo ${group.id}`, mode: 'replay', rulesetVersionId: 'rules_a', rulesState: 'active',
    rules: [{ label: 'Regla escrita para el caso', description: 'Solo datos de prueba.' }], pendingPolicies: [] }]));
  f.matches = Object.fromEntries(f.groups.map(group => [group.id, [{ id: 'match', kind: 'knockout', roundLabel: 'Ronda de prueba', matchdayLabel: 'Jornada de prueba',
    home: { id: 'home', name: 'Local' }, away: { id: 'away', name: 'Visitante' }, kickoffAt: time, cutoffAt: time, revealAt: time,
    status: 'scheduled', canEdit: true, editReason: null, qualifierLabel: 'Equipo que se clasifica', qualifierRequired: true,
    ownPrediction: prediction(`saved_${group.id}`), pickVisibility: 'hidden', otherPredictions: null, historyVisibility: 'visible' }]]));
  f.oracles = Object.fromEntries(f.groups.map(group => [group.id, { revisionId: `oracle_${group.id}`, canEdit: true, editReason: null,
    cutoffAt: time, pickVisibility: 'hidden', rankingVisibility: 'hidden', otherPicks: null,
    categories: ORACLE_CATEGORY_IDS.map(id => ({ id, label: id, description: 'Categoría de prueba', pointsUnits: 2,
      minSelections: 1, maxSelections: id === 'semifinalists' ? 2 : 1,
      options: [{ id: 'option_a', label: 'A', description: '' }, { id: 'option_b', label: 'B', description: '' }],
      selectedIds: [id === 'runnerUp' ? 'option_b' : 'option_a'] })) }]));
  f.reply = (data, { viewerId = f.viewer, mutation = false, replayed = false } = {}) => ({
    data: clone(data), serverTime: time, viewerId, ...(mutation ? { replayed } : {}),
  });
  const defaults = {
    session: () => f.reply({ state: 'member', user: { id: f.viewer, displayName: f.viewer }, csrfToken: 'c'.repeat(32) }),
    groups: () => f.reply({ groups: f.groups }),
    group: groupId => f.reply(f.details[groupId]),
    tournament: groupId => f.reply({ context: f.contexts[groupId] }),
    matches: groupId => f.reply({ context: f.contexts[groupId], matches: f.matches[groupId] }),
    oracle: groupId => f.reply({ context: f.contexts[groupId], oracle: f.oracles[groupId] }),
    rankings: (groupId, filter) => f.reply({ context: f.contexts[groupId], rankings: {
      filter, availableFilters: ['overall', 'oracle'], visibility: 'hidden', computedAt: null, rows: [],
    } }),
    history: (groupId, matchId) => f.reply({ groupId, matchId, visibility: 'visible', revisions: [{
      id: 'history_a', memberId: f.viewer, displayName: 'Persona de prueba', createdAt: time,
      homeGoals: 1, awayGoals: 0, qualifierId: 'home', reason: null,
    }] }),
  };
  f.api = { setCsrfToken: token => f.tokens.push(token) };
  for (const name of [...Object.keys(defaults), 'savePrediction', 'saveOracle', 'createGroup', 'redeemInvitation', 'createInvitation', 'revokeInvitation', 'leaveGroup']) {
    f.calls[name] = [];
    f.api[name] = (...args) => {
      f.calls[name].push(args);
      try {
        const handler = f.handlers[name] ?? defaults[name];
        if (!handler) throw new Error(`unexpected_stub_operation_${name}`);
        return Promise.resolve(handler(...args));
      } catch (error) { return Promise.reject(error); }
    };
  }
  f.workspace = createWorkspace({ api: f.api, onChange: state => f.changes.push({
    status: state.status, selectedGroupId: state.selectedGroupId, message: state.message?.kind ?? null,
  }), makeId: () => {
    const id = `00000000-0000-4000-8000-${String(f.ids.length + 1).padStart(12, '0')}`;
    f.ids.push(id); return id;
  } });
  f.ready = async (section = 'matches') => {
    await f.workspace.start();
    if (section !== 'groups') await f.workspace.actions.selectSection(section);
    return f;
  };
  return f;
}

test('anonymous and unavailable sessions never invent groups or issue private reads', { timeout: 5000 }, async () => {
  for (const data of [{ state: 'unavailable' }, { state: 'anonymous', loginPath: '/auth/login' }]) {
    const f = harness();
    f.handlers.session = () => f.reply(data, { viewerId: null });
    await f.workspace.start();
    assert.equal(f.workspace.state.status, data.state);
    assert.deepEqual(f.workspace.state.groups, []);
    assert.equal(f.workspace.state.selectedGroupId, null);
    assert.equal(f.calls.groups.length, 0); assert.equal(f.calls.matches.length, 0);
    assert.equal(f.workspace.hasUnsent(), false);
  }
});

test('an uncertain prediction retry keeps its identity and claims success only after acknowledgement', { timeout: 5000 }, async () => {
  const f = await harness().ready(), acknowledgement = deferred();
  f.handlers.savePrediction = () => {
    if (f.calls.savePrediction.length === 1) throw new ApiError(0, 'network_error');
    return acknowledgement.promise;
  };
  await f.workspace.actions.savePrediction('match', values());
  assert.equal(f.calls.savePrediction.length, 1, 'a network error does not start an automatic retry');
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '2');
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'saved_group_a');
  assert.equal(f.workspace.state.message.kind, 'error');
  const retry = f.workspace.actions.savePrediction('match', values());
  assert.equal(f.calls.savePrediction[0][2].mutationId, f.calls.savePrediction[1][2].mutationId);
  assert.equal(f.ids.length, 1); assert.equal(f.workspace.state.pending.size, 1);
  assert.equal(f.workspace.state.message, null);
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'saved_group_a');
  f.matches.group_a[0].ownPrediction = prediction('acknowledged', 2, 1);
  acknowledgement.resolve(f.reply({ groupId: 'group_a', matchId: 'match', prediction: f.matches.group_a[0].ownPrediction }, { mutation: true }));
  await retry;
  assert.equal(f.workspace.state.pending.size, 0);
  assert.equal(f.workspace.scope().predictions.has('match'), false);
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'acknowledged');
  assert.equal(f.workspace.state.message.kind, 'success');
});

test('changed prediction intent gets a new identity after an uncertain response', { timeout: 5000 }, async () => {
  const f = await harness().ready();
  f.handlers.savePrediction = () => { throw new ApiError(0, 'request_timeout'); };
  await f.workspace.actions.savePrediction('match', values('2'));
  await f.workspace.actions.savePrediction('match', values('3'));
  assert.notEqual(f.calls.savePrediction[0][2].mutationId, f.calls.savePrediction[1][2].mutationId);
  assert.equal(f.calls.savePrediction[1][2].homeGoals, 3);
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '3');
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'saved_group_a');
});

test('a prediction conflict preserves the draft and requires explicit base review before another save', { timeout: 5000 }, async () => {
  const f = await harness().ready();
  f.handlers.savePrediction = () => {
    f.matches.group_a[0].ownPrediction = prediction('newer_saved', 0, 0);
    throw new ApiError(409, 'revision_conflict');
  };
  await f.workspace.actions.savePrediction('match', values('4', '2'));
  assert.equal(f.workspace.scope().conflicts.has('match'), true);
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'newer_saved');
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'saved_group_a');
  await f.workspace.actions.savePrediction('match', values('4', '2'));
  assert.equal(f.calls.savePrediction.length, 1);
  f.workspace.actions.reviewPredictionConflict('match');
  assert.equal(f.workspace.state.review.revisionId, 'newer_saved');
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'saved_group_a');
  f.workspace.actions.acceptReviewedBase();
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'newer_saved');
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '4');
  assert.equal(f.workspace.scope().conflicts.has('match'), false);
  assert.equal(f.calls.savePrediction.length, 1, 'accepting a reviewed base does not submit it');
});

test('a newer resource refresh cannot silently accept an outdated conflict comparison', { timeout: 5000 }, async () => {
  const f = await harness().ready();
  f.handlers.savePrediction = () => { f.matches.group_a[0].ownPrediction = prediction('revision_two'); throw new ApiError(409, 'revision_conflict'); };
  await f.workspace.actions.savePrediction('match', values());
  f.workspace.actions.reviewPredictionConflict('match');
  f.matches.group_a[0].ownPrediction = prediction('revision_three');
  await f.workspace.actions.refresh();
  f.workspace.actions.acceptReviewedBase();
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'saved_group_a');
  assert.equal(f.workspace.scope().conflicts.has('match'), true);
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'revision_three');
});

test('Oracle retries bind the whole detached selection and conflicts keep their original base', { timeout: 5000 }, async () => {
  const f = await harness().ready('oracle'), input = selections();
  f.workspace.actions.changeOracle(input);
  input.champion[0] = 'option_a';
  assert.equal(f.workspace.scope().oracleDraft.picks.champion[0], 'option_b');
  const ours = clone(f.workspace.scope().oracleDraft.picks);
  f.handlers.saveOracle = () => {
    if (f.calls.saveOracle.length === 1) throw new ApiError(0, 'network_error');
    f.oracles.group_a.revisionId = 'oracle_newer';
    throw new ApiError(409, 'revision_conflict');
  };
  await f.workspace.actions.saveOracle(ours);
  await f.workspace.actions.saveOracle(Object.fromEntries(Object.entries(ours).reverse()));
  assert.equal(f.calls.saveOracle[0][1].mutationId, f.calls.saveOracle[1][1].mutationId);
  assert.equal(f.workspace.scope().oracleConflict, true);
  assert.equal(f.workspace.scope().oracleDraft.baseRevisionId, 'oracle_group_a');
  assert.deepEqual(f.workspace.scope().oracleDraft.picks, ours);
  f.workspace.actions.reviewOracleConflict();
  assert.equal(f.workspace.scope().oracleDraft.baseRevisionId, 'oracle_group_a');
  f.workspace.actions.acceptReviewedBase();
  assert.equal(f.workspace.scope().oracleDraft.baseRevisionId, 'oracle_newer');
  assert.deepEqual(f.workspace.scope().oracleDraft.picks, ours);
  assert.equal(f.calls.saveOracle.length, 2);
});

test('late group reads and leave acknowledgements cannot replace the selected group or its draft scope', { timeout: 5000 }, async () => {
  const f = await harness().ready(), detail = deferred(), tournament = deferred();
  f.workspace.actions.changePrediction('match', values('4'));
  f.handlers.group = id => id === 'group_a' ? detail.promise : f.reply(f.details[id]);
  f.handlers.tournament = id => id === 'group_a' ? tournament.promise : f.reply({ context: f.contexts[id] });
  const stale = f.workspace.actions.refresh();
  await f.workspace.actions.selectGroup('group_b');
  assert.equal(f.workspace.state.context.groupId, 'group_b');
  assert.equal(f.workspace.scope().predictions.has('match'), false);
  detail.resolve(f.reply(f.details.group_a)); tournament.resolve(f.reply({ context: f.contexts.group_a }));
  await stale;
  assert.equal(f.workspace.state.selectedGroupId, 'group_b');
  assert.equal(f.workspace.state.groupDetails.group.id, 'group_b');
  assert.equal(f.workspace.state.context.groupId, 'group_b');
  delete f.handlers.group; delete f.handlers.tournament;
  await f.workspace.actions.selectGroup('group_a');
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '4');
  const leaveAck = deferred();
  f.handlers.leaveGroup = () => leaveAck.promise;
  const leave = f.workspace.actions.leaveGroup('group_a');
  await f.workspace.actions.selectGroup('group_b');
  f.groups = f.groups.filter(group => group.id !== 'group_a');
  leaveAck.resolve(f.reply({ left: true }, { mutation: true }));
  await leave;
  assert.equal(f.workspace.state.selectedGroupId, 'group_b');
  assert.equal(f.workspace.state.context.groupId, 'group_b');
  assert.equal(f.workspace.state.groupDetails.group.id, 'group_b');
});

test('out-of-order same-group resource reads keep the newest snapshot', { timeout: 5000 }, async () => {
  const f = await harness().ready(), oldRead = deferred(), newRead = deferred(), entered = deferred();
  let reads = 0;
  f.handlers.matches = () => { if (++reads === 1) return oldRead.promise; entered.resolve(); return newRead.promise; };
  const oldPayload = f.reply({ context: f.contexts.group_a, matches: f.matches.group_a });
  const first = f.workspace.actions.selectSection('matches');
  const second = f.workspace.actions.refresh();
  await entered.promise;
  f.matches.group_a[0].ownPrediction = prediction('latest_read');
  newRead.resolve(f.reply({ context: f.contexts.group_a, matches: f.matches.group_a }));
  await second;
  oldRead.resolve(oldPayload); await first;
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'latest_read');
  assert.equal(f.workspace.state.viewLoading, false);
});

test('navigation away from a pending resource prevents late data and a stuck loading state', { timeout: 5000 }, async () => {
  const f = await harness().ready(), read = deferred();
  f.handlers.matches = () => read.promise;
  const pending = f.workspace.actions.selectSection('matches');
  await f.workspace.actions.selectSection('rules');
  read.resolve(f.reply({ context: f.contexts.group_a, matches: f.matches.group_a }));
  await pending;
  assert.equal(f.workspace.state.section, 'rules');
  assert.equal(f.workspace.state.matches, null);
  assert.equal(f.workspace.state.viewLoading, false);
});

test('a changed response viewer clears private state and ignores an older mutation acknowledgement', { timeout: 5000 }, async () => {
  const f = await harness().ready(), acknowledgement = deferred();
  f.handlers.savePrediction = () => acknowledgement.promise;
  const save = f.workspace.actions.savePrediction('match', values());
  f.handlers.matches = () => f.reply({ context: f.contexts.group_a, matches: f.matches.group_a }, { viewerId: 'different_viewer' });
  await f.workspace.actions.refresh();
  assert.equal(f.workspace.state.status, 'error'); assert.equal(f.workspace.state.session, null);
  assert.deepEqual(f.workspace.state.groups, []); assert.equal(f.workspace.state.context, null);
  assert.equal(f.workspace.hasUnsent(), false); assert.equal(f.tokens.at(-1), null);
  assert.equal(f.changes.at(-1).status, 'error', 'the cleared session is emitted so private UI can be removed');
  assert.equal(f.changes.at(-1).selectedGroupId, null);
  acknowledgement.resolve(f.reply({ groupId: 'group_a', matchId: 'match', prediction: prediction('old_ack') }, { mutation: true }));
  await save;
  assert.equal(f.workspace.state.session, null); assert.equal(f.workspace.state.matches, null);
  assert.notEqual(f.workspace.state.message?.kind, 'success');
  const afterAck = await harness().ready();
  afterAck.handlers.savePrediction = () => afterAck.reply({ groupId: 'group_a', matchId: 'match', prediction: prediction('accepted_before_session_change') }, { mutation: true });
  afterAck.handlers.matches = () => afterAck.reply({ context: afterAck.contexts.group_a, matches: afterAck.matches.group_a }, { viewerId: 'different_viewer' });
  await afterAck.workspace.actions.savePrediction('match', values());
  assert.equal(afterAck.workspace.state.session, null);
  assert.equal(afterAck.workspace.state.status, 'error');
  assert.equal(afterAck.changes.at(-1).status, 'error');
  assert.equal(afterAck.changes.at(-1).selectedGroupId, null);
  assert.notEqual(afterAck.workspace.state.message?.kind, 'success', 'a refresh that detects a changed viewer owns the final message');
});

test('restarting as another viewer prevents an old acknowledgement from clearing their pending draft', { timeout: 5000 }, async () => {
  const f = await harness().ready(), oldAck = deferred(), newAck = deferred();
  f.handlers.savePrediction = () => f.calls.savePrediction.length === 1 ? oldAck.promise : newAck.promise;
  const oldSave = f.workspace.actions.savePrediction('match', values('2'));
  f.viewer = 'viewer_b';
  await f.workspace.start();
  await f.workspace.actions.selectSection('matches');
  const newSave = f.workspace.actions.savePrediction('match', values('3'));
  assert.equal(f.workspace.state.pending.size, 1);
  oldAck.resolve(f.reply({ groupId: 'group_a', matchId: 'match', prediction: prediction('old_ack') }, { viewerId: 'viewer_a', mutation: true }));
  await oldSave;
  assert.equal(f.workspace.state.session.user.id, 'viewer_b');
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '3');
  assert.equal(f.workspace.state.pending.size, 1);
  assert.notEqual(f.workspace.state.message?.kind, 'success');
  f.matches.group_a[0].ownPrediction = prediction('new_ack', 3, 1);
  newAck.resolve(f.reply({ groupId: 'group_a', matchId: 'match', prediction: f.matches.group_a[0].ownPrediction }, { mutation: true }));
  await newSave;
  assert.equal(f.workspace.state.pending.size, 0);
  assert.equal(f.workspace.state.matches[0].ownPrediction.revisionId, 'new_ack');
});

test('writes use the current server resource and active permission instead of the browser clock', { timeout: 5000 }, async () => {
  const f = await harness().ready(), activeMatch = f.workspace.state.matches[0];
  f.handlers.savePrediction = (_groupId, _matchId, body) => f.reply({ groupId: 'group_a', matchId: 'match', prediction: prediction('accepted', body.homeGoals, body.awayGoals) }, { mutation: true });
  await f.workspace.actions.savePrediction('match', values('0', '99'));
  assert.deepEqual(f.calls.savePrediction[0][3].match, activeMatch);
  assert.equal(f.calls.savePrediction[0][2].homeGoals, 0); assert.equal(f.calls.savePrediction[0][2].awayGoals, 99);
  f.contexts.group_a.rulesState = 'draft'; await f.workspace.actions.refresh();
  await f.workspace.actions.savePrediction('match', values());
  f.contexts.group_a.rulesState = 'active'; f.matches.group_a[0].canEdit = false; await f.workspace.actions.refresh();
  await f.workspace.actions.savePrediction('match', values());
  assert.equal(f.calls.savePrediction.length, 1);
  await f.workspace.actions.selectSection('oracle');
  const activeOracle = f.workspace.state.oracle;
  f.handlers.saveOracle = () => f.reply({ groupId: 'group_a', revisionId: 'oracle_ack' }, { mutation: true });
  await f.workspace.actions.saveOracle(selections());
  assert.deepEqual(f.calls.saveOracle[0][2].oracle, activeOracle);
  f.oracles.group_a.canEdit = false; await f.workspace.actions.refresh();
  await f.workspace.actions.saveOracle(selections());
  assert.equal(f.calls.saveOracle.length, 1);
});

test('history is never requested while hidden and an older read cannot outlive a new visibility gate', { timeout: 5000 }, async () => {
  const f = await harness().ready(), history = deferred();
  f.matches.group_a[0].historyVisibility = 'hidden'; await f.workspace.actions.refresh();
  await f.workspace.actions.loadHistory('match');
  assert.equal(f.calls.history.length, 0);
  f.matches.group_a[0].historyVisibility = 'visible'; await f.workspace.actions.refresh();
  f.handlers.history = () => history.promise;
  const pending = f.workspace.actions.loadHistory('match');
  f.matches.group_a[0].historyVisibility = 'hidden'; await f.workspace.actions.refresh();
  history.resolve(f.reply({ groupId: 'group_a', matchId: 'match', visibility: 'visible', revisions: [] }));
  await pending;
  assert.equal(f.workspace.scope().histories.has('match'), false);
});

test('acknowledging older prediction and Oracle submissions preserves newer unsent values', { timeout: 5000 }, async () => {
  const f = await harness().ready(), matchAck = deferred();
  f.handlers.savePrediction = () => matchAck.promise;
  const saveMatch = f.workspace.actions.savePrediction('match', values('2'));
  f.workspace.actions.changePrediction('match', values('4'));
  f.matches.group_a[0].ownPrediction = prediction('submitted_older', 2, 1);
  matchAck.resolve(f.reply({ groupId: 'group_a', matchId: 'match', prediction: f.matches.group_a[0].ownPrediction }, { mutation: true }));
  await saveMatch;
  assert.equal(f.workspace.scope().predictions.get('match').homeGoals, '4');
  assert.equal(f.workspace.scope().predictions.get('match').baseRevisionId, 'saved_group_a');
  assert.equal(f.workspace.scope().conflicts.has('match'), true);
  await f.workspace.actions.selectSection('oracle');
  const oracleAck = deferred(), older = selections(), newer = selections();
  newer.goldenBoot = ['option_a'];
  f.handlers.saveOracle = () => oracleAck.promise;
  const saveOracle = f.workspace.actions.saveOracle(older);
  f.workspace.actions.changeOracle(newer);
  f.oracles.group_a.revisionId = 'oracle_submitted_older';
  for (const category of f.oracles.group_a.categories) category.selectedIds = [...older[category.id]];
  oracleAck.resolve(f.reply({ groupId: 'group_a', revisionId: 'oracle_submitted_older' }, { mutation: true }));
  await saveOracle;
  assert.deepEqual(f.workspace.scope().oracleDraft.picks.goldenBoot, ['option_a']);
  assert.equal(f.workspace.scope().oracleDraft.baseRevisionId, 'oracle_group_a');
  assert.equal(f.workspace.scope().oracleConflict, true);
  assert.equal(f.workspace.hasUnsent(), true);
});

test('invitation retries preserve identity and expose a private code only from its acknowledged receipt', { timeout: 5000 }, async () => {
  const f = await harness().ready('groups'), acknowledgement = deferred();
  const invitation = { id: 'invite_a', code: 'authored_private_code_123456', expiresAt: time, usesRemaining: 1, revoked: false };
  f.handlers.createInvitation = () => {
    if (f.calls.createInvitation.length === 1) throw new ApiError(0, 'network_error');
    return acknowledgement.promise;
  };
  await f.workspace.actions.createInvitation('group_a');
  const retry = f.workspace.actions.createInvitation('group_a');
  assert.equal(f.calls.createInvitation[0][1].mutationId, f.calls.createInvitation[1][1].mutationId);
  assert.deepEqual(f.workspace.groupInvitations(), []);
  assert.notEqual(f.workspace.state.message?.kind, 'success');
  f.details.group_a.invitations = [{ ...invitation, code: null }];
  acknowledgement.resolve(f.reply({ invitation }, { mutation: true, replayed: true }));
  await retry;
  assert.equal(f.workspace.state.groupDetails.invitations[0].code, null);
  assert.equal(f.workspace.groupInvitations()[0].code, invitation.code);
  assert.equal(JSON.stringify(f.workspace.draftExport()).includes(invitation.code), false);
  f.handlers.revokeInvitation = () => {
    f.details.group_a.invitations[0].revoked = true;
    return f.reply({ revoked: true }, { mutation: true });
  };
  await f.workspace.actions.revokeInvitation('group_a', 'invite_a');
  assert.equal(f.workspace.groupInvitations()[0].code, null);
  f.details.group_a.group.permissions.canInvite = false; await f.workspace.actions.refresh();
  assert.ok(f.workspace.groupInvitations().every(row => row.code === null));
});

test('a group access failure removes its private view and previously loaded history', { timeout: 5000 }, async () => {
  const f = await harness().ready();
  await f.workspace.actions.loadHistory('match');
  const oldScope = f.workspace.scope();
  assert.equal(oldScope.histories.size, 1);
  f.handlers.group = id => { if (id === 'group_a') throw new ApiError(403, 'forbidden'); return f.reply(f.details[id]); };
  await f.workspace.actions.refresh();
  assert.equal(f.workspace.state.selectedGroupId, null);
  assert.equal(f.workspace.state.groupDetails, null); assert.equal(f.workspace.state.context, null);
  assert.equal(f.workspace.state.matches, null); assert.equal(f.workspace.state.oracle, null);
  assert.equal(f.workspace.state.groups.some(group => group.id === 'group_a'), false);
  assert.equal(oldScope.histories.size, 0);
  assert.notEqual(f.workspace.state.message?.kind, 'success');
});
