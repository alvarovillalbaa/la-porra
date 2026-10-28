import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotMatchWindow, evaluateMatchWindow, evaluateOracleWindow } from '../src/windows.mjs';

const kickoff = Date.UTC(2030, 5, 1, 20);

test('the kickoff snapshot locks one minute before revealing picks', () => {
  assert.deepEqual(snapshotMatchWindow(kickoff), { closesAt: kickoff - 60_000, picksRevealAt: kickoff });
});

test('one millisecond before cutoff remains editable and hidden', () => {
  assert.deepEqual(evaluateMatchWindow(snapshotMatchWindow(kickoff), kickoff - 60_001), {
    editable: true, closed: false, picksVisible: false,
  });
});

test('the cutoff instant is closed but still hidden', () => {
  assert.deepEqual(evaluateMatchWindow(snapshotMatchWindow(kickoff), kickoff - 60_000), {
    editable: false, closed: true, picksVisible: false,
  });
});

test('the minute before kickoff never reveals another member’s pick', () => {
  assert.equal(evaluateMatchWindow(snapshotMatchWindow(kickoff), kickoff - 1).picksVisible, false);
});

test('the kickoff instant reveals picks', () => {
  assert.deepEqual(evaluateMatchWindow(snapshotMatchWindow(kickoff), kickoff), {
    editable: false, closed: true, picksVisible: true,
  });
});

test('a persisted closure latch cannot reopen during a timing correction', () => {
  assert.equal(evaluateMatchWindow(snapshotMatchWindow(kickoff + 3_600_000), kickoff, { closed: true }).editable, false);
});

test('an earlier stored cutoff survives a later reveal time', () => {
  const window = { closesAt: kickoff - 60_000, picksRevealAt: kickoff + 3_600_000 };
  assert.deepEqual(evaluateMatchWindow(window, kickoff), { editable: false, closed: true, picksVisible: false });
});

test('unknown, invalid and ambiguous timing never silently allows edits', () => {
  for (const now of [undefined, NaN, Infinity, '2030-06-01', 0.5]) {
    assert.throws(() => evaluateMatchWindow(snapshotMatchWindow(kickoff), now), TypeError);
  }
  assert.throws(() => evaluateMatchWindow({}, kickoff), TypeError);
  assert.throws(() => evaluateMatchWindow(null, kickoff), TypeError);
  assert.throws(() => snapshotMatchWindow(-8_640_000_000_000_000), TypeError);
  assert.throws(() => evaluateMatchWindow({ closesAt: kickoff + 1, picksRevealAt: kickoff }, kickoff), RangeError);
  assert.throws(() => evaluateMatchWindow(snapshotMatchWindow(kickoff), kickoff, { closed: 'false' }), TypeError);
});

test('Oraculo picks may reveal at cutoff while its ranking stays hidden', () => {
  const window = { closesAt: kickoff - 3_600_000, picksRevealAt: kickoff - 3_600_000, rankingRevealAt: kickoff + 100_000 };
  assert.deepEqual(evaluateOracleWindow(window, window.closesAt), { editable: false, picksVisible: true, rankingVisible: false });
  assert.equal(evaluateOracleWindow(window, window.rankingRevealAt).rankingVisible, true);
});

test('Oraculo can keep both surfaces hidden until the selected end time', () => {
  const window = { closesAt: kickoff - 3_600_000, picksRevealAt: kickoff + 100_000, rankingRevealAt: kickoff + 100_000 };
  assert.deepEqual(evaluateOracleWindow(window, kickoff), { editable: false, picksVisible: false, rankingVisible: false });
});

test('Oraculo never supplies an implicit deadline or reveal policy', () => {
  assert.throws(() => evaluateOracleWindow({ closesAt: kickoff, picksRevealAt: kickoff }, kickoff), TypeError);
  assert.throws(() => evaluateOracleWindow({ closesAt: kickoff, picksRevealAt: kickoff, rankingRevealAt: kickoff - 1 }, kickoff), RangeError);
});

test('evaluating a stored window preserves its input', () => {
  const window = Object.freeze(snapshotMatchWindow(kickoff));
  evaluateMatchWindow(window, kickoff);
  assert.deepEqual(window, { closesAt: kickoff - 60_000, picksRevealAt: kickoff });
});
