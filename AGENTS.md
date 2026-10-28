# La Porra

- The owning brief and complete delivery scope are in `docs/spec.md`. This is
  a points-only friends' predictions app. Do not add money, prizes with economic
  value, points trading, payments or cash-out.
- Current source includes the draft domain and a Spanish browser client under
  `public/`. No shared service, Auth integration or hosted application exists.
  Preserve the pending tournament decision and explicit unresolved rule policies.
- Shared scoring/window/ranking modules are canonical pure code. Never treat a
  browser calculation or local fixture as server authorization or shared storage.
- Store scores in integer half-point units. Do not round quarterfinal totals or
  multiply qualification bonuses. Draft rules must not silently become active.
- Server ownership must enforce membership, server-time cutoffs, separate pick
  and ranking visibility, append-only revisions and audited result corrections.
  See `docs/architecture.md` before adding persistence or endpoints.
- `docs/references/application-api.md` owns the proposed browser/producer DTOs.
  Keep verified viewer/resource ownership, memory-only drafts, stable retry IDs,
  explicit revision conflict review and producer-owned qualifier policy intact.
  Never add a fake session or seed data to make the unconnected UI look live.
- Use PostgreSQL with a ready-to-host Supabase path for shared persistence.
  Provisioning, schema/Auth/dependency changes and CI need their applicable
  workspace approval. No database or Auth integration is currently approved.
- Use `apply_patch`. Source syntax/import checks and `git diff --check` are safe.
  Do not run backend/domain tests, browser checks, builds or servers without
  explicit approval. The core 119 and application 38 checks passed under their
  separate approved scopes; see `docs/proposals/application-checks.md`. Do not
  extend that approval to backend integration, browsers or a broader suite.
- Personal GitHub source publication is authorized by the all-project goal.
  No model call, paid plan, new account, domain purchase or live data import is
  authorized by this foundation. Record evidence under the owning `docs/`.
