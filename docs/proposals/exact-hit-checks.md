# Proposed exact-hit and regression checks

29 October 2026. **Approved and executed: all 203 passed.**

Alvaro approved this exact nine-file scope as "Approve La Porra’s 203 checks".
One local Node 24.21.0 run against
[`9cf2fa622852bef9306121d9abe2f9b6fde90ee3`](https://github.com/alvarovillalbaa/la-porra/commit/9cf2fa622852bef9306121d9abe2f9b6fde90ee3)
passed 203/203, with no failed, cancelled, skipped or TODO cases and no rerun.
The [result receipt](../results/2026/10-29/exact-hit-checks.md),
[machine report](../results/2026/10-29/exact-hit-checks.json) and
[raw output](../results/2026/10-29/exact-hit-checks.stdout.txt) preserve the run
and a corrected reporter-format receipt error. The proposal below retains the
approved boundary; additional cases/execution remain outside it.

The completed 119 core and 38 application checks belong to their previously
approved source snapshots. This proposal is a new, bounded 203-case scope for
the [exact-hit change](../references/exact-hit-ranking.md). The repository
`AGENTS.md` and supplied workspace instructions §7 require explicit approval
before backend/domain or browser execution; no browser is proposed here.

## Exact action

Use the existing Node 24.21.0 executable from the same shell, without installing
anything, and run only these nine files from the owning repository:

```sh
node --test --test-concurrency=1 --test-timeout=10000 \
  tests/scoring.test.mjs tests/windows.test.mjs tests/ranking.test.mjs \
  tests/oracle.test.mjs tests/unit/application-api.test.mjs \
  tests/unit/application-state.test.mjs tests/unit/exact-hit-ranking.test.mjs \
  tests/unit/exact-hit-protocol.test.mjs tests/unit/exact-hit-view.test.mjs
```

No globs or discovery of other suites. Node's timeout is 10 seconds per case,
not a global process deadline. Existing fixtures use authored records, mocked
transport/clocks and an authored minimal DOM; no real endpoint is contacted.

| Scope | Cases | Purpose |
| --- | ---: | --- |
| Original four domain files | 119 | Unchanged scoring, windows, totals and Oráculo regressions |
| Original two application files | 38 | Transport/privacy and controller ownership regressions |
| `exact-hit-ranking.test.mjs` | 24 | Exactness versus points/qualifiers, rounds, ties, revision replacement/coherence, scope, draft policies, rejection, bounds and immutable projections |
| `exact-hit-protocol.test.mjs` | 14 | Legacy omission/null, strict child shape/counts, full public cohort, hidden/Oráculo privacy and detached records |
| `exact-hit-view.test.mjs` | 8 | Unavailable/empty/zero states, supplied ordering/ties, integer counts, half-point coexistence, unchanged filter action, hidden/Oráculo defenses and literal text |
| **Total** | **203** | **46 new cases plus 157 regressions** |

One view case traverses the actual aggregation → public DTO validation → view
functions with authored DOM primitives. It does not run Chromium or establish
visual, touch, layout, focus or browser accessibility behavior. New case names,
per-file counts and pre-execution source SHA-256s are frozen in the
[source fingerprint](../results/2026/10-29/exact-hit-source.json).

## Recording and repair boundary

Record approval, source commit, actual Node version/binary hash, nine explicit
files, frozen-input hashes, command, exit/signal, raw output hashes and actual
pass/fail/cancel/skip/TODO counts under the owning dated results directory.
Expected discovery is exactly 203; missing/extra cases cannot count as success.
Retain failures. If the approved run exposes a defect in this exact-hit scope,
make a bounded repair and rerun these same cases with updated source hashes;
record each attempt. Added cases or broader execution need a new scope.

No installation, dependency/runtime change, build, server, browser, database,
migration, real account/session, official data, production data, CI, deployment,
provider request, model call, payment or paid enrollment is proposed. The run
cannot establish persistent revision selection/idempotency, official results,
membership/reveal enforcement, active tournament rules or multiplayer/hosted
acceptance. Source publication is authorized separately by the all-project goal.
