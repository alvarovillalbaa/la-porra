import test from 'node:test';
import assert from 'node:assert/strict';
import { ORACLE_RULESET_VERSION, ORACLE_CATEGORIES, resolveOracleOutcomes, scoreOraclePrediction } from '../src/oracle.mjs';
import { oracleInput, category, team, drawTeam } from './oracle-fixtures.mjs';

// T2. Authored domain cases, prepared for approval; no services or actual fixtures.
const EXPECTED = [
  ['champion', 'a', 40], ['runnerUp', 'c', 24],
  ['semifinalists', null, 8], ['goldenBoot', 'player-a', 30],
  ['goldenBall', 'player-c', 24], ['goldenGlove', 'player-e', 20],
  ['youngPlayer', 'player-g', 16], ['cinderella', 'g', 20],
  ['flop', 'b', 20], ['worstGoalDifference', 'b', 16],
];

test('all ten categories retain the draft version and original weights', () => {
  assert.equal(ORACLE_RULESET_VERSION, 'research-2026-oracle-v1');
  assert.deepEqual(ORACLE_CATEGORIES, EXPECTED.map(([name]) => name));
  assert.equal(Object.isFrozen(ORACLE_CATEGORIES), true);
  const output = scoreOraclePrediction(oracleInput());
  assert.equal(output.complete, true);
  assert.equal(output.totalHalfPoints, 218);
  assert.equal(output.settledHalfPoints, 218);
});

for (const [name, id, halfPoints] of EXPECTED) {
  test(`settled ${name} exposes the exact matching award`, () => {
    const input = oracleInput();
    const outcome = category(resolveOracleOutcomes(input), name);
    assert.equal(outcome.status, 'settled');
    assert.equal(outcome.reason, null);
    const score = category(scoreOraclePrediction(input), name);
    assert.equal(score.halfPoints, halfPoints);
    assert.deepEqual(score.matchedIds, id === null ? ['a', 'c', 'd', 'e'] : [id]);
    assert.deepEqual(outcome.awards, id === null
      ? ['a', 'c', 'd', 'e'].map(winner => ({ id: winner, halfPoints: 2 }))
      : [{ id, halfPoints }]);
  });
}

test('a result, pick and ruleset revision remain bound to the exact draw', () => {
  const output = scoreOraclePrediction(oracleInput());
  assert.deepEqual({
    tournamentId: output.tournamentId, snapshotId: output.snapshotId,
    rulesetId: output.rulesetId, rulesetVersion: output.rulesetVersion,
    resultRevisionId: output.resultRevisionId, pickRevisionId: output.pickRevisionId,
  }, {
    tournamentId: 'authored-tournament', snapshotId: 'draw-1',
    rulesetId: 'rules-draft-1', rulesetVersion: 'research-2026-oracle-v1',
    resultRevisionId: 'official-revision-1', pickRevisionId: 'pick-revision-1',
  });
});

test('a corrected official award replaces its prior score without accumulating it', () => {
  const input = oracleInput();
  const first = scoreOraclePrediction(input);
  input.result.id = 'official-revision-2';
  input.result.awards.goldenBoot.winnerIds = ['player-c'];
  const corrected = scoreOraclePrediction(input);
  assert.equal(first.totalHalfPoints, 218);
  assert.equal(corrected.totalHalfPoints, 188);
  assert.equal(corrected.resultRevisionId, 'official-revision-2');
  assert.equal(corrected.pickRevisionId, first.pickRevisionId);
  assert.deepEqual(category(corrected, 'goldenBoot').matchedIds, []);
  assert.equal(category(corrected, 'goldenBoot').halfPoints, 0);
  assert.deepEqual(scoreOraclePrediction(input), corrected);
});

test('omitted and explicitly null picks earn zero only for settled categories', () => {
  for (const picks of [{}, Object.fromEntries(EXPECTED.map(([name]) => [name, null]))]) {
    const input = oracleInput(); input.revision.picks = picks;
    const output = scoreOraclePrediction(input);
    assert.equal(output.complete, true);
    assert.equal(output.totalHalfPoints, 0);
    assert.equal(output.settledHalfPoints, 0);
    for (const row of output.categories) {
      assert.equal(row.halfPoints, 0); assert.deepEqual(row.matchedIds, []);
    }
  }
});

