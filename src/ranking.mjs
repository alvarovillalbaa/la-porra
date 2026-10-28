/** Rank server-derived settled totals; equal points share their competition rank. */
export function rankGroupTotals(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Ranking rows must be an array.');
  const members = new Set();
  const sorted = rows.map(row => {
    if (!row || typeof row.memberId !== 'string' || !row.memberId || row.memberId.trim() !== row.memberId) {
      throw new TypeError('Each ranking row needs a normalized memberId.');
    }
    if (members.has(row.memberId)) throw new RangeError('Ranking member IDs must be unique.');
    if (!Number.isSafeInteger(row.halfPoints) || row.halfPoints < 0) {
      throw new TypeError('halfPoints must be a nonnegative safe integer.');
    }
    members.add(row.memberId);
    return { memberId: row.memberId, halfPoints: row.halfPoints };
  });
  sorted.sort((a, b) => {
    if (a.halfPoints !== b.halfPoints) return a.halfPoints > b.halfPoints ? -1 : 1;
    return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
  });
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.halfPoints !== sorted[index - 1].halfPoints) rank = index + 1;
    return { ...row, rank };
  });
}
