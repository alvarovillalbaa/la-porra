# Exact-score ranking contract

29 October 2026. Implemented source, draft rules; all 203 approved focused checks passed.

The brief's "más marcadores exactos" ranking is independent of points.
[aggregateExactScoreHits](../../src/exact-hits.mjs) counts one hit when the
canonical scorer returns `basePoints === 5`: both goal numbers match. A wrong
independent qualifier does not erase that hit; bonuses and round multipliers
do not increase it. Equal point totals cannot establish equal exact-hit counts.
The existing scorer and points ranker are unchanged.

## Selected input

The single argument is a plain data record with these required fields:

```text
{
 selectionId:ID,
 scope:{groupId:ID,tournamentId:ID,mode:'live'|'archive'|'replay',rulesetVersionId:ID},
 ruleset:{id:ID,version:'research-2026-v1',status:'draft',thirdPlaceBonus?:'winner'|'none'},
 memberIds:ID[],
 settlements:[{
  prediction:{id:ID,groupId:ID,tournamentId:ID,mode,rulesetVersionId:ID,
              memberId:ID,matchId:ID,score:{home,away,qualifier?}},
  result:{id:ID,tournamentId:ID,mode,matchId:ID,round,verified:true,final:true,
          score:{home,away,qualifier?}}
 }]
}
```

IDs use 1–128 ASCII letters/digits/underscores/hyphens. Data records reject
unknown fields/accessors; arrays must be dense data arrays. Input budgets are
10,000 members and 100,000 selected pairs, not tournament or eligibility policy.
Goals, rounds and qualifier semantics use the existing scorer. Third place
still needs an explicit `winner` or `none` policy. No active ruleset is accepted
or implicitly created by this draft module.

The roster is unique. Every prediction belongs to its roster and full scope;
its result must match tournament, mode and match and explicitly be verified
and final. Only one selected revision per member/match is allowed. A prediction
revision ID cannot be reused; all members sharing a match must use the same
result revision/content, and a result ID cannot be rebound to another match.
Absent/null qualifiers normalize consistently before result comparison.

The caller must supply the accepted revision selection. The function cannot
find the latest revision, verify official facts, establish completeness or
enforce membership. `selectionId` labels the supplied snapshot; persistence
must enforce its identity/immutability. Caller flags are validation inputs,
not proof of official verification. Historical revisions and unsettled matches
must be excluded by the service; malformed/unsettled pairs reject the report
rather than becoming misses.

## Output and correction

The detached, deeply frozen report contains:

- `version: 'research-2026-exact-hits-v1'`, `selectionId`, normalized `scope`
  and the explicitly supplied draft `ruleset` (including a supplied bronze policy).
- `rows: [{memberId,exactHitCount,settledMatchCount,rank}]`, ordered by hit count
  descending, then ID for stable display. Equal counts share competition rank;
  the settled denominator does not break ties.
- `provenance: [{memberId,matchId,predictionRevisionId,resultRevisionId,
  rulesetVersionId,exactHit}]`, ordered by member/match and kept internally.
- `coverage: {memberCount,selectedMatchCount,selectedPredictionCount}` for this
  selection only; the match count is distinct across members.

Each supplied settled pair contributes one denominator and at most one hit.
A roster member with no selected pairs has zero/zero. No pending count, missed
submission, full-schedule denominator or completeness inference is invented.
The service must choose the same intended filter/subset for points and exact
hits; a shared cohort alone cannot prove this semantic correspondence.

After a prediction/result correction, build a replacement selection and
recompute from scratch. There is no incremental previous-total input that
could accumulate an old hit. Retain original and replacement revision/snapshot
identities in server audit storage; this module stores neither.

## Public projection and limits

The future producer authorizes the viewer and reveal gate, attaches authorized
display names, and returns only the public rows/timestamp described in the
[application DTO](application-api.md). Never forward the entire report or its
revision provenance. The separate Spanish card preserves those rows/ranks
and distinguishes unavailable, empty and zero states. It is absent for hidden
and Oráculo rankings. Existing five filters and half-point displays remain.

The [approved focused run](../results/2026/10-29/exact-hit-checks.md) passed all
46 new domain/DTO/authored-DOM cases and 157 regressions. The DOM helper has no
browser layout, focus, native form or accessibility engine. No service, Auth,
database, official-data adapter, server disclosure enforcement or hosted
application is implemented by this slice. Streaks/day/week/badges retain their
separate unresolved policies.
