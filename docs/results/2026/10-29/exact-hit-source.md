# Exact-score leaderboard source receipt

29 October 2026. Source implementation and static verification complete;
**46 new cases and the combined 203-case run remain unexecuted**.

## Intent and boundary

Re-read the complete [Notion brief](https://app.notion.com/p/377a1ee8bd068023a883c8c6bf2434a1)
through the connector on 29 October. The returned unverified snapshot remains
dated 14 June 2026; no fresher product decision is inferred. Its rankings list
explicitly asks for "más marcadores exactos". Exact counts can advance without
inventing day/week, streak ordering or badge policies. The baseline checkout
was clean at `d475055662cff2b2a159b2742c45240a3dfc3b05`.

## Change

- Added a draft pure aggregation over explicitly selected settled revisions:
  exactness uses the existing scorer, independent of round/qualifier points.
  Scope/cohort/revision coherence are validated; corrections rebuild a snapshot
  and retain internal provenance without accumulating old hits.
- Extended the rankings DTO with an optional count-only card, preserving legacy
  omission/null and strict fields. Its visible member cohort/names must match
  the points table. Hidden/Oráculo cards cannot expose member rows.
- Added the Spanish **Marcadores exactos** view alongside the existing points
  table. Unavailable, empty and genuine zero states differ; producer order/ranks
  and the five existing filters are preserved. No private pick fetch is added.
- Authored 24 domain, 14 DTO and 8 authored-DOM cases. One view case spans the
  actual aggregation → public projection → parsing → rendering seam. Updated
  owning contracts, coverage and the precise new check proposal.

The [domain contract](../../../references/exact-hit-ranking.md) records selected
subset/completeness limits and the internal/public boundary. The service must
still choose accepted revisions, verify official facts, enforce membership and
reveal gates, and supply the intended filter's full authorized projection.

## Evidence

Existing Node 24.21.0 parsed **24 ES modules**, resolved **28 relative imports**
and local HTML assets, and checked package JSON/required documents through
`scripts/check.mjs`. This script invokes syntax checking only; no product module
or test is imported/executed. `git diff --check` passed. Static inventory gives
exactly **203 proposed cases** (119 unchanged core + 38 unchanged client + 46 new).
All original six case files and `oracle-fixtures.mjs` remain byte-identical to
the baseline and their previously published hashes. The scorer, points ranker,
API transport and workspace controller are unchanged.

Independent source review found no concrete blocker in aggregation, DTO privacy
or the domain-to-view projection. That is source evidence, not passing runtime
behavior. The [fingerprint](exact-hit-source.json) freezes source hashes, new
case names and the nine-file scope. All 35 sealed file hashes, 35 changed-file
relative Markdown links, the new JSON and tracked/new-file whitespace passed
the final static checks. Remote identity is recorded after publication.

The earlier 119/38 passing runs belong to their original pinned source; neither
is reused as approval or runtime proof for this change. The new
[proposal](../../../proposals/exact-hit-checks.md) requires an explicit §7 answer.

## Remaining work

No tests, browser, server, database, dependency installation, CI, deployment,
official-data import, real account, provider/model call or paid action ran for
this slice. No schema/Auth policy or active tournament/ruleset was applied.
The client remains unconnected; source publication is not a working hosted
prediction service. Shared persistence, authoritative deadlines/reveal control,
producer integration and hosted acceptance remain part of the original goal.
Streaks/day/week/badge policy is still unresolved. No large local environment
was created under the existing storage reserve constraint.