test('semifinalist scoring counts unique correct teams rather than order', () => {
  const input = oracleInput(); input.revision.picks.semifinalists = ['g', 'd', 'c', 'h'];
  assert.equal(category(scoreOraclePrediction(input), 'semifinalists').halfPoints, 4);
  input.revision.picks.semifinalists = ['e', 'd', 'c', 'a'];
  assert.equal(category(scoreOraclePrediction(input), 'semifinalists').halfPoints, 8);
});

test('a shared official award credits one selection once', () => {
  const input = oracleInput(); input.result.awards.goldenBoot.winnerIds = ['player-c', 'player-a'];
  assert.deepEqual(category(resolveOracleOutcomes(input), 'goldenBoot').awards, [
    { id: 'player-a', halfPoints: 30 }, { id: 'player-c', halfPoints: 30 },
  ]);
  assert.equal(category(scoreOraclePrediction(input), 'goldenBoot').halfPoints, 30);
  input.revision.picks.goldenBoot = 'player-c';
  assert.equal(category(scoreOraclePrediction(input), 'goldenBoot').halfPoints, 30);
});

test('an unverified result leaves every category unsettled instead of final zero', () => {
  const input = oracleInput(); input.result.verified = false;
  const output = scoreOraclePrediction(input);
  assert.equal(output.complete, false); assert.equal(output.totalHalfPoints, null);
  assert.equal(output.settledHalfPoints, 0);
  for (const row of output.categories) {
    assert.equal(row.status, 'pending'); assert.equal(row.halfPoints, null);
    assert.deepEqual(row.matchedIds, []); assert.equal(typeof row.reason, 'string');
  }
});

for (const name of ['goldenBoot', 'goldenBall', 'goldenGlove', 'youngPlayer']) {
  test(`missing or unverified ${name} prevents a final Oraculo total`, () => {
    for (const state of ['missing', 'unverified', 'empty']) {
      const input = oracleInput();
      if (state === 'missing') delete input.result.awards[name];
      if (state === 'unverified') input.result.awards[name].verified = false;
      if (state === 'empty') input.result.awards[name].winnerIds = [];
      const output = scoreOraclePrediction(input);
      assert.equal(category(output, name).status, 'pending');
      assert.equal(category(output, name).halfPoints, null);
      assert.equal(output.totalHalfPoints, null);
      assert.equal(output.complete, false);
      assert.equal(output.settledHalfPoints, 218 - EXPECTED.find(([key]) => key === name)[2]);
    }
  });
}

test('verified awards can settle while final team outcomes remain incomplete', () => {
  for (const state of ['nonfinal', 'missing-team']) {
    const input = oracleInput();
    if (state === 'nonfinal') input.result.final = false;
    else input.result.teams.pop();
    const output = scoreOraclePrediction(input);
    assert.equal(output.complete, false); assert.equal(output.totalHalfPoints, null);
    assert.equal(output.settledHalfPoints, 90);
    assert.equal(category(output, 'champion').status, 'pending');
    assert.equal(category(output, 'cinderella').status, 'pending');
    assert.equal(category(output, 'goldenBoot').status, 'settled');
  }
});

test('missing ambiguous policies remain explicit instead of selecting draft rules', () => {
  const input = oracleInput(); delete input.ruleset.policies;
  const output = scoreOraclePrediction(input);
  for (const name of ['cinderella', 'flop', 'worstGoalDifference']) {
    assert.equal(category(output, name).status, 'policy_required');
    assert.equal(category(output, name).halfPoints, null);
  }
  assert.equal(output.totalHalfPoints, null);
  assert.equal(output.settledHalfPoints, 162);
});

test('unpicked categories remain unsettled when results or policies are missing', () => {
  for (const state of ['unverified', 'missing-policies']) {
    const input = oracleInput(); input.revision.picks = {};
    if (state === 'unverified') input.result.verified = false;
    else delete input.ruleset.policies;
    const output = scoreOraclePrediction(input);
    assert.equal(output.totalHalfPoints, null);
    assert.equal(output.complete, false);
    assert.equal(output.settledHalfPoints, 0);
    assert.equal(category(output, 'cinderella').halfPoints, null);
    assert.equal(category(output, 'flop').halfPoints, null);
    assert.equal(category(output, 'worstGoalDifference').halfPoints, null);
  }
});

