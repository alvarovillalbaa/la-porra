import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateExactScoreHits, EXACT_HIT_AGGREGATION_VERSION } from '../../src/exact-hits.mjs';
import { RULESET_VERSION, scoreMatchPrediction } from '../../src/scoring.mjs';

// T2 selected revision records, never real tournament data or server authorization.
const scope = () => ({ groupId: 'group-a', tournamentId: 'tournament-a', mode: 'archive', rulesetVersionId: 'rules-a' });
function settlement({ memberId = 'alice', matchId = 'match-1', round = 'group',
  predictionId = `prediction-${memberId}-${matchId}`, resultId = `result-${matchId}`,
  predictionScore = { home: 2, away: 1 }, resultScore = { home: 2, away: 1 } } = {}) {
  return {
    prediction: { id: predictionId, ...scope(), memberId, matchId, score: { ...predictionScore } },
    result: { id: resultId, tournamentId: 'tournament-a', mode: 'archive', matchId, round,
      verified: true, final: true, score: { ...resultScore } },
  };
}
function selection({ memberIds = ['alice'], settlements = [settlement()] } = {}) {
  return { selectionId: 'selection-a', scope: scope(),
    ruleset: { id: 'rules-a', version: RULESET_VERSION, status: 'draft' }, memberIds, settlements };
}
function changed(value, edit) { const copy = structuredClone(value); edit(copy); return copy; }
function row(report, memberId = 'alice') { return report.rows.find(value => value.memberId === memberId); }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function assertFrozen(value) {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(assertFrozen); }
}

test('the versioned empty selection reports only its explicit empty scope and coverage', () => {
  assert.equal(EXACT_HIT_AGGREGATION_VERSION, 'research-2026-exact-hits-v1');
  const input = selection({ memberIds: [], settlements: [] });
  assert.deepEqual(aggregateExactScoreHits(input), {
    version: EXACT_HIT_AGGREGATION_VERSION, selectionId: input.selectionId, scope: input.scope,
    ruleset: input.ruleset, rows: [], provenance: [],
    coverage: { memberCount: 0, selectedMatchCount: 0, selectedPredictionCount: 0 },
  });
});

test('explicit roster members without selected settlements share zero without fabricated matches', () => {
  const result = aggregateExactScoreHits(selection({ memberIds: ['zoe', 'alice'], settlements: [] }));
  assert.deepEqual(result.rows, [
    { memberId: 'alice', exactHitCount: 0, settledMatchCount: 0, rank: 1 },
    { memberId: 'zoe', exactHitCount: 0, settledMatchCount: 0, rank: 1 },
  ]);
  assert.deepEqual(result.coverage, { memberCount: 2, selectedMatchCount: 0, selectedPredictionCount: 0 });
});

test('exact home wins away wins draws and goalless draws each count one match', () => {
  for (const [home, away] of [[2, 1], [1, 2], [1, 1], [0, 0]]) {
    const result = aggregateExactScoreHits(selection({ settlements: [settlement({
      predictionScore: { home, away }, resultScore: { home, away },
    })] }));
    assert.deepEqual(row(result), { memberId: 'alice', exactHitCount: 1, settledMatchCount: 1, rank: 1 });
    assert.equal(result.provenance[0].exactHit, true);
  }
});

test('correct sign difference or draw category never substitutes for the complete exact score', () => {
  for (const [predictionScore, resultScore] of [
    [{ home: 3, away: 1 }, { home: 2, away: 0 }],
    [{ home: 2, away: 0 }, { home: 1, away: 0 }],
    [{ home: 1, away: 1 }, { home: 2, away: 2 }],
    [{ home: 1, away: 0 }, { home: 0, away: 1 }],
  ]) {
    const result = aggregateExactScoreHits(selection({ settlements: [settlement({ predictionScore, resultScore })] }));
    assert.equal(row(result).exactHitCount, 0); assert.equal(row(result).settledMatchCount, 1);
    assert.equal(result.provenance[0].exactHit, false);
  }
});

