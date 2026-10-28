# Application client source

Date: 2026-10-28. Status: authored source and static checks only.

## Implemented client

The dependency-free Spanish client in `public/` adds group creation/joining,
invitation creation/copy/revocation, roster and leave flows; match score forms,
separate producer-labelled knockout choices, gated other picks/history, the
ten-category Oráculo, filtered server-ranked tables and rules explanations.
The layout includes narrow-screen styles, keyboard focus treatment and explicit
loading, empty, unavailable and error states. No browser has rendered these
screens during this increment.

`api.mjs` and `protocol.mjs` implement the proposed same-origin JSON contract:
bounded bodies, strict DTOs, finite errors, cancellation/deadlines and explicit
resource input for prediction/history validation. The API keeps only an in-memory
CSRF value. The controller binds every private response to its captured verified
viewer, selected group, full tournament context and request generation.

Unsent drafts stay in memory, scoped by group/tournament/ruleset/mode. Uncertain
retries keep the same mutation ID and payload. Earlier acknowledgements preserve
newer drafts with their old revision base and require explicit comparison before
resubmission. Session replacement clears private state and immediately updates
the rendered view. Stale reads cannot replace a newer group/view or resurrect
hidden history. A delayed leave acknowledgement cannot clear another group's
current selection.

Invitation codes come only from acknowledged creation receipts, remain in
memory, and are displayed only against the current authorized unrevoked listing.
They are excluded from URLs, browser storage and manual draft exports. Export
contains only the user's unsent score/Oráculo input and its scope/revision IDs.

## Static verification

The existing Node installation ran the source-only check on Node `v26.8.2`.
Runtime version and executable attribution were captured in the same repository
process as final verification; the machine-local executable path is not committed.

- All 19 ES modules parsed with `node --check`; 19 relative imports and both
  local HTML assets resolved. Package JSON and required source documents passed.
- All 48 relative local Markdown links resolved, including the new producer/check
  and group-service proposals. Publication verification is recorded separately
  below after the source commit is available.
- Whitespace checks covered tracked edits and every newly authored file.
- All nine production/test SHA256 values in the closed
  [119-case domain receipt](domain-checks.json) still match. Those tests were
  not rerun, and their prior result is not claimed for the new client.
- The [client check proposal](../../../proposals/application-checks.md) scopes
  exactly 38 authored cases: 22 API/protocol and 16 state-controller cases.
  **All 38 remain unexecuted pending separate approval.**

Independent source review found and prompted fixes for stale acknowledgements,
resource/history ownership, full-context changes, leave-after-navigation,
terminal session-change notification and loading-state ownership. This review
does not establish runtime or browser acceptance.

## Remaining work

No server handler, Auth integration, schema/migration, provider dependency,
CI job, live tournament data or deployment is introduced. The client has no fake
session, local catalogue, fixture schedule or browser-clock authorization.
Without a real producer it cannot create a shared group or persist a pick.

The [group-service proposal](../../../proposals/group-service.md) is the next
reviewable backend slice. Account ownership, available free database capacity,
Auth policy and schema/dependency approval remain gates before applying it.
Tournament mode and unsettled rule policies remain explicit in the
[product contract](../../../spec.md). Full competitive persistence, audited
corrections, authoritative time/reveal enforcement, real result provenance,
hosted deployment and approved browser/access checks remain unfinished.
