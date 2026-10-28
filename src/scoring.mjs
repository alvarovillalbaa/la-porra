export const RULESET_VERSION = 'research-2026-v1';

// Each factor includes the conversion from points to half-point integer units.
const SCORE_HALF_FACTORS = Object.freeze({
  group: 2,
  round_of_32: 2,
  round_of_16: 2,
  quarterfinal: 3,
  semifinal: 4,
  third_place: 4,
  final: 6,
});

function readScore(value, label, isGroup, requiresQualifier) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a score record.`);
  }
  const { home, away, qualifier } = value;
  for (const [name, goals] of [['home', home], ['away', away]]) {
    if (!Number.isSafeInteger(goals) || goals < 0) {
      throw new TypeError(`${label}.${name} must be a nonnegative safe integer.`);
    }
  }
  if (isGroup) {
    if (qualifier !== undefined && qualifier !== null) {
      throw new TypeError(`${label}.qualifier must be absent or null for a group match.`);
    }
  } else if (qualifier === undefined || qualifier === null) {
    if (requiresQualifier) throw new TypeError(`${label}.qualifier must be home or away.`);
  } else if (qualifier !== 'home' && qualifier !== 'away') {
    throw new TypeError(`${label}.qualifier must be home or away.`);
  }
  return { home, away, qualifier };
}

function baseScore(prediction, result) {
  if (prediction.home === result.home && prediction.away === result.away) return 5;
  const predictedDifference = prediction.home - prediction.away;
  const actualDifference = result.home - result.away;
  if (predictedDifference === 0 && actualDifference === 0) return 2;
  if (Math.sign(predictedDifference) !== Math.sign(actualDifference)) return 0;
  if (predictedDifference === actualDifference) return 3;
  return 1;
}

/**
 * Score already-recorded picks under the draft research rules.
 *
 * Scores and qualifiers are evaluated independently. Whether a recorded pick
 * is acceptable or consistent is a separate, unresolved submission policy.
 * For third place, qualifier denotes the selected/result winner; callers must
 * explicitly choose whether that winner earns a bonus. Without a bronze bonus,
 * its unused qualifier may be absent/null; a supplied side is still validated.
 * This function does not choose a tournament, accept a pick or resolve results.
 */
export function scoreMatchPrediction(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('A match scoring record is required.');
  }
  const { round, prediction, result, thirdPlaceBonus } = input;
  if (typeof round !== 'string' || !Object.hasOwn(SCORE_HALF_FACTORS, round)) {
    throw new RangeError('Unknown match round.');
  }
  if (thirdPlaceBonus !== undefined && thirdPlaceBonus !== 'winner' && thirdPlaceBonus !== 'none') {
    throw new RangeError('thirdPlaceBonus must be winner or none when supplied.');
  }
  if (round === 'third_place' && thirdPlaceBonus === undefined) {
    throw new RangeError('A third-place bonus policy must be chosen explicitly.');
  }
  const isGroup = round === 'group';
  const awardsQualifier = !isGroup && (round !== 'third_place' || thirdPlaceBonus === 'winner');
  const pick = readScore(prediction, 'prediction', isGroup, awardsQualifier);
  const outcome = readScore(result, 'result', isGroup, awardsQualifier);
  const basePoints = baseScore(pick, outcome);
  const scoreHalfPoints = basePoints * SCORE_HALF_FACTORS[round];
  const qualifierHalfPoints = awardsQualifier && pick.qualifier === outcome.qualifier
    ? (round === 'final' ? 10 : 6)
    : 0;
  return {
    basePoints,
    scoreHalfPoints,
    qualifierHalfPoints,
    totalHalfPoints: scoreHalfPoints + qualifierHalfPoints,
  };
}