test('a wrong independent knockout qualifier does not erase an exact score hit', () => {
  const pair = settlement({ round: 'quarterfinal', predictionScore: { home: 2, away: 1, qualifier: 'away' },
    resultScore: { home: 2, away: 1, qualifier: 'home' } });
  assert.equal(scoreMatchPrediction({ round: pair.result.round, prediction: pair.prediction.score,
    result: pair.result.score }).qualifierHalfPoints, 0);
  assert.equal(row(aggregateExactScoreHits(selection({ settlements: [pair] }))).exactHitCount, 1);
});

test('equal fifteen-half-point totals distinguish an exact score from difference plus qualifier', () => {
  const exact = settlement({ round: 'quarterfinal', predictionScore: { home: 2, away: 1, qualifier: 'away' },
    resultScore: { home: 2, away: 1, qualifier: 'home' } });
  const difference = settlement({ memberId: 'bob', matchId: 'match-2', round: 'quarterfinal',
    predictionScore: { home: 3, away: 1, qualifier: 'home' }, resultScore: { home: 2, away: 0, qualifier: 'home' } });
  for (const pair of [exact, difference]) assert.equal(scoreMatchPrediction({
    round: pair.result.round, prediction: pair.prediction.score, result: pair.result.score,
  }).totalHalfPoints, 15);
  const result = aggregateExactScoreHits(selection({ memberIds: ['bob', 'alice'], settlements: [difference, exact] }));
  assert.equal(row(result, 'alice').exactHitCount, 1); assert.equal(row(result, 'bob').exactHitCount, 0);
  assert.deepEqual(result.rows.map(value => [value.memberId, value.rank]), [['alice', 1], ['bob', 2]]);
});

test('each match counts once across all rounds regardless of multipliers and bonus policy', () => {
  const rounds = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];
  const input = selection({ settlements: rounds.map((round, index) => settlement({ round, matchId: `match-${index}`,
    predictionScore: { home: 2, away: 1, qualifier: round === 'group' ? null : 'home' },
    resultScore: { home: 2, away: 1, qualifier: round === 'group' ? null : 'home' } })) });
  input.ruleset.thirdPlaceBonus = 'none';
  const result = aggregateExactScoreHits(input);
  assert.equal(row(result).exactHitCount, 7); assert.equal(row(result).settledMatchCount, 7);
  assert.deepEqual(result.coverage, { memberCount: 1, selectedMatchCount: 7, selectedPredictionCount: 7 });
  assert.equal(result.ruleset.thirdPlaceBonus, 'none');
});

test('exact-count ties share competition rank despite different denominators and input order', () => {
  const input = selection({ memberIds: ['cara', 'bob', 'alice'], settlements: [
    settlement({ memberId: 'bob', matchId: 'match-3', predictionScore: { home: 0, away: 0 } }),
    settlement({ memberId: 'cara' }), settlement({ memberId: 'bob', matchId: 'match-2' }),
    settlement({ memberId: 'alice', matchId: 'match-2' }), settlement({ memberId: 'bob' }), settlement(),
  ] });
  const result = aggregateExactScoreHits(input);
  assert.deepEqual(result.rows, [
    { memberId: 'alice', exactHitCount: 2, settledMatchCount: 2, rank: 1 },
    { memberId: 'bob', exactHitCount: 2, settledMatchCount: 3, rank: 1 },
    { memberId: 'cara', exactHitCount: 1, settledMatchCount: 1, rank: 3 },
  ]);
  const reversed = changed(input, value => { value.memberIds.reverse(); value.settlements.reverse(); });
  assert.deepEqual(aggregateExactScoreHits(reversed), result);
  assert.deepEqual(result.provenance.map(value => [value.memberId, value.matchId]), [
    ['alice', 'match-1'], ['alice', 'match-2'], ['bob', 'match-1'], ['bob', 'match-2'], ['bob', 'match-3'], ['cara', 'match-1'],
  ]);
});

test('a corrected selected result replaces the previous hit and preserves both snapshot identities', () => {
  const original = selection();
  const before = aggregateExactScoreHits(original);
  const corrected = changed(original, value => {
    value.selectionId = 'selection-corrected'; value.settlements[0].result.id = 'result-revision-2';
    value.settlements[0].result.score = { home: 3, away: 1 };
  });
  const after = aggregateExactScoreHits(corrected);
  assert.equal(row(before).exactHitCount, 1); assert.equal(row(after).exactHitCount, 0);
  assert.equal(row(after).settledMatchCount, 1); assert.equal(after.coverage.selectedPredictionCount, 1);
  assert.equal(before.provenance[0].resultRevisionId, 'result-match-1');
  assert.equal(after.provenance[0].resultRevisionId, 'result-revision-2');
  assert.equal(after.selectionId, 'selection-corrected'); assert.equal(before.selectionId, 'selection-a');
});

