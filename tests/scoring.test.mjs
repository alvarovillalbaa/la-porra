import test from 'node:test';
import assert from 'node:assert/strict';
import { RULESET_VERSION, scoreMatchPrediction } from '../src/scoring.mjs';

// Authored analytical inputs, not tournament fixtures or accepted pick policy.
const SCORE_CASES = [
  ['exact home win', [2, 1], [2, 1], 5],
  ['exact away win', [1, 2], [1, 2], 5],
  ['exact draw', [1, 1], [1, 1], 5],
  ['exact goalless draw', [0, 0], [0, 0], 5],
  ['home winner and exact difference', [3, 1], [2, 0], 3],
  ['away winner and exact difference', [1, 3], [0, 2], 3],
  ['non-exact scoring draw', [1, 1], [2, 2], 2],
  ['non-exact goalless prediction', [0, 0], [1, 1], 2],
  ['home sign without the difference', [1, 0], [4, 0], 1],
  ['away sign without the difference', [0, 1], [0, 4], 1],
  ['home prediction misses away win', [1, 0], [0, 1], 0],
  ['away prediction misses home win', [0, 1], [1, 0], 0],
  ['home prediction misses draw', [1, 0], [1, 1], 0],
  ['away prediction misses draw', [0, 1], [1, 1], 0],
  ['draw prediction misses home win', [1, 1], [1, 0], 0],
  ['draw prediction misses away win', [1, 1], [0, 1], 0],
];

for (const [name, prediction, result, expectedBase] of SCORE_CASES) {
  test(`base-score precedence: ${name}`, () => {
    assert.deepEqual(scoreMatchPrediction({
      round: 'group',
      prediction: { home: prediction[0], away: prediction[1] },
      result: { home: result[0], away: result[1] },
    }), {
      basePoints: expectedBase,
      scoreHalfPoints: expectedBase * 2,
      qualifierHalfPoints: 0,
      totalHalfPoints: expectedBase * 2,
    });
  });
}

const ROUND_CASES = [
  ['group', 10],
  ['round_of_32', 10],
  ['round_of_16', 10],
  ['quarterfinal', 15],
  ['semifinal', 20],
  ['third_place', 20],
  ['final', 30],
];

for (const [round, expectedScore] of ROUND_CASES) {
  test(`round score uses exact half-point units: ${round}`, () => {
    const qualifier = round === 'group' ? null : 'away';
    assert.deepEqual(scoreMatchPrediction({
      round,
      prediction: { home: 2, away: 1, qualifier },
      result: { home: 2, away: 1, qualifier: round === 'group' ? null : 'home' },
      thirdPlaceBonus: round === 'third_place' ? 'none' : undefined,
    }), {
      basePoints: 5,
      scoreHalfPoints: expectedScore,
      qualifierHalfPoints: 0,
      totalHalfPoints: expectedScore,
    });
  });
}

const BONUS_CASES = [
  ['round_of_32', 6],
  ['round_of_16', 6],
  ['quarterfinal', 6],
  ['semifinal', 6],
  ['third_place', 6],
  ['final', 10],
];

for (const [round, expectedBonus] of BONUS_CASES) {
  test(`qualifier bonus is independent of a missed score: ${round}`, () => {
    assert.deepEqual(scoreMatchPrediction({
      round,
      prediction: { home: 2, away: 0, qualifier: 'away' },
      result: { home: 0, away: 2, qualifier: 'away' },
      thirdPlaceBonus: round === 'third_place' ? 'winner' : undefined,
    }), {
      basePoints: 0,
      scoreHalfPoints: 0,
      qualifierHalfPoints: expectedBonus,
      totalHalfPoints: expectedBonus,
    });
  });
}

test('rules remain explicitly labelled as research', () => {
  assert.equal(RULESET_VERSION, 'research-2026-v1');
});

test('an exact quarterfinal and qualifier total 10.5 points without rounding', () => {
  assert.deepEqual(scoreMatchPrediction({
    round: 'quarterfinal',
    prediction: { home: 1, away: 1, qualifier: 'home' },
    result: { home: 1, away: 1, qualifier: 'home' },
  }), { basePoints: 5, scoreHalfPoints: 15, qualifierHalfPoints: 6, totalHalfPoints: 21 });
});

test('the final multiplies score points but not its qualification bonus', () => {
  assert.deepEqual(scoreMatchPrediction({
    round: 'final',
    prediction: { home: 2, away: 1, qualifier: 'home' },
    result: { home: 2, away: 1, qualifier: 'home' },
  }), { basePoints: 5, scoreHalfPoints: 30, qualifierHalfPoints: 10, totalHalfPoints: 40 });
});

test('third place requires an explicit winner-bonus or no-bonus choice', () => {
  const input = {
    round: 'third_place',
    prediction: { home: 2, away: 1, qualifier: 'home' },
    result: { home: 2, away: 1, qualifier: 'home' },
  };
  assert.deepEqual(scoreMatchPrediction({ ...input, thirdPlaceBonus: 'winner' }), {
    basePoints: 5, scoreHalfPoints: 20, qualifierHalfPoints: 6, totalHalfPoints: 26,
  });
  assert.deepEqual(scoreMatchPrediction({ ...input, thirdPlaceBonus: 'none' }), {
    basePoints: 5, scoreHalfPoints: 20, qualifierHalfPoints: 0, totalHalfPoints: 20,
  });
});