test('Cinderella starts from pot four and prefers the furthest finish', () => {
  const input = oracleInput();
  team(input, 'h').groupPoints = 9;
  assert.deepEqual(category(resolveOracleOutcomes(input), 'cinderella').awards, [{ id: 'g', halfPoints: 20 }]);
  input.snapshot.teams.reverse(); input.result.teams.reverse();
  assert.deepEqual(category(resolveOracleOutcomes(input), 'cinderella').awards, [{ id: 'g', halfPoints: 20 }]);
});

test('Cinderella tie chain uses group points, total GD, total goals, then worse snapshot rank', () => {
  const input = oracleInput();
  const g = team(input, 'g'), h = team(input, 'h');
  Object.assign(h, { ...g, teamId: 'h', groupPoints: 4 });
  assert.equal(category(resolveOracleOutcomes(input), 'cinderella').awards[0].id, 'h');
  h.groupPoints = g.groupPoints; h.totalGoalsFor = 8;
  assert.equal(category(resolveOracleOutcomes(input), 'cinderella').awards[0].id, 'h');
  h.totalGoalsAgainst = 9;
  assert.equal(category(resolveOracleOutcomes(input), 'cinderella').awards[0].id, 'h');
  h.totalGoalsFor = g.totalGoalsFor; h.totalGoalsAgainst = g.totalGoalsAgainst;
  assert.equal(category(resolveOracleOutcomes(input), 'cinderella').awards[0].id, 'h');
  drawTeam(input, 'g').fifaRank = 61;
  assert.equal(category(resolveOracleOutcomes(input), 'cinderella').awards[0].id, 'g');
});

test('an exact Cinderella tie retains both IDs only under the explicit all-winners policy', () => {
  const input = oracleInput();
  Object.assign(team(input, 'h'), { ...team(input, 'g'), teamId: 'h' });
  drawTeam(input, 'h').fifaRank = drawTeam(input, 'g').fifaRank;
  assert.deepEqual(category(resolveOracleOutcomes(input), 'cinderella').awards, [
    { id: 'g', halfPoints: 20 }, { id: 'h', halfPoints: 20 },
  ]);
  input.ruleset.policies.cinderellaTies = 'pending';
  assert.equal(category(scoreOraclePrediction(input), 'cinderella').status, 'policy_required');
  assert.equal(category(scoreOraclePrediction(input), 'cinderella').halfPoints, null);
});

test('Pufo fixed mode uses the worst pot-one performance and never a pot-four team', () => {
  const input = oracleInput();
  Object.assign(team(input, 'h'), { groupPoints: 0, groupGoalsAgainst: 20, totalGoalsAgainst: 20 });
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [{ id: 'b', halfPoints: 20 }]);
  drawTeam(input, 'h').pot = 1;
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [{ id: 'h', halfPoints: 20 }]);
});

test('Pufo same-finish order uses fewer group points, worse group GD, then fewer group goals', () => {
  const input = oracleInput(); drawTeam(input, 'h').pot = 1;
  const b = team(input, 'b'), h = team(input, 'h');
  Object.assign(h, { ...b, teamId: 'h', groupPoints: 1 });
  assert.equal(category(resolveOracleOutcomes(input), 'flop').awards[0].id, 'b');
  h.groupPoints = 0; h.groupGoalsAgainst = 7; h.totalGoalsAgainst = 7;
  assert.equal(category(resolveOracleOutcomes(input), 'flop').awards[0].id, 'h');
  b.groupGoalsFor = 2; b.groupGoalsAgainst = 8; b.totalGoalsFor = 2; b.totalGoalsAgainst = 8;
  assert.equal(category(resolveOracleOutcomes(input), 'flop').awards[0].id, 'h');
});

test('Pufo exact ties preserve both team IDs rather than using their display order', () => {
  const input = oracleInput(); drawTeam(input, 'h').pot = 1;
  Object.assign(team(input, 'h'), { ...team(input, 'b'), teamId: 'h' });
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [
    { id: 'b', halfPoints: 20 }, { id: 'h', halfPoints: 20 },
  ]);
  input.ruleset.policies.flop.ties = 'pending';
  assert.equal(category(scoreOraclePrediction(input), 'flop').status, 'policy_required');
});

