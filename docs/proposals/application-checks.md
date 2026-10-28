# Proposed application client checks

Last updated: 2026-10-28

Status: **approved and executed: all 38 passed.** Alvaro approved this published
two-file scope, and one local Node 24.21.0 run completed against source
`7516c13c030f12e027f5b5844ffdba95a13afee2`, with no failures, cancellations,
skips, TODOs or retries. The [machine receipt](../results/2026/10-28/application-checks.json)
and [raw TAP output](../results/2026/10-28/application-checks.tap) retain the exact
source hashes, command, runtime and totals. The proposal below preserves the
approved boundary; the earlier [119 domain checks](core-checks.md) remain a
separate closed scope.

## Exact action proposed

Use an already installed Node 22+ binary, without installation or runtime/configuration
changes, to run only these two files once from the owning repository. Record
the actual version and executable; no runtime selection/install is requested here.

```sh
node --test --test-concurrency=1 tests/unit/application-api.test.mjs tests/unit/application-state.test.mjs
```

The scope is **22 API cases + 16 controller cases = 38**. Looped assertions
inside a case are not additional cases. Do not substitute the domain glob,
package-wide tests, a browser runner or a CI job. This approval would cover the
named local check command only.

Both files import actual client modules and Node built-ins. API cases inject
authored fetch responses; controller cases inject authored API methods, session
identities and mutation IDs. Deferred responses deliberately complete out of
order, including adapters that ignore abort. Native `Response`, streams,
`AbortController` and mocked timers are local test boundaries. No request reaches
a service, provider or existing account. The abstract teams, users, groups,
timestamps, tokens and invitation codes are disposable authored values.

## API cases

Source: [application-api.test.mjs](../../tests/unit/application-api.test.mjs).
These exercise [api.mjs](../../public/src/api.mjs) and
[protocol.mjs](../../public/src/protocol.mjs) against the
[client/service DTO contract](../references/application-api.md).

| Case | Authored behavior |
| --- | --- |
| API01 | Entire session envelope and same-origin cookie/redirect/cache request flags |
| API02 | Session identity, anonymous/unavailable discriminants and safe login paths |
| API03 | Explicit group permissions, rejected coercion and non-anonymous private envelopes |
| API04 | Requested group scope and null invitation codes in listings |
| API05 | Explicit tournament context, null configuration and group binding |
| API06 | Hidden match picks cannot carry data; visible picks require an array |
| API07 | Goal bounds, qualifier identities and explicit qualifier labels/availability |
| API08 | Current-match history context, resource scope, hidden emptiness and qualifiers |
| API09 | Incomplete own Oráculo selections, ten category identities and option bounds |
| API10 | Independent Oráculo pick/ranking visibility and rejected hidden-data leaks |
| API11 | Requested ranking filter, hidden rows and supplied tied ranks |
| API12 | Explicit valid CSRF token before a mutation can fetch |
| API13 | Seven mutation routes, methods, IDs, CSRF, replay envelopes and group-name correspondence |
| API14 | Rejected ownership spoofing, invalid mutation UUIDs and numeric coercion |
| API15 | Explicit current match for saves; no transport decision about clocks or permission |
| API16 | Complete Oráculo submissions and producer option/cardinality bounds |
| API17 | Prediction acknowledgement corresponds to detached submitted intent |
| API18 | Detached, frozen response records |
| API19 | Finite HTTP error codes and clearing the remembered CSRF token on 401 |
| API20 | Caller cancellation, non-retry, safe network failures, stalled response bodies and late response disposal |
| API21 | Owned 30-second deadline for pending fetch/body adapters and non-blocking cancellation |
| API22 | Invalid JSON/UTF-8, extra envelope fields, unexpected read status and byte limits |

## Controller cases

Source: [application-state.test.mjs](../../tests/unit/application-state.test.mjs).
These call the actual [workspace controller](../../public/src/workspace.mjs).

| Case | Authored behavior |
| --- | --- |
| STATE01 | Anonymous/unavailable sessions issue no private reads or fabricated groups |
| STATE02 | Uncertain prediction retry retains its identity; only acknowledgement confirms success |
| STATE03 | Changed prediction intent receives a new mutation identity |
| STATE04 | Revision conflict preserves input and requires explicit base review before resubmission |
| STATE05 | A newer resource cannot silently accept an outdated conflict comparison |
| STATE06 | Detached whole-Oráculo retry identity and preserved conflict base |
| STATE07 | Late group reads/leave acknowledgements cannot replace another selected group or scope |
| STATE08 | Out-of-order same-group refreshes retain the newest resource |
| STATE09 | Navigation fences late resource data and clears obsolete loading state |
| STATE10 | Changed response viewer clears private state and fences old acknowledgements |
| STATE11 | Restarting as another viewer protects their pending draft/operation |
| STATE12 | Current resource and active server permissions govern writes, without a browser-clock decision |
| STATE13 | Hidden history is not requested; an older response cannot cross a new visibility gate |
| STATE14 | Older prediction/Oráculo acknowledgements preserve newer unsent values |
| STATE15 | Invitation retries retain identity; only the matching acknowledged receipt exposes a code |
| STATE16 | Group access failure clears its private view and previously loaded history |

## Result recording and limits

If approved, record the Node version and executable from the same shell, source
commit and SHA-256 hashes of `public/src/api.mjs`, `public/src/protocol.mjs`,
`public/src/workspace.mjs`, `tests/unit/application-api.test.mjs` and
`tests/unit/application-state.test.mjs`, the command, exit code, raw output hash
and machine-readable totals under the
owning `docs/results/2026/10-28/`. Expected discovery is exactly 38 cases; report
actual pass/fail/cancel/skip/TODO counts without treating a failure as approval
to broaden the run. Any temporary output is bounded, owned and removed after
the canonical receipt is complete. Existing source and worktrees are preserved.

These are frontend source-level checks. They do not mount the DOM views, verify
native form validation/focus/clipboard behavior, run a browser or establish
visual/mobile accessibility. They do not run a server, database, migration,
real Auth/session, provider request, official-data import, model call, dependency
installation, build, CI job or deployment. They cannot prove persisted
idempotency, membership enforcement, database isolation, real deadline/privacy
enforcement, multiplayer acceptance or an activated tournament/rulebook.