test('group qualifiers may be absent or null without earning a bonus', () => {
  const absent = { round: 'group', prediction: { home: 1, away: 1 }, result: { home: 2, away: 2 } };
  assert.deepEqual(scoreMatchPrediction(absent), scoreMatchPrediction({
    ...absent, prediction: { ...absent.prediction, qualifier: null }, result: { ...absent.result, qualifier: null },
  }));
  assert.equal(scoreMatchPrediction(absent).totalHalfPoints, 4);
});

test('safe-integer goal boundaries retain exact winner differences', () => {
  assert.deepEqual(scoreMatchPrediction({
    round: 'group',
    prediction: { home: Number.MAX_SAFE_INTEGER - 1, away: Number.MAX_SAFE_INTEGER },
    result: { home: 1, away: 2 },
  }), { basePoints: 3, scoreHalfPoints: 6, qualifierHalfPoints: 0, totalHalfPoints: 6 });
});

test('scoring does not mutate its inputs or nested records', () => {
  const prediction = Object.freeze({ home: 1, away: 1, qualifier: 'home' });
  const result = Object.freeze({ home: 2, away: 2, qualifier: 'away' });
  const input = Object.freeze({ round: 'quarterfinal', prediction, result });
  const snapshot = structuredClone(input);
  assert.deepEqual(scoreMatchPrediction(input), {
    basePoints: 2, scoreHalfPoints: 6, qualifierHalfPoints: 0, totalHalfPoints: 6,
  });
  assert.deepEqual(input, snapshot);
});

function validInput(round = 'round_of_16') {
  return {
    round,
    prediction: { home: 1, away: 0, qualifier: 'home' },
    result: { home: 2, away: 0, qualifier: 'home' },
    ...(round === 'third_place' ? { thirdPlaceBonus: 'none' } : {}),
  };
}

test('non-record scoring inputs are rejected', () => {
  for (const value of [undefined, null, [], '', 1, true]) {
    assert.throws(() => scoreMatchPrediction(value), TypeError);
  }
});

test('unknown rounds and inherited property names are rejected', () => {
  for (const round of [undefined, null, '', 'GROUP', 'round_of_64', '__proto__', 'toString', 1, new String('group')]) {
    assert.throws(() => scoreMatchPrediction({ ...validInput(), round }), RangeError);
  }
});

test('prediction and result must each be score records', () => {
  for (const side of ['prediction', 'result']) {
    for (const value of [undefined, null, [], '1-0', 1, false]) {
      assert.throws(() => scoreMatchPrediction({ ...validInput(), [side]: value }), TypeError);
    }
  }
});

test('every goal field rejects negative, fractional, non-number and unsafe values', () => {
  for (const side of ['prediction', 'result']) {
    for (const field of ['home', 'away']) {
      for (const value of [undefined, null, '', '1', true, false, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        const input = validInput();
        input[side][field] = value;
        assert.throws(() => scoreMatchPrediction(input), TypeError);
      }
    }
  }
});

test('group records reject qualification picks', () => {
  for (const side of ['prediction', 'result']) {
    for (const qualifier of ['home', 'away', '', 0, false]) {
      const input = { round: 'group', prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 } };
      input[side].qualifier = qualifier;
      assert.throws(() => scoreMatchPrediction(input), TypeError);
    }
  }
});

test('ordinary knockouts and bronze winner bonuses require a home or away qualifier', () => {
  for (const [round] of BONUS_CASES) {
    for (const side of ['prediction', 'result']) {
      for (const qualifier of [undefined, null, '', 'draw', 0, false]) {
        const input = validInput(round);
        if (round === 'third_place') input.thirdPlaceBonus = 'winner';
        input[side].qualifier = qualifier;
        assert.throws(() => scoreMatchPrediction(input), TypeError);
      }
    }
  }
});

test('bronze without a bonus accepts an omitted or null qualifier but validates supplied sides', () => {
  for (const qualifier of [undefined, null]) {
    assert.deepEqual(scoreMatchPrediction({
      round: 'third_place', thirdPlaceBonus: 'none',
      prediction: { home: 1, away: 0, qualifier }, result: { home: 1, away: 0, qualifier },
    }), { basePoints: 5, scoreHalfPoints: 20, qualifierHalfPoints: 0, totalHalfPoints: 20 });
  }
  for (const side of ['prediction', 'result']) {
    const input = validInput('third_place');
    input[side].qualifier = 'draw';
    assert.throws(() => scoreMatchPrediction(input), TypeError);
  }
});

test('third place cannot silently acquire a default bonus policy', () => {
  const input = validInput('third_place');
  delete input.thirdPlaceBonus;
  assert.throws(() => scoreMatchPrediction(input), RangeError);
});

test('unknown supplied third-place policies are rejected on every round', () => {
  for (const [round] of ROUND_CASES) {
    for (const thirdPlaceBonus of [null, '', 'qualifier', 0, false]) {
      const input = round === 'group'
        ? { round, prediction: { home: 1, away: 0 }, result: { home: 1, away: 0 } }
        : validInput(round);
      assert.throws(() => scoreMatchPrediction({ ...input, thirdPlaceBonus }), RangeError);
    }
  }
});

test('a valid third-place policy does not suppress other rounds qualification bonuses', () => {
  const input = validInput();
  assert.deepEqual(scoreMatchPrediction({ ...input, thirdPlaceBonus: 'none' }), scoreMatchPrediction(input));
  assert.deepEqual(scoreMatchPrediction({ ...input, thirdPlaceBonus: 'winner' }), scoreMatchPrediction(input));
  assert.equal(scoreMatchPrediction(input).qualifierHalfPoints, 6);
});
