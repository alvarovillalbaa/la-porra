# Proposed first shared group service

Last updated: 2026-10-28

Status: **proposal; no schema, Auth, dependency or service execution approved.**
The source client consumes the [proposed DTOs](../references/application-api.md);
it does not supply a shared database or verified accounts. The proposed slice would implement
one real path: verified account → private group creation → invitation redemption
by another verified account → persisted member roster after reload.

The complete [product](../spec.md) and [server ownership](../architecture.md)
remain binding. This slice creates no tournament, fixtures, scores, rankings,
Oráculo records or active scoring policies. Points have no economic value.

## Storage and account gates

PostgreSQL remains the canonical store, with a ready-to-host Supabase path.
The delivery constraint reported for this proposal is that existing free
Supabase capacity is full; no fresh provider-capacity check is performed here.
A concrete, approved project/account and free-capacity decision must precede
provisioning. Do not pause an existing app, reuse its database/Auth identities,
consolidate applications, create an account or enable billing to make room.

The owner must approve the account provider and verified-identity policy before
Auth source/configuration is changed. Email signup/confirmation/recovery and
SMTP/sender policy are still undecided; an email address or contact form is not
an identity provider. Existing account reuse is not selected by this proposal.
Cookie/session, CSRF/origin, database access/RLS and secret-handling policies
require a concrete reviewed Auth/security change, not an inferred permission.

After those decisions, prepare the exact SQL migration, server/runtime adapter,
driver dependency/version and lockfile delta for approval before applying or
installing them. Deployment/production configuration, CI, real database checks
and browser checks remain separately scoped approvals. This document applies
none of them and does not select a hosting runtime or paid plan.

## Endpoint slice

Implement the existing DTO contract without accepting principal, role,
permissions, timestamps or membership from request bodies:

| Route | Required persisted behavior |
| --- | --- |
| `GET /api/session` | Verified principal/display name and in-memory CSRF token, or the explicit anonymous/unavailable state |
| `GET /api/groups` | Only the authenticated principal's active groups and server-derived permissions |
| `POST /api/groups` | Atomically create the group and creator's owner membership; return the submitted accepted name |
| `GET /api/groups/:groupId` | Authorize current membership before returning the private roster and invitation metadata; all listed codes are null |
| `POST /api/groups/:groupId/invitations` | Check approved invitation permission and persist a bounded invitation before returning its creation receipt |
| `POST /api/invitations/redeem` | Verify the authenticated account and code, then atomically consume an allowed use and create/recognize membership |
| `DELETE /api/groups/:groupId/invitations/:invitationId` | Authorize the group/resource and persist revocation without deleting history |
| `DELETE /api/groups/:groupId/membership` | Apply the approved leave policy, persist membership change and remove future private access |
| `GET /api/groups/:groupId/tournament` | Authorize membership and return `{context:null}` while this slice has no configured tournament |

The last read is necessary: the current client loads group detail and tournament
context together. Group `tournamentId` must also be null. Unimplemented
competition routes must not return invented successful catalogues. The approved
account entry/callback/logout lifecycle must fit the same-origin `/auth/` entry
contract; exact routes and provider configuration remain part of the Auth review.

All successful envelopes include authoritative UTC `serverTime` and verified
`viewerId`; non-member session states have `viewerId:null`. Mutations also
include `replayed`. Use the contract's finite safe errors and never include
tokens, codes, session credentials, SQL detail or private response bodies in
logs/errors. Group reads are uncached private responses; no cross-origin data
access is enabled implicitly.

## Proposed record responsibilities

These are migration design inputs, not applied table definitions:

