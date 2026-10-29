import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvelope, ProtocolError, RANKING_FILTERS } from '../../public/src/protocol.mjs';

// Authored T2 parser cases only; no service, official-result verification or browser.
const time = '2026-10-28T12:00:00.000Z';
const context = () => ({ groupId: 'group', tournamentId: 'tournament', name: 'Torneo escrito', mode: 'replay',
  rulesetVersionId: 'fixture_rules', rulesState: 'draft', rules: [], pendingPolicies: ['Reglas sin activar'] });
const pointRows = () => [
  { memberId: 'b', displayName: 'Bea', rank: 1, pointsUnits: 21, settledCount: 3, pendingCount: 1 },
  { memberId: 'a', displayName: 'Ana', rank: 2, pointsUnits: 20, settledCount: 3, pendingCount: 1 },
];
const hitRows = () => [
  { memberId: 'a', displayName: 'Ana', rank: 1, exactHitCount: 2, settledMatchCount: 3 },
  { memberId: 'b', displayName: 'Bea', rank: 1, exactHitCount: 2, settledMatchCount: 3 },
];
const fixture = ({ filter = 'overall', visibility = 'visible', extension = true } = {}) => ({
  data: { context: context(), rankings: { filter, availableFilters: [...RANKING_FILTERS], visibility, computedAt: time,
    rows: visibility === 'visible' ? pointRows() : [],
    ...(extension ? { exactHitRanking: { computedAt: time, rows: visibility === 'visible' ? hitRows() : [] } } : {}) } },
  viewerId: 'viewer', serverTime: time,
});
const clone = value => structuredClone(value);
const parse = value => parseEnvelope('rankings', value, { groupId: 'group', filter: value.data.rankings.filter });
const ranking = value => value.data.rankings;
const reject = value => assert.throws(() => parse(value), error => {
  assert.ok(error instanceof ProtocolError); assert.equal(error.code, 'protocol_invalid'); return true;
});

test('legacy rankings omit the optional exact-hit field without changing their five required keys', () => {
  for (const filter of RANKING_FILTERS) {
    const input = fixture({ filter, extension: false });
    const output = parse(input);
    assert.deepEqual(output, input);
    assert.equal(Object.hasOwn(ranking(output), 'exactHitRanking'), false);
    assert.deepEqual(Object.keys(ranking(output)), ['filter', 'availableFilters', 'visibility', 'computedAt', 'rows']);
  }
});

test('explicit null exact-hit rankings remain null for every existing filter', () => {
  for (const filter of RANKING_FILTERS) {
    const input = fixture({ filter }); ranking(input).exactHitRanking = null;
    assert.equal(ranking(parse(input)).exactHitRanking, null);
  }
});

test('exact-hit rows preserve producer order, shared ranks and counts independently from point ranks', () => {
  const input = fixture();
  const output = ranking(parse(input));
  assert.deepEqual(output.rows, pointRows());
  assert.deepEqual(output.exactHitRanking.rows, hitRows());
  assert.deepEqual(output.exactHitRanking.rows.map(row => [row.memberId, row.rank]), [['a', 1], ['b', 1]]);
  for (const filter of RANKING_FILTERS.filter(value => value !== 'oracle')) {
    assert.deepEqual(ranking(parse(fixture({ filter }))).exactHitRanking.rows, hitRows());
  }
});

test('the optional ranking field does not loosen required parent or other envelope records', () => {
  for (const key of ['filter', 'availableFilters', 'visibility', 'computedAt', 'rows']) {
    const input = fixture(); delete ranking(input)[key]; reject(input);
  }
  for (const alter of [value => { ranking(value).unexpected = true; }, value => { value.data.unexpected = true; },
    value => { value.data.context.exactHitRanking = null; }, value => { value.unexpected = true; }]) {
    const input = fixture(); alter(input); reject(input);
  }
});

test('exact-hit ranking containers require precisely nullable computedAt and dense rows data', () => {
  for (const child of [undefined, [], true, {}, { computedAt: time }, { rows: [] },
    { computedAt: time, rows: [], pendingMatchCount: 1 }, { computedAt: time, rows: new Array(2) }]) {
    const input = fixture(); ranking(input).exactHitRanking = child; reject(input);
  }
  let reads = 0;
  const input = fixture();
  Object.defineProperty(ranking(input), 'exactHitRanking', { enumerable: true, get() { reads += 1; return null; } });
  reject(input); assert.equal(reads, 0);
  const hidden = fixture(); Object.defineProperty(ranking(hidden).exactHitRanking, 'rows', { value: hitRows(), enumerable: false }); reject(hidden);
  const symbolic = fixture(); ranking(symbolic).exactHitRanking[Symbol('extra')] = true; reject(symbolic);
});

test('exact-hit rows require all five fields and reject extra or malformed records', () => {
  for (const key of ['memberId', 'displayName', 'rank', 'exactHitCount', 'settledMatchCount']) {
    const input = fixture(); delete ranking(input).exactHitRanking.rows[0][key]; reject(input);
  }
  for (const row of [null, [], 'row', { ...hitRows()[0], pendingMatchCount: 1 }]) {
    const input = fixture(); ranking(input).exactHitRanking.rows[0] = row; reject(input);
  }
});

