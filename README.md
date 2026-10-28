# La Porra

Pronósticos entre amigos, con puntos. Match scores, knockout picks, a tournament
Oráculo and private group rankings.

[Personal GitHub source](https://github.com/alvarovillalbaa/la-porra)

**Initial domain foundation.** The application, shared persistence, account
access, tournament data and hosted acceptance remain unfinished. The owning
[product contract](docs/spec.md) preserves that scope and the pending decisions.

The original brief describes points only: entry money, valuable prizes, points
trading and cash-out are excluded. Its 2026 rules remain a draft version.

## Source

- `src/scoring.mjs`: proposed score precedence, round multipliers and separate
  qualification bonuses. Totals use integer half-point units.
- `src/windows.mjs`: explicit stored cutoff/reveal windows. Match picks remain
  hidden during the minute between cutoff and kickoff. Oráculo picks and its
  ranking have separate reveal times.
- `src/ranking.mjs`: settled group totals with shared ranks for equal points.
- `tests/`: authored domain cases, awaiting execution approval.
- [Architecture](docs/architecture.md): server ownership, storage and audit
  contract still to implement.

Node 22+; this foundation has no dependencies or installation/build step.

```sh
npm run check
git diff --check
```

These check source syntax and documents. Domain test execution requires the
workspace approval described in [the prepared checks](docs/proposals/core-checks.md).
Source publication does not establish a working predictions service. Hosting
and PostgreSQL/Supabase provisioning follow the application and access contract;
no plan change or domain purchase is part of this source foundation.

The latest evidence belongs in [the foundation receipt](docs/results/2026/10-28/foundation.md).
MIT licensed.