| Record | Required invariant |
| --- | --- |
| Principal/profile mapping | Bind a verified provider subject to a stable app member ID; display names never authorize access |
| Group | Server-generated ID, accepted name, creator and creation time; no configured tournament in this slice |
| Membership | Group/principal, role and lifecycle timestamps; one active membership per pair; role is never client-selected |
| Invitation | Group, creator, high-entropy code digest, expiry, use limit/count and revocation state; no plaintext code catalogue |
| Mutation receipt | Principal + operation/resource scope + mutation UUID + normalized input fingerprint; committed outcome shares the write transaction |
| Group audit event | Actor, group/resource, operation and server timestamp for creation, membership and invitation changes; secret material excluded |

The final schema must define foreign keys, uniqueness, active-membership queries,
indexes, retention and deletion behavior explicitly. No cascade into an existing
app's records is proposed. Ownership starts with the verified creator; there is
no ownership-transfer or group-deletion endpoint in this slice.

## Transaction and privacy requirements

Group creation and its owner membership commit together. Redemption locks the
invitation and relevant membership/receipt records, then rechecks expiry using
current server wall-clock time near the write. Invalid, expired, revoked or
exhausted codes produce no membership and consume no use. Concurrent contenders
for the last use cannot both succeed. A retry/already-member outcome must not
consume a second use; exact rejoin behavior needs the approved lifecycle policy.

Every mutation checks the verified principal and its operation-specific
membership/permission requirements near its write, validates Origin and the
session CSRF token, and binds its idempotency receipt to verified principal,
operation, resource and input. The same UUID/input replays the committed result;
changed input under that identity fails. Group creation, invite creation,
redemption, revocation and leave each need this behavior. No automatic retry
changes payload or silently creates another resource after a lost response.

Generate invitation codes with server cryptographic randomness, store only a
verification digest in ordinary invitation records, and limit authenticated
creation/redemption attempts. Code expiry, uses, rate limits and receipt
retention are explicit policies to approve, not constants selected here.
Replaying a lost creation response requires an approved encrypted/private
receipt mechanism and key/expiry policy; a digest cannot recover the code.
If that policy is unavailable, do not enable invitation creation with fictional
idempotent code recovery. List reads always return null codes; only an authorized
creation/replay receipt exposes one. No invitation URL, automatic message,
SMTP invitation or client-persisted secret is required.

Private queries and database policies must prevent access by an authenticated
non-member, a member of another group or a member who has left. Privileged
database credentials never enter the browser. Provider verification, server
authorization and database isolation must agree; frontend visibility is not
evidence that an unauthorized response was prevented.

## Decisions still needed

- Approved database/project owner and a viable free-capacity path, without
  assuming account/database/Auth reuse or paid enrollment.
- Account provider, verified-account condition, login/session/logout lifecycle,
  email confirmation/recovery and sender policy if email Auth is chosen.
- Role/permission matrix: who may invite/revoke, who may leave, and how an owner
  or last member is handled without inventing transfer/deletion behavior.
- Invitation expiry/use/rate limits, already-member/rejoin behavior, receipt
  retention and secure creation-code replay policy.
- Concrete server/runtime, PostgreSQL driver, schema/RLS and secret management
  proposal, followed by their exact change approvals.

The future/archive/replay tournament choice and unresolved scoring/reveal
policies are still pending. They do not block this no-tournament group slice,
and this slice does not resolve or activate them.

## Acceptance to prepare after approval

Prepare a disposable database/access harness for two verified authored users
and a third non-member. Cover concurrent/idempotent group creation and invite
redemption, last-use contention, expiry/revocation, changed-input retries,
CSRF/origin rejection, cross-group denial and leave removing access. Include
restart/reload persistence and safe invitation-receipt recovery. Publish the
exact harness and cleanup ownership before requesting backend execution.

Then prepare focused desktop/mobile browser checks through the actual same-origin
service: account entry, group creation, explicit code copy, another account's
redemption, roster reload, permission-dependent controls and explicit revoke/leave
confirmation. Use owned disposable accounts/content and remove only those
fixtures under the approved cleanup policy. Request that browser scope before
execution. Neither the [38 proposed source checks](application-checks.md) nor
this proposal proves real sessions, multiplayer privacy, persistence or hosted
acceptance.