test('exact-hit counts are nonnegative safe integers bounded by settled matches', () => {
  for (const value of [-1, 0.5, NaN, Infinity, '2', Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['exactHitCount', 'settledMatchCount']) {
      const input = fixture(); ranking(input).exactHitRanking.rows[0][key] = value; reject(input);
    }
  }
  const excessive = fixture(); ranking(excessive).exactHitRanking.rows[0].exactHitCount = 4; reject(excessive);
  const zero = fixture(); Object.assign(ranking(zero).exactHitRanking.rows[0], { exactHitCount: 0, settledMatchCount: 0 });
  assert.equal(ranking(parse(zero)).exactHitRanking.rows[0].exactHitCount, 0);
  const maximum = fixture(); Object.assign(ranking(maximum).exactHitRanking.rows[0], { exactHitCount: Number.MAX_SAFE_INTEGER, settledMatchCount: Number.MAX_SAFE_INTEGER });
  assert.equal(ranking(parse(maximum)).exactHitRanking.rows[0].exactHitCount, Number.MAX_SAFE_INTEGER);
});

test('exact-hit member metadata and supplied ranks remain strictly typed and bounded', () => {
  for (const [key, values] of [
    ['memberId', ['', 'foreign/member', 'a'.repeat(129)]],
    ['displayName', ['', ' ', 'a'.repeat(201), '\0', '\ud800']],
    ['rank', [0, -1, 1.5, '1', Infinity, Number.MAX_SAFE_INTEGER + 1]],
  ]) {
    for (const value of values) { const input = fixture(); ranking(input).exactHitRanking.rows[0][key] = value; reject(input); }
  }
});

test('exact-hit computedAt accepts explicit null or UTC ISO timestamps without fallback', () => {
  const withoutTime = fixture(); ranking(withoutTime).exactHitRanking.computedAt = null;
  assert.equal(ranking(parse(withoutTime)).exactHitRanking.computedAt, null);
  for (const value of [undefined, 0, '', '2026-10-28', '2026-10-28T12:00:00+00:00', '2026-02-30T12:00:00.000Z']) {
    const input = fixture(); ranking(input).exactHitRanking.computedAt = value; reject(input);
  }
});

test('visible exact-hit rankings require the entire matching member cohort and display names', () => {
  for (const alter of [rows => rows.pop(), rows => rows.push({ ...rows[0], memberId: 'foreign', displayName: 'Otra' }),
    rows => { rows[0].memberId = 'foreign'; }, rows => { rows[0].displayName = 'Otro nombre'; },
    rows => { rows[1] = { ...rows[0] }; }, rows => { rows.length = 0; }]) {
    const input = fixture(); alter(ranking(input).exactHitRanking.rows); reject(input);
  }
  const empty = fixture(); ranking(empty).rows = []; ranking(empty).exactHitRanking.rows = [];
  assert.deepEqual(ranking(parse(empty)).exactHitRanking.rows, []);
});

test('hidden parent rankings cannot expose exact-hit rows even when point rows are empty', () => {
  const input = fixture({ visibility: 'hidden' });
  assert.deepEqual(ranking(parse(input)).exactHitRanking.rows, []);
  ranking(input).exactHitRanking.rows = hitRows(); reject(input);
  const parentLeak = fixture({ visibility: 'hidden' }); ranking(parentLeak).rows = pointRows(); reject(parentLeak);
});

test('Oráculo rankings reject every nonnull exact-hit extension including an empty hidden card', () => {
  for (const visibility of ['visible', 'hidden']) {
    const input = fixture({ filter: 'oracle', visibility }); reject(input);
    ranking(input).exactHitRanking.rows = []; reject(input);
    ranking(input).exactHitRanking = null; assert.equal(ranking(parse(input)).exactHitRanking, null);
  }
});

test('exact-hit aggregates do not admit private picks, result provenance or a second context', () => {
  for (const key of ['prediction', 'predictionRevisionId', 'resultRevisionId', 'matchId', 'qualifierId']) {
    const input = fixture(); ranking(input).exactHitRanking.rows[0][key] = 'private_fixture'; reject(input);
  }
  for (const key of ['context', 'filter', 'visibility', 'source', 'revisions']) {
    const input = fixture(); ranking(input).exactHitRanking[key] = 'private_fixture'; reject(input);
  }
  const wrongGroup = fixture(); wrongGroup.data.context.groupId = 'other_group'; reject(wrongGroup);
  assert.throws(() => parseEnvelope('rankings', fixture(), { groupId: 'group', filter: 'matchday' }), ProtocolError);
  const anonymous = fixture(); anonymous.viewerId = null; reject(anonymous);
});

test('parsed exact-hit envelopes are detached and deeply frozen without changing input', () => {
  const input = fixture(), before = clone(input), output = parse(input);
  assert.deepEqual(input, before); assert.deepEqual(output, before);
  assert.notEqual(output, input); assert.notEqual(ranking(output).exactHitRanking, ranking(input).exactHitRanking);
  assert.notEqual(ranking(output).exactHitRanking.rows, ranking(input).exactHitRanking.rows);
  for (const value of [output, output.data, output.data.context, ranking(output), ranking(output).exactHitRanking,
    ranking(output).exactHitRanking.rows, ranking(output).exactHitRanking.rows[0]]) assert.equal(Object.isFrozen(value), true);
  ranking(input).exactHitRanking.rows[0].exactHitCount = 0;
  assert.equal(ranking(output).exactHitRanking.rows[0].exactHitCount, 2);
  assert.throws(() => { ranking(output).exactHitRanking.rows[0].exactHitCount = 0; }, TypeError);
});
