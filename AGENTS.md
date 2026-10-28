# La Porra

- The owning brief and complete delivery scope are in `docs/spec.md`. This is
  a points-only friends' predictions app. Do not add money, prizes with economic
  value, points trading, payments or cash-out.
- Current source is a draft domain foundation, not an implemented web app.
  Preserve the pending tournament decision and explicit unresolved rule policies.
- Shared scoring/window/ranking modules are canonical pure code. Never treat a
  browser calculation or local fixture as server authorization or shared storage.
- Store scores in integer half-point units. Do not round quarterfinal totals or
  multiply qualification bonuses. Draft rules must not silently become active.
- Server ownership must enforce membership, server-time cutoffs, separate pick
  and ranking visibility, append-only revisions and audited result corrections.
  See `docs/architecture.md` before adding persistence or endpoints.
- Use PostgreSQL with a ready-to-host Supabase path for shared persistence.
  Provisioning, schema/Auth/dependency changes and CI need their applicable
  workspace approval. No database or Auth integration is currently approved.
- Use `apply_patch`. Source syntax/import checks and `git diff --check` are safe.
  Do not run backend/domain tests, browser checks, builds or servers without
  explicit approval. The prepared core checks are in `docs/proposals/core-checks.md`.
- Personal GitHub source publication is authorized by the all-project goal.
  No model call, paid plan, new account, domain purchase or live data import is
  authorized by this foundation. Record evidence under the owning `docs/`.
