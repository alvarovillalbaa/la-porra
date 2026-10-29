# Application client and proposed service DTOs

Status: client implementation contract. This does not approve or implement a
database, Auth policy, server handler or tournament activation. The full
[product](../spec.md) and [server ownership](../architecture.md) remain binding.
All names below are canonical for the new client; a future producer must meet
them rather than rely on frontend coercion or browser authorization.

## Common transport

Requests are same-origin `/api/` calls with same-origin cookies, no redirects,
no cache and bounded JSON. Reads return `{data,serverTime,viewerId}` with an ISO
UTC server timestamp and the verified principal ID, or null for non-member
session states. Mutations additionally return `replayed`.
Errors return `{error:{code}}`; the client exposes finite known codes and HTTP
status without raw response bodies. IDs are opaque 1–128 character ASCII
letters/digits/underscore/hyphen. Dates are ISO UTC strings or explicit null
where noted. Display labels are bounded text, never HTML.
The client binds every private response to its captured session's `viewerId`.
A changed identity clears private cached views/drafts before a fresh session
read. This does not replace server authentication or remedy data already sent.

Mutation input always contains a client-generated UUID `mutationId`. The same
intent and uncertain retry preserve that ID and payload; changed intent gets a
new ID. IDs do not authorize an operation. The service must bind authenticated
principal/group/resource, retain idempotency receipts and reject changed input
under an existing identity. No automatic retry, optimistic persisted-success
claim, clock-based authorization or localStorage database is part of the client.

Every mutation sends the session's `X-CSRF-Token`; authenticated principal,
membership, role, permissions, server time, points and visibility are never
accepted from request bodies. Origin/CSRF validation, cookie policy and verified
Supabase identity require the separate server/Auth approval before activation.

## Session and groups

- `GET /api/session` → session.
- `GET /api/groups` → `{groups:Group[]}`.
- `GET /api/groups/:groupId` → `{group:Group,members:Member[],invitations:Invitation[]}`.
- `POST /api/groups` with `{mutationId,name}` → `{group:Group}`.
- `POST /api/invitations/redeem` with `{mutationId,code}` → `{group:Group}`.
- `POST /api/groups/:groupId/invitations` with `{mutationId}` → `{invitation:Invitation}`.
- `DELETE /api/groups/:groupId/invitations/:invitationId` with `{mutationId}` → `{revoked:true}`.
- `DELETE /api/groups/:groupId/membership` with `{mutationId}` → `{left:true}`.

Session discriminant:

```text
{state:'unavailable'}
{state:'anonymous',loginPath:'/auth/login'}
{state:'member',user:{id,displayName},csrfToken}
```

The CSRF token is an opaque 32–256 character base64url string. It remains in
memory and is cleared with the session; it is not an authentication credential
supplied as a principal.

The login path must be a same-origin path beginning `/auth/`, without another
origin, credentials or fragment. No login request, provider or email policy is
implemented by this client. A 401 clears private client state before a fresh
session read. Group 403/404 clears that group's private view.

```text
Group = {id,name,role:'owner'|'member',memberCount,tournamentId:null|ID,
 permissions:{canInvite:boolean,canLeave:boolean}}
Member = {id,displayName,joinedAt}
Invitation = {id,code:null|string,expiresAt,usesRemaining,revoked:boolean}
```

Invitation codes are private, bounded 16–256 character base64url values. Only
authorized creation/replay receipts expose the code; listings may return null.
Group-detail listings require null codes. An authorized client can retain its
own validated creation receipt in private memory for the matching current,
unrevoked invitation; this is not a recoverable code lookup.
The service owns expiry/use policy and invite revocation. It must choose and
approve secure receipt retention before supporting retries of a lost creation
response. The client neither chooses an expiry policy nor sends roles. It does
not put codes in URLs, localStorage, logs or automatic outbound messages.

## Tournament context and read views

`GET /api/groups/:groupId/tournament` → `{context:null|Context}`. Null means the
group has no configured tournament. The client must not fabricate fixtures,
select a tournament mode or promote draft scoring policies.

```text
Context = {groupId,tournamentId,name,mode:'live'|'archive'|'replay',
 rulesetVersionId,rulesState:'draft'|'active',
 rules:[{label,description}],pendingPolicies:string[]}
```

Every tournament view includes this full context and must match the requested
group/tournament. A changed context invalidates prior cached views and pending
base revisions. Rules text comes from the producer's selected immutable version.
The browser may display an inactive draft, but editing also requires active
rules and the resource's explicit server `canEdit` permission.

- `GET /api/groups/:groupId/matches` → `{context,matches:Match[]}`.
- `GET /api/groups/:groupId/matches/:matchId/history` → `{groupId,matchId,visibility:'hidden'|'visible',revisions:HistoryRevision[]}`.
- `GET /api/groups/:groupId/oracle` → `{context,oracle:Oracle}`.
- `GET /api/groups/:groupId/rankings?filter=FILTER` → `{context,rankings:Rankings}`.

```text
Team = {id,name}
Prediction = {revisionId,homeGoals,awayGoals,qualifierId:null|ID,updatedAt}
Match = {id,kind:'group'|'knockout',roundLabel,matchdayLabel,
 home:Team,away:Team,kickoffAt:null|ISO,cutoffAt:null|ISO,revealAt:null|ISO,
 status:'scheduled'|'live'|'finished'|'postponed',
 canEdit:boolean,editReason:null|string,qualifierLabel:null|string,qualifierRequired:boolean,
 ownPrediction:null|Prediction,pickVisibility:'hidden'|'visible',
 otherPredictions:null|[{memberId,displayName,prediction:Prediction}],
 historyVisibility:'hidden'|'visible'}
HistoryRevision = {id,memberId,displayName,createdAt,homeGoals,awayGoals,
 qualifierId:null|ID,reason:null|string}
```