test('selecting a replacement prediction revision counts its current intent once', () => {
  const original = selection({ settlements: [settlement({ predictionScore: { home: 0, away: 0 } })] });
  const corrected = changed(original, value => {
    value.selectionId = 'selection-pick-2'; value.settlements[0].prediction.id = 'prediction-revision-2';
    value.settlements[0].prediction.score = { home: 2, away: 1 };
  });
  assert.equal(row(aggregateExactScoreHits(original)).exactHitCount, 0);
  const result = aggregateExactScoreHits(corrected);
  assert.equal(row(result).exactHitCount, 1); assert.equal(row(result).settledMatchCount, 1);
  assert.equal(result.provenance[0].predictionRevisionId, 'prediction-revision-2');
});

test('a shared selected result counts one distinct match and one prediction for each member', () => {
  const result = aggregateExactScoreHits(selection({ memberIds: ['alice', 'bob', 'cara'],
    settlements: ['cara', 'bob', 'alice'].map(memberId => settlement({ memberId })) }));
  assert.deepEqual(result.coverage, { memberCount: 3, selectedMatchCount: 1, selectedPredictionCount: 3 });
  assert.ok(result.rows.every(value => value.exactHitCount === 1 && value.settledMatchCount === 1 && value.rank === 1));
  assert.ok(result.provenance.every(value => value.resultRevisionId === 'result-match-1'));
});

test('repeating the identical selected pair is rejected rather than counted or silently deduplicated', () => {
  const pair = settlement();
  assert.throws(() => aggregateExactScoreHits(selection({ settlements: [pair, structuredClone(pair)] })));
});

test('two revisions for one member and match cannot masquerade as a selected history', () => {
  const old = settlement({ predictionId: 'prediction-old', resultId: 'result-old' });
  const latest = settlement({ predictionId: 'prediction-new', resultId: 'result-new' });
  for (const settlements of [[old, latest], [latest, old]]) {
    assert.throws(() => aggregateExactScoreHits(selection({ settlements })));
  }
});

test('one prediction revision identity cannot be reused for a different member or match', () => {
  for (const other of [settlement({ memberId: 'bob', predictionId: 'prediction-alice-match-1' }),
    settlement({ matchId: 'match-2', predictionId: 'prediction-alice-match-1' })]) {
    assert.throws(() => aggregateExactScoreHits(selection({ memberIds: ['alice', 'bob'], settlements: [settlement(), other] })));
  }
});

test('one result revision identity cannot be rebound to a different match', () => {
  assert.throws(() => aggregateExactScoreHits(selection({ settlements: [settlement(),
    settlement({ matchId: 'match-2', resultId: 'result-match-1' })] })));
});

test('members of one match must share a coherent selected result while absent and null qualifiers normalize', () => {
  const base = selection({ memberIds: ['alice', 'bob'], settlements: [
    settlement({ round: 'quarterfinal', predictionScore: { home: 2, away: 1, qualifier: 'home' }, resultScore: { home: 2, away: 1, qualifier: 'home' } }),
    settlement({ memberId: 'bob', round: 'quarterfinal', predictionScore: { home: 2, away: 1, qualifier: 'home' }, resultScore: { home: 2, away: 1, qualifier: 'home' } }),
  ] });
  for (const edit of [value => { value.id = 'result-other-revision'; }, value => { value.score.home = 3; },
    value => { value.round = 'final'; }, value => { value.score.qualifier = 'away'; }]) {
    assert.throws(() => aggregateExactScoreHits(changed(base, value => edit(value.settlements[1].result))));
  }
  const normalized = selection({ memberIds: ['alice', 'bob'], settlements: [settlement(),
    settlement({ memberId: 'bob', resultScore: { home: 2, away: 1, qualifier: null } })] });
  assert.equal(aggregateExactScoreHits(normalized).coverage.selectedMatchCount, 1);
});

