# Draft Oráculo records and settlement

Last updated: 2026-10-28

`src/oracle.mjs` owns pure tournament-wide resolution and pick scoring under
`research-2026-oracle-v1`. This is a draft engine, not an activated competition.
The [product contract](../spec.md) retains the full app and pending tournament,
rule, database and access decisions. The [brief](https://app.notion.com/p/377a1ee8bd068023a883c8c6bf2434a1)
still returns a 14 June 2026 research/proposal snapshot.

## Record flow

`resolveOracleOutcomes({ ruleset, snapshot, result })` resolves the ten categories.
`scoreOraclePrediction({ ruleset, snapshot, result, revision })` calls that
resolver and scores one recorded pick revision. Neither function fetches data,
reads clocks/storage, authenticates a user, accepts a submission or activates
rules. No source URL or client boolean proves an official result.

| Record | Required fields |
| --- | --- |
| Ruleset | `id`, `version: research-2026-oracle-v1`, `status: draft`; optional explicit `policies` described below |
| Draw snapshot | `id`, `tournamentId`, `teams`, `players` |
| Snapshot team | `id`, `pot` from 1–4, positive integer pre-tournament `fifaRank` |
| Snapshot player | `id`, `teamId` belonging to the snapshot |
| Official result revision | `id`, `tournamentId`, `snapshotId`, `verified`, `final`, `teams`; optional `awards` |
| Team performance | `teamId`, terminal `finish`, `groupPoints`, `groupGoalsFor`, `groupGoalsAgainst`, `totalGoalsFor`, `totalGoalsAgainst` |
| Official award | `verified`, `winnerIds` referencing snapshot players |
| Pick revision | `id`, `tournamentId`, `snapshotId`, `rulesetId`, `picks` |

IDs are normalized nonempty strings of at most 128 characters. The snapshot
contains 4–256 distinct teams and at most 8,192 distinct players. Supplied IDs
must belong to their snapshot/cohort. Counts and statistics are safe integers;
goals and group points are nonnegative, and total goals cannot be below their
group-stage values. Duplicates, mismatched versions/identities, unknown fields
and malformed records are errors. These bounds validate supplied records;
they do not choose a tournament, import a roster or verify its facts.

Finish order is `group`, `round_of_32`, `round_of_16`, `quarterfinal`,
`semifinal`, `runner_up`, `champion`. Both semifinal losers share that finish;
the third-place match does not make one of them a finalist. Complete final
team results require one champion, one runner-up and four semifinalists
including both finalists. Incomplete/nonfinal team records remain pending.

The service must obtain `verified` from its reviewed official-result version,
not a submitted browser payload. Official source, verification identity/time,
correction reason and prior-version links belong to the proposed persisted
records in [architecture](../architecture.md). This module carries their stable
revision references; it does not implement those records or an audit database.

## Categories and points

| Category key | Pick / resolution | Points |
| --- | --- | ---: |
| `champion` | One team / final champion | 20 |
| `runnerUp` | One team / final runner-up | 12 |
| `semifinalists` | Up to four distinct teams / four semifinalists | 1 per correct team |
| `goldenBoot` | One player / verified official award winners | 15 |
| `goldenBall` | One player / verified official award winners | 12 |
| `goldenGlove` | One player / verified official award winners | 10 |
| `youngPlayer` | One player / verified official award winners | 8 |
| `cinderella` | One pot-four team / ordering below | 10 |
| `flop` | One pot-one team / explicit policy below | 10 or 10/7/5/3 |
| `worstGoalDifference` | One team / explicit statistical scope | 8 |

All returned scores use integer half-point units, matching the existing match
scorer: 20 points becomes 40 units. Oráculo awards have no round multiplier.
A player award with joint official winners credits the one chosen winner once.
Semifinalist order does not matter; duplicate picks and more than four picks are
invalid. Champion and runner-up cannot be the same pick. A missing or null
choice is unpicked; it earns zero only once its category is settled.

## Unresolved policies remain explicit

Missing policy records produce `policy_required`, not an assumed rule. Supplied
unknown policy values are errors. The following are draft interpretations for
review, not decisions made on Alvaro's behalf:

- `cinderellaTies: all | pending`: Cinderella considers only pot-four teams,
  comparing furthest finish, most group points, best total goal difference,
  most total goals, then the worse pre-tournament FIFA rank. An exact remaining
  tie preserves all winners under `all`; `pending` leaves it unresolved.
- `flop: { mode, ties, sameStage? }`: `fixed-worst` awards ten points for the
  worst pot-one team: earliest finish, fewest group points, worst group goal
  difference, then fewest group goals. `stage` uses ten/seven/five/three points
  for group/round-of-32/round-of-16/quarterfinal exits. Stage mode requires
  `sameStage: all | worst-only`: credit all eligible teams at each exit stage,
  or only that stage's worst by the same group-stat ordering. Later finishes
  earn zero. `ties: all | pending` governs exact remaining worst-team ties.
  The brief's vague “more points” for worse same-stage performance is not
  silently turned into an extra numerical bonus or competitive tie-break.
- `worstGoalDifference: { scope: group | tournament, ties: all | pending }`:
  compare only goal difference in the chosen scope. Goals scored and team IDs
  are not additional tie-breaks. This implements that named category; whether
  “worst group team” is the same product category remains an owner decision.

IDs stabilize output ordering only. They never break a competitive tie. Once
the category's policies are supplied, an absent eligible pot cohort produces
`pending`. Missing, unverified or empty official award records also remain pending.
An unverified overall result leaves every category pending. Verified individual
awards can settle while final team results are incomplete; they never make the
other categories look resolved.

## Output and corrections

Resolver output binds `tournamentId`, `snapshotId`, `rulesetId`,
`rulesetVersion`, `resultRevisionId` and contains `complete` and ordered
`categories`. Each category has `category`, `status`, `awards` and `reason`.
Settled awards are `{ id, halfPoints }` records; unresolved outcomes have no
awards and an explicit reason. Only `settled`, `pending` and `policy_required`
are accepted result states.

Scoring adds `pickRevisionId`, `settledHalfPoints`, `totalHalfPoints` and category
`halfPoints`/`matchedIds`. Unresolved category points and the final total are
`null`, not zero. `settledHalfPoints` is a partial subtotal, unsuitable for a
final Oráculo ranking. `complete` means every category resolved, independently
of the separate ranking-reveal time.

Corrections produce a new result-revision binding and a fresh score; the module
holds no accumulator. The future service must transactionally replace the
derived row for a pick/ruleset/result version, retain audit history and enforce
membership and reveal windows before returning any result. Pure scoring cannot
prevent duplicate database writes or hide picks already sent to a browser.
