# La Porra

Last updated: 2026-10-28

Pronósticos entre amigos, con puntos. Match scores, knockout picks, a tournament
Oráculo and private group rankings.

[Personal GitHub source](https://github.com/alvarovillalbaa/la-porra)

**Draft domain and browser client source.** Spanish group, match, knockout,
Oráculo, ranking and rules screens are authored under `public/`. Shared
persistence, account access, tournament data and hosted acceptance remain
unfinished. The owning
[product contract](docs/spec.md) preserves that scope and the pending decisions.

The original brief describes points only: entry money, valuable prizes, points
trading and cash-out are excluded. Its 2026 rules remain a draft version.

## Source

- `public/`: dependency-free Spanish application client with group/invitation
  forms, independent score/qualifier picks, ten-category Oráculo, server-ranked
  tables, revision history and explicit conflict review. Private drafts stay
  in memory; a manual export contains only your unsent prediction inputs.
- `public/src/api.mjs` and `protocol.mjs`: bounded same-origin JSON transport and
  validated producer-owned DTOs. Every private response is bound to the captured
  verified viewer and resource. See the [proposed API contract](docs/references/application-api.md).
- `public/src/workspace.mjs`: session/resource ownership, stable uncertain-retry
  IDs, stale-response rejection and preservation of newer unsent drafts. It does
  not implement authentication, authorization, storage, clocks or scoring.
- `src/scoring.mjs`: proposed score precedence, round multipliers and separate
  qualification bonuses. Totals use integer half-point units.
- `src/windows.mjs`: predicates for explicit stored cutoff/reveal windows,
  including the closed but unrevealed minute before kickoff. Oráculo picks and
  its ranking have separate reveal times; the service must enforce them.
- `src/ranking.mjs`: settled group totals with shared ranks for equal points.
- `src/oracle.mjs`: all ten draft Oráculo categories, snapshot/cohort validation,
  official-resolution inputs, explicit ambiguous policies, partial settlement
  and revision-bound scoring. See the [record contract](docs/references/oracle-contract.md).
- `tests/*.test.mjs`: 119 approved local domain checks passed against the published source;
  the [machine-readable result](docs/results/2026/10-28/domain-checks.json) records
  exact source hashes and totals.
- `tests/unit/`: 38 new API/controller cases authored but **not executed**.
  Their [focused check proposal](docs/proposals/application-checks.md) is separate
  from the closed domain run; no browser or database proof is claimed.
- [Architecture](docs/architecture.md): server ownership, storage and audit
  contract still to implement.

Node 22+; this source has no dependencies or installation/build step.

```sh
npm run check
git diff --check
```

These check syntax, relative imports, local HTML assets and required documents
without importing product modules or running tests. The focused domain run received the
required workspace approval and completed under [the recorded scope](docs/proposals/core-checks.md).
Source publication does not establish a working predictions service. The
client expects a same-origin `/api/` producer; opening these files alone cannot
sign in, create a real group or persist a pick. No fake account or seeded
tournament is supplied. Hosting and PostgreSQL/Supabase provisioning follow the
[proposed first group-service slice](docs/proposals/group-service.md); no plan
change, shared-account reuse or domain purchase is authorized by this source.

The [initial foundation receipt](docs/results/2026/10-28/foundation.md) preserves
its preparation/publication history. The [Oráculo implementation receipt](docs/results/2026/10-28/oracle-source.md)
records the subsequent source work, approved 119-case run and remaining service
acceptance boundaries.
The [application source receipt](docs/results/2026/10-28/application-source.md)
records the new client, static verification and remaining service gates.
MIT licensed.