test('group tournament mode and ruleset bindings cannot cross a captured selection scope', () => {
  for (const [side, key, value] of [
    ['prediction', 'groupId', 'another-group'], ['prediction', 'tournamentId', 'another-tournament'],
    ['prediction', 'mode', 'live'], ['prediction', 'rulesetVersionId', 'another-ruleset'],
    ['result', 'tournamentId', 'another-tournament'], ['result', 'mode', 'replay'], ['result', 'matchId', 'another-match'],
  ]) assert.throws(() => aggregateExactScoreHits(changed(selection(), input => { input.settlements[0][side][key] = value; })));
  for (const mode of ['live', 'archive', 'replay']) {
    const input = changed(selection(), value => {
      value.scope.mode = mode; value.settlements[0].prediction.mode = mode; value.settlements[0].result.mode = mode;
    });
    assert.equal(aggregateExactScoreHits(input).scope.mode, mode);
  }
  assert.throws(() => aggregateExactScoreHits(changed(selection(), value => { value.scope.mode = 'automatic'; })));
});

test('draft version and explicit bronze policies remain validation inputs rather than activation', () => {
  for (const edit of [value => { value.status = 'active'; }, value => { delete value.status; },
    value => { value.version = 'unapproved-v2'; }, value => { value.id = 'unbound-rules'; },
    value => { value.thirdPlaceBonus = 'automatic'; }]) {
    assert.throws(() => aggregateExactScoreHits(changed(selection(), input => edit(input.ruleset))));
  }
  const bronze = selection({ settlements: [settlement({ round: 'third_place' })] });
  assert.throws(() => aggregateExactScoreHits(bronze));
  for (const policy of ['none', 'winner']) {
    const input = changed(bronze, value => {
      value.ruleset.thirdPlaceBonus = policy;
      if (policy === 'winner') {
        value.settlements[0].prediction.score.qualifier = 'home'; value.settlements[0].result.score.qualifier = 'home';
      }
    });
    const result = aggregateExactScoreHits(input);
    assert.equal(row(result).exactHitCount, 1); assert.equal(result.ruleset.status, 'draft');
    assert.equal(result.ruleset.thirdPlaceBonus, policy);
  }
});

test('unknown prediction members and duplicate roster entries never fabricate membership', () => {
  for (const memberIds of [[], ['bob'], ['alice', 'alice']]) {
    assert.throws(() => aggregateExactScoreHits(selection({ memberIds })));
  }
  for (const memberIds of [null, {}, 'alice']) assert.throws(() => aggregateExactScoreHits(selection({ memberIds })));
});

test('unverified unfinished or absent settlement flags are not counted as misses or zeros', () => {
  for (const key of ['verified', 'final']) {
    for (const flag of [false, null, 0, 'true']) {
      assert.throws(() => aggregateExactScoreHits(changed(selection(), value => { value.settlements[0].result[key] = flag; })));
    }
    assert.throws(() => aggregateExactScoreHits(changed(selection(), value => { delete value.settlements[0].result[key]; })));
  }
  const zero = aggregateExactScoreHits(selection({ settlements: [settlement({
    predictionScore: { home: 1, away: 0 }, resultScore: { home: 0, away: 0 },
  })] }));
  assert.equal(row(zero).settledMatchCount, 1); assert.equal(row(zero).exactHitCount, 0);
});

test('strict data records dense arrays and unknown fields reject without invoking score accessors', () => {
  for (const value of [null, [], new Date(0)]) assert.throws(() => aggregateExactScoreHits(value));
  for (const edit of [value => { value.points = 100; }, value => { value.scope.admin = true; },
    value => { value.ruleset.activated = true; }, value => { value.settlements[0].total = 999; },
    value => { value.settlements[0].prediction.latest = true; }, value => { value.settlements[0].prediction.score.points = 5; },
    value => { value.settlements[0].result.sourceUrl = 'https://authored.invalid/'; }]) {
    assert.throws(() => aggregateExactScoreHits(changed(selection(), edit)));
  }
  for (const key of ['memberIds', 'settlements']) assert.throws(() => aggregateExactScoreHits(changed(selection(), value => { value[key] = new Array(1); })));
  const custom = selection();
  custom.settlements[0].prediction.score = Object.assign(Object.create({ inherited: true }), { home: 2, away: 1 });
  assert.throws(() => aggregateExactScoreHits(custom));
  let reads = 0;
  const accessor = selection();
  Object.defineProperty(accessor.settlements[0].prediction.score, 'home', { enumerable: true, get() { reads += 1; return 2; } });
  assert.throws(() => aggregateExactScoreHits(accessor)); assert.equal(reads, 0);
});

