# Ownership and proposed data contract

Last updated: 2026-10-29

Current implementation includes pure domain source and the dependency-free
browser client in `public/`. The following shared-service contract remains
proposed; no tables, migrations, Auth policy or endpoint is applied.

## Browser and producer boundary

The [application API contract](references/application-api.md) owns the proposed
same-origin producer DTOs. The client validates finite JSON and binds private
responses to the captured verified viewer, group, full tournament context and
current resource generation. It does not interpret a browser calculation or a
disabled control as authorization. The server must enforce every permission.

Unsent drafts are memory-only and scoped by group/tournament/ruleset/mode.
Uncertain retries retain the same mutation UUID and payload; changed intent
receives a new UUID. A confirmed earlier save cannot delete a newer draft.
Revision conflicts retain the old base until the user compares current saved
values, explicitly accepts that base and separately saves. Nothing is persisted
optimistically. Session replacement clears private state and rendered views.

Group invitation codes are retained only from this session's creation receipts
and shown only while current listing/permission allows them. They never enter
URLs, browser storage or draft exports. Score/Oráculo draft export is manual.
The browser displays server-supplied timing, ranks, half-point totals, visibility
and qualifier labels; it does not choose tournament policies or hide data that
the producer already leaked. Source/static review is not runtime or access proof.

## Canonical domain

`scoreMatchPrediction` consumes the selected prediction, an authoritative settled
result and an explicit round. Scores exclude penalty kicks. A separate qualifier
field represents the advancing team, or a third-place winner only under the
explicit winner-bonus policy. Draft acceptance consistency is not guessed.

All persisted scores use integer **half-point units**: 21 means 10.5 points.
Quarterfinal score points multiply by 1.5 without rounding. A qualifier bonus
is added after the score multiplier. Derived totals reference the prediction,
result and ruleset versions so a correction replaces prior derived points
instead of adding them again.

`snapshotMatchWindow` derives cutoff/reveal times once from the authoritative
kickoff. Persist the snapshot. `evaluateMatchWindow` is a pure predicate, not
authorization: its `now` must come from the server and its `closed` latch from
persisted state. A schedule correction or provider failure cannot automatically
clear a prior closure. Unknown timing fails validation; the service must fail
closed rather than allow editing. Pick visibility starts at kickoff, not cutoff.

`evaluateOracleWindow` requires explicit cutoff, pick reveal and ranking reveal
times. The match history has a third, later gate: after the match. None of these
predicates authorizes a user or hides data already sent to a browser.

`rankGroupTotals` projects already-settled server totals to public member ID,
half-point total and shared competition rank. Equal points share rank; ID order
only stabilizes display. The caller must exclude hidden/unsettled records and
authorize group membership before returning rows. Ranking source alone does not
establish privacy.

`aggregateExactScoreHits` consumes one explicit member cohort and selected
prediction/result revisions in a single group/tournament/mode/draft-ruleset
scope. It counts exact scores through the canonical scorer, independently of
qualifier bonuses or round multipliers, and returns count-ranked rows plus
internal selection provenance. A correction rebuilds the selection instead of
adding to a previous count. See the [exact-hit contract](references/exact-hit-ranking.md).

The service must choose accepted revisions and the allowed settled subset,
enforce membership/reveal gates, keep provenance internally and project only
the public count rows with authorized display names. The optional browser card
shares the points table's complete member cohort and existing filter/context;
it has its own computation timestamp. Neither the pure module nor the client
proves completeness, official facts, latest records or safe disclosure.

`resolveOracleOutcomes` and `scoreOraclePrediction` implement the draft
[Oráculo record contract](references/oracle-contract.md). They validate supplied
draw/roster snapshots, official result revisions and recorded picks, resolve all
ten categories and return exact revision-bound half-point totals. Missing
results/policies remain explicit; no final total is returned while any category
is unsettled. These pure functions do not verify FIFA facts, persist a revision,
enforce its deadline, authorize a user or reveal its content safely. The service
must still own those boundaries and replacement of derived scores after correction.

## Proposed PostgreSQL records

| Record | Ownership and invariant |
| --- | --- |
| RulesetVersion | Draft/active status; immutable scoring version, round factors, category policies and badge definitions |
| Tournament | Explicit live/archive/replay mode, ruleset, opening/end times, Oráculo cutoff and separate reveal times, team/player/pot/ranking snapshots |
| Group / Membership / Invitation | Server-bound principal and role, membership lifecycle and bounded invitations; no user-supplied admin boolean |
| Match / ScheduleVersion | Tournament, stable teams, stage, matchday, authoritative kickoff, stored lock/reveal times and monotonic closure |
| PredictionRevision | Member/match/group, goals and qualifier, server timestamp, revision ID and previous revision; append-only |
| OraclePickRevision | Stable category/team/player identifiers, server timestamp and revision link |
| OfficialResultVersion | Final 90/120-minute score excluding shootout kicks, qualifier, official source, verification and correction history |
| DerivedScore | Unique selected prediction/result/ruleset tuple; replacement-safe recomputation |
| AdminAuditEvent | Actor, reason, server time and before/after version references; append-only |

PostgreSQL is the canonical shared store, with a ready-to-host Supabase path.
Database ownership, free capacity, Auth and SMTP policy require an approved
concrete setup before provisioning. Existing free apps must not be paused or
silently share sign-in merely to make room for this project.

## Service requirements still to implement

- Bind the principal from verified authentication. Protect group data through
  server checks and database policy; hiding HTML is insufficient.
- Save a revision transactionally only while the stored window permits it.
  Check authoritative wall-clock time after acquiring the relevant lock, near
  the write; a transaction's old start timestamp must not extend the deadline.
- Return own picks before reveal, other members' picks at kickoff, and change
  history after the final match state. Pre-reveal aggregate data must not leak
  another member's pick. Oráculo ranking has its own gate.
- Source finals/awards from verified official records. Do not fetch submitted
  URLs or trust client-reported results, roles, points or server time.
- Audit administrative corrections and closed-prediction amendments. Preserve
  prior versions and recompute affected rankings without duplicate points.
- Connect the authored Spanish group/member, prediction, Oráculo, ranking and
  rules views to the real producer. Verify empty/loading/error/mobile/keyboard
  behavior in a browser after approval; those checks have not run.
- Verify source, real database/access behavior, live APIs and hosted UI at their
  actual scope before claiming acceptance.

No browser-local catalogue, fabricated fixture schedule or client-clock lock
is a substitute for these remaining shared-service requirements.