for (const [finish, halfPoints] of [['group', 20], ['round_of_32', 14], ['round_of_16', 10], ['quarterfinal', 6]]) {
  test(`Pufo stage policy awards ${finish} its exact unmultiplied value`, () => {
    const input = oracleInput();
    input.ruleset.policies.flop = { mode: 'stage', sameStage: 'all', ties: 'all' };
    team(input, 'b').finish = finish;
    input.revision.picks.flop = 'b';
    assert.equal(category(scoreOraclePrediction(input), 'flop').halfPoints, halfPoints);
    input.revision.picks.flop = 'a';
    assert.equal(category(scoreOraclePrediction(input), 'flop').halfPoints, 0);
  });
}

test('Pufo stage allocation never invents an advantage for same-stage teams', () => {
  const input = oracleInput(); drawTeam(input, 'h').pot = 1;
  input.ruleset.policies.flop = { mode: 'stage', ties: 'all' };
  assert.equal(category(scoreOraclePrediction(input), 'flop').status, 'policy_required');
  input.ruleset.policies.flop.sameStage = 'all';
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [
    { id: 'b', halfPoints: 20 }, { id: 'h', halfPoints: 20 },
  ]);
  input.ruleset.policies.flop.sameStage = 'worst-only';
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [{ id: 'b', halfPoints: 20 }]);
});

test('stage Pufo worst-only resolves each exit stage instead of only the earliest one', () => {
  const input = oracleInput(); drawTeam(input, 'h').pot = 1;
  team(input, 'h').finish = 'round_of_16';
  input.ruleset.policies.flop = { mode: 'stage', sameStage: 'worst-only', ties: 'all' };
  assert.deepEqual(category(resolveOracleOutcomes(input), 'flop').awards, [
    { id: 'b', halfPoints: 20 }, { id: 'h', halfPoints: 10 },
  ]);
  assert.equal(category(scoreOraclePrediction(input), 'flop').halfPoints, 20);
  input.revision.picks.flop = 'h';
  assert.equal(category(scoreOraclePrediction(input), 'flop').halfPoints, 10);
});

test('worst goal difference uses the explicitly selected statistical scope', () => {
  const input = oracleInput(); team(input, 'g').totalGoalsAgainst = 30;
  assert.deepEqual(category(resolveOracleOutcomes(input), 'worstGoalDifference').awards, [{ id: 'b', halfPoints: 16 }]);
  input.ruleset.policies.worstGoalDifference.scope = 'tournament';
  assert.deepEqual(category(resolveOracleOutcomes(input), 'worstGoalDifference').awards, [{ id: 'g', halfPoints: 16 }]);
});

test('equal worst differences remain tied regardless of goals scored or team ID', () => {
  const input = oracleInput();
  Object.assign(team(input, 'h'), { groupGoalsFor: 3, groupGoalsAgainst: 8, totalGoalsFor: 3, totalGoalsAgainst: 8 });
  assert.deepEqual(category(resolveOracleOutcomes(input), 'worstGoalDifference').awards, [
    { id: 'b', halfPoints: 16 }, { id: 'h', halfPoints: 16 },
  ]);
  input.ruleset.policies.worstGoalDifference.ties = 'pending';
  assert.equal(category(scoreOraclePrediction(input), 'worstGoalDifference').status, 'policy_required');
});

test('input and returned records have no shared mutable references', () => {
  const input = oracleInput(), before = structuredClone(input);
  const output = scoreOraclePrediction(input), outcomes = resolveOracleOutcomes(input);
  output.categories[0].matchedIds.push('forged');
  outcomes.categories[0].awards[0].id = 'forged';
  assert.deepEqual(input, before);
  assert.equal(category(scoreOraclePrediction(input), 'champion').halfPoints, 40);
  assert.deepEqual(category(resolveOracleOutcomes(input), 'champion').awards, [{ id: 'a', halfPoints: 40 }]);
});

test('every version and identity mismatch fails before producing a score', () => {
  const mutations = [
    input => { input.result.tournamentId = 'other'; },
    input => { input.result.snapshotId = 'other'; },
    input => { input.revision.tournamentId = 'other'; },
    input => { input.revision.snapshotId = 'other'; },
    input => { input.revision.rulesetId = 'other'; },
    input => { input.ruleset.version = 'active-v1'; },
    input => { input.ruleset.status = 'active'; },
  ];
  for (const mutate of mutations) {
    const input = oracleInput(); mutate(input);
    assert.throws(() => scoreOraclePrediction(input));
  }
});

