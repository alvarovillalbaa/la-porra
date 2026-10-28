# Initial domain foundation

28 October 2026. Source work toward the active all-project delivery goal;
application and hosted acceptance remain unfinished.

The connected [La Porra brief](https://app.notion.com/p/377a1ee8bd068023a883c8c6bf2434a1)
was fetched and read in full, including its research/proposal labels. Its
returned snapshot is dated 14 June 2026. The existing 26 October intake was
preserved and given a dated correction separating Oráculo pick visibility
from ranking visibility. The [full coverage contract](../../../spec.md) keeps
all mandatory, recommended and optional requirements visible.

## Source prepared

- Proposed match-scoring precedence, round factors and separate qualifier
  bonuses, with exact half-point integer totals and an explicit third-place
  policy rather than an invented qualification rule.
- Stored match cutoff/reveal windows and a persisted-closure input. The minute
  before kickoff remains closed to edits and hidden to other players. Oráculo
  pick and ranking reveal times are separate required fields.
- Shared ranks for equal settled totals, deterministic display order and a
  bounded public projection. This does not enforce membership or privacy.
- Authored domain cases and a [concrete execution proposal](../../../proposals/core-checks.md).
  Backend/domain test execution remains unapproved and has not run.
- Proposed PostgreSQL/Supabase ownership, revisions, official result versions
  and audit invariants in the [architecture contract](../../../architecture.md).
  No migration, database, Auth policy or endpoint has been applied.

The tournament/replay choice remains pending. Less-defined Oráculo awards,
badges, live data and all application/service flows retain their open coverage;
the foundation is not treated as the whole requested product.

## Verification boundary

ES-module syntax, package JSON and required-document checks passed using Node
24.21.0. Source review found no arithmetic/window/ranking blocker; it identified
an unnecessary unused bronze qualifier requirement, which was removed for the
explicit no-bonus policy. Authoritative result fixtures retain coherent scores
and winners. There are 64 authored cases: 46 scoring, 12 timing and 6 ranking.
These counts come from source declarations/array expansion, not a test run.
No domain function or authored test has been executed.

Independent review re-read the bronze-policy repair and corrected result
fixtures and found no remaining source blocker. All 17 initial text files passed
newline/whitespace checks; eight local documentation targets resolve. These
checks do not establish runtime behavior. The dedicated personal GitHub repository
was created under the existing publication authorization. The repository connector
lacks creation capability; the authenticated GitHub CLI created it, and connected
GitHub readback verified the public owner/name and source below.

Checked SHA256 values:

| File | SHA256 |
| --- | --- |
| `src/scoring.mjs` | `45c113a892ed2a526611549f8ae2a915594aec39f3811c6bfaf70181d617b9e9` |
| `src/windows.mjs` | `bd7a944577bae5d2117e9d17f5f6310c5619e268dd2469fd302c312f8165e43a` |
| `src/ranking.mjs` | `559d7d4ecb2bc3eb6f4117a3e68b07e3f63273b10b6f541ebe6f45336ae94fb2` |
| `tests/scoring.test.mjs` | `5d75cc47fe87179bd28a5085b88fad9091602aad899c8a9c7d868a755563a1ae` |
| `tests/windows.test.mjs` | `204700cf547a088ccd36ea0da8ee965c008a127cdeb9a5743773a2b0c6a0cbfe` |
| `tests/ranking.test.mjs` | `be32cbacd4f82a586f9f9a604efb97f0b5cbfc534784a3cd54c6c42ff7e321f4` |

No install, local build, server, browser, database, migration, CI,
model call, account, paid plan, domain purchase or real fixture import ran.
The public FIFA fixtures page returned no readable content through the web
tool; no source-only scoring fixture is claimed as current official data.

## Source publication

The public repository is [`alvarovillalbaa/la-porra`](https://github.com/alvarovillalbaa/la-porra),
repository ID `1436462592`. Initial source
[`4c65ea2ee73857b08bf4b0c8a7f1db045c8991a8`](https://github.com/alvarovillalbaa/la-porra/commit/4c65ea2ee73857b08bf4b0c8a7f1db045c8991a8)
was pushed to main. Immutable connected reads match the local blobs:

- Scoring: `0d05853a2e04c17c8b30a0266e10af0a73f233b4`.
- Windows: `d30c6ece41c5baf8b66bc808cdd4103be76e7d65`.
- Ranking: `7a7af2d2aceb74e6651fe72c7e6f15cee4025bb8`.
- Core-check proposal: `c4668bd25a08bcbd2659b0e5bb2a3474f28d6a49`.

Remote main matched the initial source exactly. The documentation-only follow-up
does not change the reviewed modules or authored tests. A focused local core-test
approval question was presented against the published proposal; it remains
pending. Tournament choice and the owner's Oráculo preference remain pending.
No active workflow, Vercel project or database was created. Application and live
backend/hosted verification remain required under the full product contract.
