import test from 'node:test';
import assert from 'node:assert/strict';
import { rankGroupTotals } from '../src/ranking.mjs';

test('settled half-point totals sort without rounding', () => {
  assert.deepEqual(rankGroupTotals([{ memberId: 'a', halfPoints: 20 }, { memberId: 'b', halfPoints: 21 }]), [
    { memberId: 'b', halfPoints: 21, rank: 1 }, { memberId: 'a', halfPoints: 20, rank: 2 },
  ]);
});

test('equal totals share a rank without inventing competitive tie-breaks', () => {
  assert.deepEqual(rankGroupTotals([{ memberId: 'b', halfPoints: 12 }, { memberId: 'c', halfPoints: 0 }, { memberId: 'a', halfPoints: 12 }]), [
    { memberId: 'a', halfPoints: 12, rank: 1 }, { memberId: 'b', halfPoints: 12, rank: 1 }, { memberId: 'c', halfPoints: 0, rank: 3 },
  ]);
});

test('input order and objects are preserved', () => {
  const rows = Object.freeze([Object.freeze({ memberId: 'b', halfPoints: 0 }), Object.freeze({ memberId: 'a', halfPoints: 10 })]);
  rankGroupTotals(rows);
  assert.equal(rows[0].memberId, 'b');
});

test('empty groups have no fabricated ranking members', () => {
  assert.deepEqual(rankGroupTotals([]), []);
});

test('ranking output contains only the approved public fields', () => {
  assert.deepEqual(rankGroupTotals([{ memberId: 'a', halfPoints: 0, unpublishedPick: 'authored private fixture' }]), [
    { memberId: 'a', halfPoints: 0, rank: 1 },
  ]);
});

test('invalid totals and duplicate or unnormalized members are rejected', () => {
  for (const halfPoints of [-1, 0.5, NaN, Infinity, '12', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => rankGroupTotals([{ memberId: 'a', halfPoints }]), TypeError);
  }
  assert.throws(() => rankGroupTotals([{ memberId: 'a', halfPoints: 0 }, { memberId: 'a', halfPoints: 1 }]), RangeError);
  assert.throws(() => rankGroupTotals([{ memberId: ' a ', halfPoints: 0 }]), TypeError);
  assert.throws(() => rankGroupTotals([null]), TypeError);
  assert.throws(() => rankGroupTotals({}), TypeError);
});
