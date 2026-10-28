# Approved domain checks

Last updated: 2026-10-28

Status: explicitly approved and completed under the supplied AGENTS.md §7
backend-test gate. Alvaro answered **“Approve La Porra’s 119 checks”** for the
scope frozen at `928a10d01dec5cdc41f418c38d24ba74dea004d3`. All **119 passed**:
64 existing match/window/ranking cases and 55 new Oráculo cases, with zero
failures, skips, cancellations or TODOs. This approval superseded the earlier
unexecuted 64-case proposal. See the [result receipt](../results/2026/10-28/oracle-source.md)
and [exact report](../results/2026/10-28/domain-checks.json).

Approved action: run `node --test tests/*.test.mjs` once in this local repository
using an already installed Node 22+ binary. The cases import only repository
ES modules and Node built-ins. They exercise proposed score precedence, exact
half-point arithmetic, separate qualification bonuses, explicit third-place
policies, cutoff/reveal boundaries, closure latches, independent Oráculo gates,
and group ranking ties/validation. The additional Oráculo cases cover all ten
category weights, official award ties, pot-four Cinderella ordering, explicit
Pufo policies, worst-goal-difference scope, unresolved results/policies,
correction/revision bindings, immutable inputs and malformed records.

This needs no dependency installation, server, database, migration, Auth change,
browser, network request, official fixture import, model call, CI job, paid plan
or account. All test values are authored abstract examples. Record the Node
version and exact source/results; an approval of this proposal does not activate
the draft rules or authorize a separate CI/backend/browser/infrastructure run.

The passing run establishes pure domain behavior for the authored cases. It does
not establish membership, deadlines on a real server, hidden-pick privacy,
official results, persistence, UI, deployment or full app acceptance.