test('malformed scores, totals and rank snapshots are refused', () => {
  for (const field of ['groupPoints', 'groupGoalsFor', 'groupGoalsAgainst', 'totalGoalsFor', 'totalGoalsAgainst']) {
    for (const value of [undefined, null, -1, 0.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const input = oracleInput(); team(input, 'b')[field] = value;
      assert.throws(() => resolveOracleOutcomes(input));
    }
  }
  for (const value of [0, -1, 0.5, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    const input = oracleInput(); drawTeam(input, 'g').fifaRank = value;
    assert.throws(() => resolveOracleOutcomes(input));
  }
  const input = oracleInput(); team(input, 'a').totalGoalsFor = 0;
  assert.throws(() => resolveOracleOutcomes(input));
});

test('unknown or duplicate snapshot, result and award identities are refused', () => {
  const mutations = [
    input => { input.snapshot.teams.push({ ...input.snapshot.teams[0] }); },
    input => { input.snapshot.players.push({ ...input.snapshot.players[0] }); },
    input => { input.snapshot.players[0].teamId = 'unknown'; },
    input => { input.result.teams.push({ ...input.result.teams[0] }); },
    input => { input.result.teams[0].teamId = 'unknown'; },
    input => { input.result.awards.goldenBoot.winnerIds = ['unknown']; },
    input => { input.result.awards.goldenBoot.winnerIds = ['player-a', 'player-a']; },
  ];
  for (const mutate of mutations) {
    const input = oracleInput(); mutate(input); assert.throws(() => resolveOracleOutcomes(input));
  }
});

test('unknown picks, wrong cohorts, duplicate semifinalists and contradictory finalists are refused', () => {
  const mutations = [
    picks => { picks.extra = 'a'; }, picks => { picks.champion = 'unknown'; },
    picks => { picks.goldenBoot = 'a'; }, picks => { picks.cinderella = 'a'; },
    picks => { picks.flop = 'g'; }, picks => { picks.runnerUp = picks.champion; },
    picks => { picks.semifinalists = ['a', 'a']; },
    picks => { picks.semifinalists = ['a', 'b', 'c', 'd', 'e']; },
    picks => { picks.semifinalists = ['unknown']; },
  ];
  for (const mutate of mutations) {
    const input = oracleInput(); mutate(input.revision.picks); assert.throws(() => scoreOraclePrediction(input));
  }
});

test('malformed policy values cannot activate a guessed interpretation', () => {
  const policies = [
    null, [], { extra: 'all' }, { cinderellaTies: 'alphabetical' },
    { flop: null }, { flop: { mode: 'stage', sameStage: 'extra-points', ties: 'all' } },
    { flop: { mode: 'default', ties: 'all' } },
    { worstGoalDifference: { scope: 'season', ties: 'all' } },
    { worstGoalDifference: { scope: 'group', ties: 'alphabetical' } },
  ];
  for (const value of policies) {
    const input = oracleInput(); input.ruleset.policies = value;
    assert.throws(() => resolveOracleOutcomes(input));
  }
});

test('a complete final result rejects contradictory placement cardinality', () => {
  for (const [id, finish] of [['a', 'runner_up'], ['c', 'champion'], ['d', 'quarterfinal'], ['f', 'semifinal']]) {
    const input = oracleInput(); team(input, id).finish = finish;
    assert.throws(() => resolveOracleOutcomes(input));
  }
});

test('missing eligible cohorts cannot create a settled zero category', () => {
  for (const [pot, name] of [[4, 'cinderella'], [1, 'flop']]) {
    const input = oracleInput();
    for (const row of input.snapshot.teams) if (row.pot === pot) row.pot = 2;
    input.revision.picks[name] = null;
    const output = scoreOraclePrediction(input);
    assert.equal(category(output, name).status, 'pending');
    assert.equal(category(output, name).halfPoints, null);
    assert.equal(output.totalHalfPoints, null);
  }
});

test('a partial pick revision keeps its own identity without requiring all fields', () => {
  const input = oracleInput();
  input.revision.id = 'pick-revision-2'; input.revision.picks = { champion: 'a' };
  const output = scoreOraclePrediction(input);
  assert.equal(output.totalHalfPoints, 40);
  assert.equal(output.pickRevisionId, 'pick-revision-2');
  assert.equal(category(output, 'semifinalists').halfPoints, 0);
});

test('record flags require booleans rather than client-like truthy values', () => {
  for (const field of ['verified', 'final']) {
    for (const value of [undefined, null, 0, 1, 'true', []]) {
      const input = oracleInput(); input.result[field] = value;
      assert.throws(() => resolveOracleOutcomes(input));
    }
  }
  for (const value of [undefined, null, 0, 1, 'true']) {
    const input = oracleInput(); input.result.awards.goldenBoot.verified = value;
    assert.throws(() => resolveOracleOutcomes(input));
  }
});

test('identifiers must be normalized bounded strings', () => {
  for (const value of ['', ' a', 'a ', 'a'.repeat(129), null, 1, {}, []]) {
    for (const target of ['ruleset', 'snapshot', 'result', 'revision']) {
      const input = oracleInput(); input[target].id = value;
      assert.throws(() => scoreOraclePrediction(input));
    }
  }
});

test('reordering input records cannot change any score or winning tie', () => {
  const input = oracleInput(), expected = scoreOraclePrediction(input);
  input.snapshot.teams.reverse(); input.snapshot.players.reverse();
  input.result.teams.reverse(); input.revision.picks.semifinalists.reverse();
  assert.deepEqual(scoreOraclePrediction(input), expected);
});

test('invalid pots and player records cannot change cohort resolution', () => {
  for (const value of [0, 5, 1.5, null, '4']) {
    const input = oracleInput(); drawTeam(input, 'g').pot = value;
    assert.throws(() => resolveOracleOutcomes(input));
  }
  for (const value of [null, [], 'player']) {
    const input = oracleInput(); input.snapshot.players[0] = value;
    assert.throws(() => resolveOracleOutcomes(input));
  }
});

test('unknown award categories and result fields fail visibly', () => {
  const input = oracleInput(); input.result.awards.mostCards = { verified: true, winnerIds: ['player-a'] };
  assert.throws(() => resolveOracleOutcomes(input));
  const other = oracleInput(); other.result.clientTotal = 999;
  assert.throws(() => resolveOracleOutcomes(other));
  const top = oracleInput(); top.clientTotal = 999;
  assert.throws(() => resolveOracleOutcomes(top));
});

test('missing or malformed top-level records are rejected', () => {
  for (const value of [undefined, null, [], '', 1, true]) {
    assert.throws(() => resolveOracleOutcomes(value));
    assert.throws(() => scoreOraclePrediction(value));
    for (const key of ['ruleset', 'snapshot', 'result', 'revision']) {
      const input = oracleInput(); input[key] = value;
      assert.throws(() => scoreOraclePrediction(input));
    }
  }
});

test('record budgets reject oversized and sparse collections', () => {
  const mutations = [
    input => { input.snapshot.teams.length = 3; },
    input => { input.snapshot.teams = Array.from({ length: 257 }, (_, i) => ({ id: `team-${i}`, pot: 1, fifaRank: i + 1 })); },
    input => { input.snapshot.players = Array.from({ length: 8193 }, (_, i) => ({ id: `player-${i}`, teamId: 'a' })); },
    input => { delete input.snapshot.teams[3]; },
    input => { delete input.snapshot.players[3]; },
    input => { delete input.result.teams[3]; },
    input => { input.revision.picks.semifinalists = Array(4); },
    input => { input.result.awards.goldenBoot.winnerIds = Array(1); },
  ];
  for (const mutate of mutations) {
    const input = oracleInput(); mutate(input); assert.throws(() => scoreOraclePrediction(input));
  }
});

test('accessor records are refused without executing a getter', () => {
  let reads = 0;
  const input = oracleInput();
  Object.defineProperty(input.result, 'verified', { get() { reads++; return true; }, enumerable: true });
  assert.throws(() => resolveOracleOutcomes(input));
  assert.equal(reads, 0);
  const array = oracleInput();
  Object.defineProperty(array.snapshot.teams, '0', { get() { reads++; return { id: 'a', pot: 1, fifaRank: 1 }; }, enumerable: true });
  assert.throws(() => resolveOracleOutcomes(array));
  assert.equal(reads, 0);
});
