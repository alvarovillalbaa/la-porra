# Draft Oráculo implementation

28 October 2026. Substantive domain source toward the full La Porra application;
all 119 approved pure-domain checks passed. End-to-end service acceptance remains
unverified.

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

## Initial source preparation

Node `v24.21.0` recorded its version and executable in the same repository shell,
then used that exact executable to run the existing `scripts/check.mjs` checker.
It passed ES-module syntax for source, authored tests and scripts, package JSON
and required documents. During that preparation, no domain module was imported
and no domain function or test was executed.
The two subsequently added regression cases also passed `node --check` parsing.
Local import targets, new-file whitespace and `git diff --check` passed.

There are **55 new authored Oráculo cases**, plus the unchanged **64 existing
match/window/ranking cases**. The new count derives from 40 source declarations
with three literal-array loops expanded to ten, four and four cases: 55. At
preparation this was source counting, not passing-test evidence. The
[execution proposal](../../../proposals/core-checks.md) required explicit owner
approval under the supplied AGENTS.md §7; execution subsequently occurred as
recorded below.

The new cases cover every category, official award ties, semifinalist set
scoring, pot eligibility, the Cinderella ordering chain, explicit Pufo modes
and per-exit-stage allocation, GD scopes, partial/unpicked/unverified resolution,
corrections, immutable inputs, identities, malformed policies/records, bounded
collections and accessor refusal. Every input is an authored abstract fixture,
not a real team, player, tournament or official result.

Independent read-only review checked the fixture arithmetic, rule ordering,
cohorts, revision bindings and incomplete/final distinction. It requested two
additional regression cases: unpicked but unsettled categories, and Pufo
worst-only allocation at distinct exit stages. Both were authored and parsed
before approval. Source review alone was not runtime or assertion proof.

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

## Approved domain execution

Alvaro explicitly answered **“Approve La Porra’s 119 checks”** for the immutable
[proposal at `928a10d`](https://github.com/alvarovillalbaa/la-porra/blob/928a10d01dec5cdc41f418c38d24ba74dea004d3/docs/proposals/core-checks.md).
Before execution, local HEAD matched that exact source and the checkout was
clean. The test inventory contained only the four approved `.test.mjs` files.
The existing Node `v24.21.0` process recorded its executable, then launched that
same executable with `--test` over those files and the TAP reporter. No package
installation or additional environment was needed.

**119 tests passed, zero failures/cancellations/skips/TODOs; exit code 0.**

| Test file | Passing cases |
| --- | ---: |
| `tests/oracle.test.mjs` | 55 |
| `tests/scoring.test.mjs` | 46 |
| `tests/windows.test.mjs` | 12 |
| `tests/ranking.test.mjs` | 6 |

The [machine-readable report](domain-checks.json) records the exact source
commit, Node version, runner arguments, totals and SHA-256 of all four modules,
four test files and the authored fixture helper. Every source/test hash matches
the approved published bytes. This is execution of actual pure domain code
against T2 abstract fixtures; no official data, server, browser, database, CI,
model call or provider was involved. No implementation/test change was required.

Independent evidence review confirmed all 119 sequential TAP pass records and
the complete plan, no failure/skip/TODO directives or bailouts, empty stderr,
and every recorded hash against both the worktree and immutable checked commit.
The bounded JSON retains the 22,792-byte TAP output's SHA-256. The task-owned
temporary TAP/stderr files were then removed; no fixture data or environment
remains to tear down.

These results close the domain-execution gate for this scope. They do not prove
official result verification, database idempotency, access/privacy enforcement,
real server cutoffs, application behavior or a live competition. Those remain
separate requirements below.

## Remaining application work

The source remains draft-only. Real group membership/invitations, accounts,
PostgreSQL/Supabase persistence, authoritative deadlines, hidden picks and
history, official ingestion/corrections, ranking aggregation, badges, the full
Spanish three-surface UI and hosted/browser/backend acceptance remain required.
Tournament/replay and ambiguous rule choices remain pending. The complete
[coverage table](../../../spec.md) retains them; this domain increment does not
replace the requested application or complete the portfolio goal.
