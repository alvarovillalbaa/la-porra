# Draft Oráculo implementation

28 October 2026. Substantive domain source toward the full La Porra application;
runtime behavior and end-to-end service acceptance remain unverified.

## Source and scope

The [owning brief](https://app.notion.com/p/377a1ee8bd068023a883c8c6bf2434a1)
was fetched again. Its entire returned child-page text was inspected, including
the research/proposal labels; the connector still returns a 14 June 2026
snapshot. Truncation/unknown-block fields were absent, not an explicit zero.
The fresh parent response is dated 28 October and retains this separate child.
No tournament/replay or rule-policy answer was inferred from those timestamps.

Clean baseline `ea512680d62d435614c5221b76f73cace78cfb02` contained three pure
modules: match scoring, timing predicates and ranking supplied totals. It had
no Oráculo scoring or award resolution. The new [canonical module](../../../../src/oracle.mjs)
implements the ten categories: champion, runner-up, four semifinalists, Golden
Boot, Golden Ball, Golden Glove, young player, Cinderella, Pufo and worst goal
difference. Fixed weights match the brief; all outputs use exact half-point
integer units and no Oráculo round multiplier.

The module validates versioned draw/team/player snapshots, result and pick
revision bindings, final placement cardinality and award identities. Pot-four
Cinderella follows the complete finish/group-points/total-GD/total-goals/
pre-tournament-rank chain. Pufo and goal-difference interpretations require
explicit policies. Exact competitive ties preserve identities; ID order never
chooses a winner. No draft policy is silently activated.

Official-resolution flags are trusted inputs from the future service, not proof
obtained by this function. Missing official results, incomplete team records or
unresolved policies return explicit states and reasons. Partial settled points
remain separate from a nullable final total. New result revisions produce fresh
bound scores without accumulating prior points. Database replacement, audit
retention, verified provenance and all access/reveal enforcement remain service
requirements. See the [record contract](../../../references/oracle-contract.md).

## Verification performed

Node `v24.21.0` recorded its version and executable in the same repository shell,
then used that exact executable to run the existing `scripts/check.mjs` checker.
It passed ES-module syntax for source, authored tests and scripts, package JSON
and required documents. No domain module was imported and no domain function or
test was executed.
The two subsequently added regression cases also passed `node --check` parsing.
Local import targets, new-file whitespace and `git diff --check` passed.

There are **55 new authored Oráculo cases**, plus the unchanged **64 existing
match/window/ranking cases**. The new count derives from 40 source declarations
with three literal-array loops expanded to ten, four and four cases: 55. This is
source counting, not 119 passing tests. The [execution proposal](../../../proposals/core-checks.md)
requires explicit owner approval under the supplied AGENTS.md §7; neither the
earlier 64-case scope nor this larger scope has been executed.

The new cases cover every category, official award ties, semifinalist set
scoring, pot eligibility, the Cinderella ordering chain, explicit Pufo modes
and per-exit-stage allocation, GD scopes, partial/unpicked/unverified resolution,
corrections, immutable inputs, identities, malformed policies/records, bounded
collections and accessor refusal. Every input is an authored abstract fixture,
not a real team, player, tournament or official result.

Independent read-only review checked the fixture arithmetic, rule ordering,
cohorts, revision bindings and incomplete/final distinction. It requested two
additional regression cases: unpicked but unsettled categories, and Pufo
worst-only allocation at distinct exit stages. Both were authored and parsed;
they were not run. Source review is not runtime or assertion proof.

| Frozen source | SHA-256 |
| --- | --- |
| `src/oracle.mjs` | `1b0bb6f3b54823bf4fa0b13bd1868f0f31aa781224112f58119de64754dd750f` |
| `tests/oracle.test.mjs` | `facbc494df99b4dc3b0832f4c8bf07dbe4e9e0f204cbbe9806e393c78b1ca8a7` |
| `tests/oracle-fixtures.mjs` | `7b88634807ce5b80841d6913bbacff5659c1f0223e959cdab313082ee75985f7` |

The three existing modules, three existing test files, package manifest and
source checker are unchanged from the baseline. No dependency, build, server,
browser, database, migration, Auth change, CI, live-data import, model call,
account, paid plan or Vercel setup was used. Small source/static work did not
require a dependency environment or storage-budget exception.

## Source publication

Published [976e2f1b234822604b1203e54a365e210f025326](https://github.com/alvarovillalbaa/la-porra/commit/976e2f1b234822604b1203e54a365e210f025326)
to the existing personal `alvarovillalbaa/la-porra` repository. Immutable connected
GitHub reads matched all nine changed local Git blobs. The canonical module is
`32a3f01d22fab6eedb30487ba65ceb46d268e389`; its authored cases are
`54eee9ededde7fb540e17d0897b0ce565f77e712` and abstract fixture helper
`0a72b9554899b4154260847c08ef8dd9d1353933`. The 119-case proposal was read back
as `5fdb90d59ae5b3dcee1fab20f730c0db499d0f4c`. This receipt-only follow-up
preserves every source/test byte. Publication does not establish test execution,
an active rulebook, shared persistence or a hosted application.

## Remaining application work

The source remains draft-only. Real group membership/invitations, accounts,
PostgreSQL/Supabase persistence, authoritative deadlines, hidden picks and
history, official ingestion/corrections, ranking aggregation, badges, the full
Spanish three-surface UI and hosted/browser/backend acceptance remain required.
Tournament/replay and ambiguous rule choices remain pending. The complete
[coverage table](../../../spec.md) retains them; this domain increment does not
replace the requested application or complete the portfolio goal.
