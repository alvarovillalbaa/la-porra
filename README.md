# La Porra

Last updated: 2026-10-28

Pronósticos entre amigos, con puntos. Match scores, knockout picks, a tournament
Oráculo and private group rankings.

[Personal GitHub source](https://github.com/alvarovillalbaa/la-porra)

**Draft domain implementation.** The application, shared persistence, account
access, tournament data and hosted acceptance remain unfinished. The owning
[product contract](docs/spec.md) preserves that scope and the pending decisions.

The original brief describes points only: entry money, valuable prizes, points
trading and cash-out are excluded. Its 2026 rules remain a draft version.

## Source

- `src/scoring.mjs`: proposed score precedence, round multipliers and separate
  qualification bonuses. Totals use integer half-point units.
- `src/windows.mjs`: predicates for explicit stored cutoff/reveal windows,
  including the closed but unrevealed minute before kickoff. Oráculo picks and
  its ranking have separate reveal times; the service must enforce them.
- `src/ranking.mjs`: settled group totals with shared ranks for equal points.
- `src/oracle.mjs`: all ten draft Oráculo categories, snapshot/cohort validation,
  official-resolution inputs, explicit ambiguous policies, partial settlement
  and revision-bound scoring. See the [record contract](docs/references/oracle-contract.md).
- `tests/`: 119 approved local domain checks passed against the published source;
  the [machine-readable result](docs/results/2026/10-28/domain-checks.json) records
  exact source hashes and totals.
- [Architecture](docs/architecture.md): server ownership, storage and audit
  contract still to implement.

Node 22+; this foundation has no dependencies or installation/build step.

```sh
npm run check
git diff --check
```

These check source syntax and documents. The focused domain run received the
required workspace approval and completed under [the recorded scope](docs/proposals/core-checks.md).
Source publication does not establish a working predictions service. Hosting
and PostgreSQL/Supabase provisioning follow the application and access contract;
no plan change or domain purchase is part of this source foundation.

The [initial foundation receipt](docs/results/2026/10-28/foundation.md) preserves
its preparation/publication history. The [Oráculo implementation receipt](docs/results/2026/10-28/oracle-source.md)
records the subsequent source work, approved 119-case run and remaining service
acceptance boundaries.
MIT licensed.
