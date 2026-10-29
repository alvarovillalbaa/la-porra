import { RULESET_VERSION, scoreMatchPrediction } from './scoring.mjs';

export const EXACT_HIT_AGGREGATION_VERSION = 'research-2026-exact-hits-v1';

// Input budgets, not tournament size, membership or eligibility policies.
const MAX_MEMBERS = 10000;
const MAX_SETTLEMENTS = 100000;
const MODES = ['live', 'archive', 'replay'];
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const has = (value, key) => Object.hasOwn(value, key);

function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${label} must be a plain data record.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(`${label} has an unknown field.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!has(descriptor, 'value') || !descriptor.enumerable) throw new TypeError(`${label} needs enumerable data fields.`);
  }
  return value;
}

function required(value, key, label) {
  if (!has(value, key)) throw new TypeError(`${label}.${key} is required.`);
  return value[key];
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new TypeError(`${label} must be an application identifier.`);
  }
  return value;
}

function list(value, maximum, label) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) {
    throw new TypeError(`${label} must be a bounded dense data array.`);
  }
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !has(descriptor, 'value') || !descriptor.enumerable) {
      throw new TypeError(`${label} must contain data entries.`);
    }
  }
  return value;
}

function mode(value, label) {
  if (!MODES.includes(value)) throw new RangeError(`${label} is not a supported tournament mode.`);
  return value;
}

function readScope(value) {
  const input = record(value, ['groupId', 'tournamentId', 'mode', 'rulesetVersionId'], 'scope');
  return {
    groupId: identifier(required(input, 'groupId', 'scope'), 'scope.groupId'),
    tournamentId: identifier(required(input, 'tournamentId', 'scope'), 'scope.tournamentId'),
    mode: mode(required(input, 'mode', 'scope'), 'scope.mode'),
    rulesetVersionId: identifier(required(input, 'rulesetVersionId', 'scope'), 'scope.rulesetVersionId'),
  };
}

function readRuleset(value, scope) {
  const input = record(value, ['id', 'version', 'status', 'thirdPlaceBonus'], 'ruleset');
  const id = identifier(required(input, 'id', 'ruleset'), 'ruleset.id');
  if (id !== scope.rulesetVersionId || required(input, 'version', 'ruleset') !== RULESET_VERSION
    || required(input, 'status', 'ruleset') !== 'draft') {
    throw new RangeError('Exact-hit aggregation requires the explicitly bound draft ruleset.');
  }
  const output = { id, version: RULESET_VERSION, status: 'draft' };
  if (has(input, 'thirdPlaceBonus')) {
    if (!['winner', 'none'].includes(input.thirdPlaceBonus)) throw new RangeError('A supported third-place bonus policy is required.');
    output.thirdPlaceBonus = input.thirdPlaceBonus;
  }
  return output;
}

function readScore(value, label) {
  const input = record(value, ['home', 'away', 'qualifier'], label);
  // The existing scorer validates goals and round-specific qualifier semantics.
  return {
    home: required(input, 'home', label), away: required(input, 'away', label),
    qualifier: has(input, 'qualifier') ? input.qualifier ?? null : null,
  };
}

function readPrediction(value, scope, members) {
  const input = record(value, ['id', 'groupId', 'tournamentId', 'mode', 'rulesetVersionId', 'memberId', 'matchId', 'score'], 'prediction');
  const output = {
    id: identifier(required(input, 'id', 'prediction'), 'prediction.id'),
    groupId: identifier(required(input, 'groupId', 'prediction'), 'prediction.groupId'),
    tournamentId: identifier(required(input, 'tournamentId', 'prediction'), 'prediction.tournamentId'),
    mode: mode(required(input, 'mode', 'prediction'), 'prediction.mode'),
    rulesetVersionId: identifier(required(input, 'rulesetVersionId', 'prediction'), 'prediction.rulesetVersionId'),
    memberId: identifier(required(input, 'memberId', 'prediction'), 'prediction.memberId'),
    matchId: identifier(required(input, 'matchId', 'prediction'), 'prediction.matchId'),
    score: readScore(required(input, 'score', 'prediction'), 'prediction.score'),
  };
  if (!members.has(output.memberId) || ['groupId', 'tournamentId', 'mode', 'rulesetVersionId'].some(key => output[key] !== scope[key])) {
    throw new RangeError('A selected prediction must belong to the supplied member cohort and scope.');
  }
  return output;
}

function readResult(value, scope, matchId) {
  const input = record(value, ['id', 'tournamentId', 'mode', 'matchId', 'round', 'verified', 'final', 'score'], 'result');
  const output = {
    id: identifier(required(input, 'id', 'result'), 'result.id'),
    tournamentId: identifier(required(input, 'tournamentId', 'result'), 'result.tournamentId'),
    mode: mode(required(input, 'mode', 'result'), 'result.mode'),
    matchId: identifier(required(input, 'matchId', 'result'), 'result.matchId'),
    round: required(input, 'round', 'result'),
    verified: required(input, 'verified', 'result'), final: required(input, 'final', 'result'),
    score: readScore(required(input, 'score', 'result'), 'result.score'),
  };
  if (typeof output.verified !== 'boolean' || typeof output.final !== 'boolean') throw new TypeError('Result settlement flags must be booleans.');
  if (!output.verified || !output.final) throw new RangeError('Only explicitly verified final results can contribute exact hits.');
  if (output.tournamentId !== scope.tournamentId || output.mode !== scope.mode || output.matchId !== matchId) {
    throw new RangeError('The selected result must belong to the same tournament, mode and match.');
  }
  return output;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Rank exact scores in an explicitly selected, revision-bound settlement snapshot.
 *
 * This does not find latest revisions, establish official facts or completeness,
 * authorize membership, reveal picks, persist scores or activate the draft rules.
 * Only the supplied accepted/settled pairs contribute; no pending denominator is
 * invented. Rebuild from the replacement selection after a correction.
 */
export function aggregateExactScoreHits(value) {
  const input = record(value, ['selectionId', 'scope', 'ruleset', 'memberIds', 'settlements'], 'aggregation');
  const selectionId = identifier(required(input, 'selectionId', 'aggregation'), 'selectionId');
  const scope = readScope(required(input, 'scope', 'aggregation'));
  const ruleset = readRuleset(required(input, 'ruleset', 'aggregation'), scope);
  const members = new Map();
  for (const value of list(required(input, 'memberIds', 'aggregation'), MAX_MEMBERS, 'memberIds')) {
    const memberId = identifier(value, 'memberId');
    if (members.has(memberId)) throw new RangeError('Member identifiers must be unique.');
    members.set(memberId, { memberId, exactHitCount: 0, settledMatchCount: 0 });
  }
  const pairs = new Set(), predictionIds = new Set(), matchResults = new Map(), resultIds = new Map();
  const provenance = [];
  for (const value of list(required(input, 'settlements', 'aggregation'), MAX_SETTLEMENTS, 'settlements')) {
    const settlement = record(value, ['prediction', 'result'], 'settlement');
    const prediction = readPrediction(required(settlement, 'prediction', 'settlement'), scope, members);
    const result = readResult(required(settlement, 'result', 'settlement'), scope, prediction.matchId);
    const key = `${prediction.memberId}\0${prediction.matchId}`;
    if (pairs.has(key) || predictionIds.has(prediction.id)) throw new RangeError('Only one selected prediction revision per member and match may contribute.');
    const scored = scoreMatchPrediction({
      round: result.round, prediction: prediction.score, result: result.score,
      ...(has(ruleset, 'thirdPlaceBonus') ? { thirdPlaceBonus: ruleset.thirdPlaceBonus } : {}),
    });
    const signature = JSON.stringify(result);
    if ((matchResults.has(result.matchId) && matchResults.get(result.matchId) !== signature)
      || (resultIds.has(result.id) && resultIds.get(result.id) !== signature)) {
      throw new RangeError('A selected result revision and content must agree across the snapshot.');
    }
    pairs.add(key); predictionIds.add(prediction.id);
    matchResults.set(result.matchId, signature); resultIds.set(result.id, signature);
    const row = members.get(prediction.memberId);
    row.settledMatchCount++;
    const exactHit = scored.basePoints === 5;
    if (exactHit) row.exactHitCount++;
    provenance.push({ memberId: prediction.memberId, matchId: prediction.matchId,
      predictionRevisionId: prediction.id, resultRevisionId: result.id,
      rulesetVersionId: scope.rulesetVersionId, exactHit });
  }
  const sorted = [...members.values()].sort((left, right) => right.exactHitCount - left.exactHitCount || compare(left.memberId, right.memberId));
  let rank = 0;
  const rows = sorted.map((row, index) => {
    if (index === 0 || row.exactHitCount !== sorted[index - 1].exactHitCount) rank = index + 1;
    return { ...row, rank };
  });
  provenance.sort((left, right) => compare(left.memberId, right.memberId) || compare(left.matchId, right.matchId));
  return freeze({ version: EXACT_HIT_AGGREGATION_VERSION, selectionId, scope, ruleset, rows, provenance,
    coverage: { memberCount: members.size, selectedMatchCount: matchResults.size, selectedPredictionCount: provenance.length } });
}