test('ASCII identity and canonical score validation reject coercion while preserving safe boundaries', () => {
  for (const invalid of ['', ' leading', 'trailing ', 'é', 'bad.id', 'x\0y', 'x'.repeat(129), 1, null]) {
    for (const edit of [value => { value.selectionId = invalid; }, value => { value.settlements[0].prediction.id = invalid; },
      value => { value.settlements[0].result.id = invalid; }, value => {
        value.memberIds = [invalid]; value.settlements[0].prediction.memberId = invalid;
      }, value => { value.settlements[0].prediction.matchId = invalid; value.settlements[0].result.matchId = invalid; }]) {
      assert.throws(() => aggregateExactScoreHits(changed(selection(), edit)));
    }
  }
  for (const side of ['prediction', 'result']) for (const key of ['home', 'away']) {
    for (const invalid of [-1, 0.5, true, '2', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => aggregateExactScoreHits(changed(selection(), value => { value.settlements[0][side].score[key] = invalid; })));
    }
  }
  const maximum = selection({ memberIds: ['__proto__'], settlements: [settlement({ memberId: '__proto__',
    predictionScore: { home: Number.MAX_SAFE_INTEGER, away: 0 }, resultScore: { home: Number.MAX_SAFE_INTEGER, away: 0 } })] });
  maximum.selectionId = 'x'.repeat(128);
  const result = aggregateExactScoreHits(maximum);
  assert.equal(row(result, '__proto__').exactHitCount, 1); assert.equal(result.selectionId, maximum.selectionId);
});

test('results are detached deeply frozen private-safe projections and inputs remain unchanged', () => {
  const input = freeze(selection());
  const before = structuredClone(input);
  const result = aggregateExactScoreHits(input);
  assert.deepEqual(input, before); assertFrozen(result);
  assert.notEqual(result.scope, input.scope); assert.notEqual(result.ruleset, input.ruleset);
  assert.deepEqual(Object.keys(result.rows[0]).sort(), ['memberId', 'exactHitCount', 'settledMatchCount', 'rank'].sort());
  assert.deepEqual(Object.keys(result.provenance[0]).sort(), [
    'memberId', 'matchId', 'predictionRevisionId', 'resultRevisionId', 'rulesetVersionId', 'exactHit',
  ].sort());
  for (const privateKey of ['score', 'home', 'away', 'qualifier', 'totalHalfPoints', 'pointsUnits', 'halfPoints', 'pendingCount']) {
    assert.equal(JSON.stringify(result).includes(`"${privateKey}":`), false);
  }
  assert.throws(() => result.rows.push({}), TypeError);
  assert.throws(() => { result.rows[0].exactHitCount = 999; }, TypeError);
  const editable = selection(), detached = aggregateExactScoreHits(editable);
  editable.scope.groupId = 'different-group'; editable.settlements[0].prediction.score.home = 9;
  assert.equal(detached.scope.groupId, 'group-a'); assert.equal(row(detached).exactHitCount, 1);
});

test('explicit input budgets bound roster and settlement work without inventing tournament size', () => {
  const memberIds = Array.from({ length: 10_000 }, (_, index) => `member-${index}`);
  const result = aggregateExactScoreHits(selection({ memberIds, settlements: [] }));
  assert.equal(result.rows.length, 10_000); assert.equal(result.coverage.memberCount, 10_000);
  assert.equal(result.coverage.selectedPredictionCount, 0);
  assert.throws(() => aggregateExactScoreHits(selection({ memberIds: [...memberIds, 'member-over-limit'], settlements: [] })));
  const settlements = Array.from({ length: 100_001 }, (_, index) => settlement({ matchId: `budget-match-${index}` }));
  assert.throws(() => aggregateExactScoreHits(selection({ settlements })));
});