Goals are integers 0–99. Qualifier IDs must name one of the two teams; group
matches require `qualifierLabel:null`. A null label disables the separate choice:
`qualifierRequired` must be false and own, other, history and submitted qualifier
IDs must all be null. A non-null label is producer-owned wording for the active
advancing-team or winner policy. A third-place match must not acquire an invented
advancement choice or bonus. Knockout winner/advancing-team and predicted score
consistency are separate policies, not inferred in the client. Penalty
kicks are not added to predicted scores. A hidden picks response requires
`otherPredictions:null`; hidden history requires an empty revisions array.
Visible match picks require an array, which may be empty; null is not an empty
visible catalogue.
The client can reject an inconsistent payload but cannot undo a server leak.

```text
Oracle = {revisionId:null|ID,canEdit:boolean,editReason:null|string,
 cutoffAt:null|ISO,pickVisibility:'hidden'|'visible',
 rankingVisibility:'hidden'|'visible',
 categories:[{id,label,description,pointsUnits,minSelections,maxSelections,
 options:[{id,label,description}],selectedIds:ID[]}],
 otherPicks:null|[{memberId,displayName,picks:Record<categoryID,ID[]>}]}
```

Category IDs are the canonical ten keys from the existing Oráculo engine,
without invented badge/category rules. The producer supplies valid team/player
snapshots, configured choices and bounds; incomplete official data or policies
make editing unavailable. Selections must belong to their category options.
Hidden picks require `otherPicks:null`. Oráculo ranking visibility remains a
separate server gate; it is never derived from pick visibility.
Visible Oráculo picks require an array, which may be empty.
The category array contains each of the ten keys exactly once. Read-side
`selectedIds` may be empty/incomplete below the required minimum; a save must
contain all ten keys and satisfy every configured minimum/maximum. Request
validation receives the current validated match/Oráculo resource explicitly;
the API wrapper does not maintain a second resource cache.

```text
Rankings = {filter,availableFilters:Filter[],visibility:'hidden'|'visible',
 computedAt:null|ISO,rows:[{memberId,displayName,rank,pointsUnits,
 settledCount,pendingCount}],exactHitRanking?:null|ExactHitRanking}
ExactHitRanking = {computedAt:null|ISO,
 rows:[{memberId,displayName,rank,exactHitCount,settledMatchCount}]}
Filter = 'overall'|'matchday'|'group_stage'|'knockout'|'oracle'
```

`pointsUnits` are safe integers in half-point units, formatted for Spanish
display without recomputing scores. Ranks are supplied positive integers and
preserve ties; no client tie-break is added. Hidden rankings require no rows.

`exactHitRanking` is an optional extension for the four match-based filters.
Omission remains omitted after parsing; explicit null remains null. Both mean
unavailable, not zero. A supplied empty card is distinct from either unavailable
data or a genuine zero-count member row. No route, filter or additional private
pick request is introduced. `oracle` permits omission/null only.

The producer supplies safe nonnegative integer counts, with
`exactHitCount <= settledMatchCount`, positive ranks and its own explicit
`computedAt` (nullable). Rows retain producer order/ranks. Visible exact-hit
rows must contain the entire points-row member cohort with identical public
display names; they may be independently sorted. Hidden parents cannot carry
child member rows, and the renderer suppresses the card altogether. The child
has no second context, raw picks, result/revision IDs or internal provenance.

The [domain contract](exact-hit-ranking.md) counts supplied settled prediction
pairs, not the full fixture catalogue, missing picks or pending matches. Its
internal report must be authorized and projected by the future service before
it becomes this DTO. Counts must never be inferred from half-point totals.
The new parser accepts old envelopes, but older strict clients reject the new
field; coordinate producer/client rollout before emitting it. Source tests
cannot establish that coordination or backend disclosure enforcement.

## Prediction mutations

- `PUT /api/groups/:groupId/matches/:matchId/prediction` with
  `{mutationId,baseRevisionId:null|ID,homeGoals,awayGoals,qualifierId:null|ID}`
  → `{groupId,matchId,prediction:Prediction}`.
- `PUT /api/groups/:groupId/oracle` with
  `{mutationId,baseRevisionId:null|ID,picks:Record<categoryID,ID[]>}`
  → `{groupId,revisionId}`.

The service acquires its relevant lock, then checks authoritative wall-clock
time, stored closure, membership and active rules near the write. Revisions are
append-only. An archive/replay context cannot enter a live competition's
ranking. The browser only renders the returned permission and timestamps.

Client save helpers receive `{signal?,match}` or `{signal?,oracle}` as request
options for checking selected IDs against that explicit resource. These local
shape checks are not authorization and do not replace the service's fresh
validation under its transaction lock.
The history helper also receives `{signal?,match}` so its qualifier IDs can be
checked against the explicit current teams without another resource cache.

On a network failure, input and retry identity remain in memory. On HTTP 409,
the client refreshes persisted state while preserving the unsaved draft. It
must require explicit user review before changing the draft's base revision;
neither a fresh preview nor an old local clock resolves a server conflict.

## Remaining backend and acceptance gates

No handler, SQL migration, driver dependency, Auth setting or real tournament
data is created by this DTO/client source. The first shared-service acceptance
path remains verified account → private group creation → invitation redemption
→ persisted member roster. Competitive picks additionally need the unresolved
tournament/rules choices, deadline/reveal/correction enforcement and official
source records. Source client flows and static checks do not prove multiplayer,
privacy, persistence, browser behavior or deployment readiness.
