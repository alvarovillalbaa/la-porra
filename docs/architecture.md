# Ownership and proposed data contract

Current implementation is pure domain source. The following shared-service
contract is proposed; no tables, migrations, Auth policy or endpoint is applied.

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
- Build Spanish empty/loading/error/mobile/keyboard views, accessible forms,
  group/member flows, rule explanations and the complete three-surface product.
- Verify source, real database/access behavior, live APIs and hosted UI at their
  actual scope before claiming acceptance.

No browser-local catalogue, fabricated fixture schedule or client-clock lock
is a substitute for these remaining shared-service requirements.
