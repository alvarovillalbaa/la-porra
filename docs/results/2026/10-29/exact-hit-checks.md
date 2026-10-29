# Exact-score leaderboard focused results

29 October 2026. **203/203 passed** in one approved local Node run against
[`9cf2fa622852bef9306121d9abe2f9b6fde90ee3`](https://github.com/alvarovillalbaa/la-porra/commit/9cf2fa622852bef9306121d9abe2f9b6fde90ee3).
There were zero failures, cancellations, skips or TODOs and no test rerun.

Alvaro explicitly approved the [published nine-file scope](https://github.com/alvarovillalbaa/la-porra/blob/9cf2fa622852bef9306121d9abe2f9b6fde90ee3/docs/proposals/exact-hit-checks.md)
as "Approve La Porra’s 203 checks". The command used the existing Node 24.21.0
binary with `--test --test-concurrency=1 --test-timeout=10000` and exactly those
nine files; no glob or additional suite ran. The supervisor also imposed a
120-second process cap; it did not fire.

| Scope | Passed |
| --- | ---: |
| Unchanged scoring/windows/ranking/Oráculo | 119 |
| Unchanged API/controller | 38 |
| New exact-hit domain | 24 |
| New exact-hit DTO | 14 |
| New authored-DOM view/seam | 8 |
| **Total** | **203** |

The [machine report](exact-hit-checks.json) records approval, runtime binary
hash, timestamps, exact arguments, source hashes, all 203 unique passing case
names, totals and exit status. The [raw spec output](exact-hit-checks.stdout.txt)
is 17,830 bytes with SHA-256
`51accd2f16e88dbb2246ad263438108f537b9246c9145b8a06a4e31667401e15`;
stderr is empty. All 46 new names are present individually.

An independent read-only audit reconstructed all 203 expected names from source
declarations/literal tables and matched the complete output name set, arguments,
totals, raw digest and all 35 recorded hashes against the published source.
It performed no test rerun. Final documentation/JSON/whitespace checks passed,
including 36 local Markdown links; executed runtime/test inputs are unchanged.

The initial receipt parser expected TAP, while Node emitted its default spec
reporter. The test process exited zero; the recording wrapper rejected missing
TAP totals and exited one. The raw bytes were retained unchanged, renamed to
describe their actual format, and parsed using the spec summary plus all 203
individual passing names. This recording correction is preserved in
`receiptValidation`; no product defect, failing assertion or test rerun was
hidden. All 35 pre-execution source hashes still matched after the run.

The [source fingerprint](exact-hit-source.json) is an immutable preparation
snapshot at `9cf2fa6`, not a claim about later documentation bytes. Subsequent
changes update result/status documentation only; runtime, helper and test
inputs remain identical to the executed source. No scoring or point-ranking
policy changed, and draft rules were not activated.

These T2 cases use authored records, mocked transport/clocks and a small DOM
helper. They exercise the actual aggregation → public projection → parser →
view seam, but do not prove browser layout, focus, touch or accessibility.
No installation, server, browser, database, CI, production data, account,
official-data/provider/model call, deployment or paid action occurred. Shared
persistence, authoritative revision selection/membership/reveal enforcement,
official facts, chosen tournament/ruleset and hosted acceptance remain open.
The original full-app/portfolio goal is not complete.

Results/status documentation were published at
[`ae519aee0a3eacd32ff863c666b525b9a91d4774`](https://github.com/alvarovillalbaa/la-porra/commit/ae519aee0a3eacd32ff863c666b525b9a91d4774).
Connected GitHub ref/tree readback matched all 52 file paths, modes, types and
blob SHAs without truncation; the checkout was clean and no active workflow
exists. This publication receipt changes no executed source or test input.
