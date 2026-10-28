const MINUTE = 60_000;
const MAX_DATE = 8_640_000_000_000_000;

function timestamp(value, name) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_DATE) {
    throw new TypeError(`${name} must be an explicit UTC epoch-millisecond timestamp.`);
  }
  return value;
}

function matchTimes(window) {
  if (!window || typeof window !== 'object' || Array.isArray(window)) {
    throw new TypeError('A stored match window is required.');
  }
  const closesAt = timestamp(window.closesAt, 'closesAt');
  const picksRevealAt = timestamp(window.picksRevealAt, 'picksRevealAt');
  if (closesAt > picksRevealAt) throw new RangeError('Picks cannot reveal before editing closes.');
  return { closesAt, picksRevealAt };
}

/** Create once from the authoritative kickoff; persist this snapshot on the server. */
export function snapshotMatchWindow(kickoffAt) {
  timestamp(kickoffAt, 'kickoffAt');
  const closesAt = timestamp(kickoffAt - MINUTE, 'closesAt');
  return { closesAt, picksRevealAt: kickoffAt };
}

/** This predicate is not authorization. `closed` must come from persisted server state. */
export function evaluateMatchWindow(window, now, { closed = false } = {}) {
  const { closesAt, picksRevealAt } = matchTimes(window);
  timestamp(now, 'now');
  if (typeof closed !== 'boolean') throw new TypeError('closed must be a boolean.');
  return {
    editable: !closed && now < closesAt,
    closed: closed || now >= closesAt,
    picksVisible: now >= picksRevealAt,
  };
}

/** Oraculo picks and its ranking have separate, explicit reveal policies. */
export function evaluateOracleWindow(window, now) {
  const { closesAt, picksRevealAt } = matchTimes(window);
  const rankingRevealAt = timestamp(window.rankingRevealAt, 'rankingRevealAt');
  timestamp(now, 'now');
  if (rankingRevealAt < picksRevealAt) throw new RangeError('The ranking cannot reveal before picks.');
  return {
    editable: now < closesAt,
    picksVisible: now >= picksRevealAt,
    rankingVisible: now >= rankingRevealAt,
  };
}
