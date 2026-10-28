# Product contract and delivery coverage

Last updated: 2026-10-28

Source: [La porra in Notion](https://app.notion.com/p/377a1ee8bd068023a883c8c6bf2434a1),
fetched and read in full on 28 October 2026. The connector returns a snapshot
dated 14 June 2026, with the rules labelled research/proposals. This is the
existing app brief under the active all-project GitHub/Vercel/Supabase goal.

## Product

Spanish-language friends' football predictions with three connected surfaces:
matches, knockout qualification picks and a tournament-wide Oráculo. Points
have no economic value. Money entry, cash prizes, trading, cash-out and detailed
betting markets are outside the brief.

The 2026 World Cup dates in the source are in the past. The owner has been asked
whether to support future tournaments with a closed 2026 archive, or historical
2026 replay. Neither a different tournament nor fabricated fixtures are selected
by this foundation. A replay's clock and ranking must be explicitly distinct
from live competitive play; it cannot enter a real closed tournament's ranking.

The source distinguishes **Oráculo picks** revealed at cutoff and the **Oráculo
ranking** hidden until the end. These are compatible gates. The owner may choose
to keep picks hidden longer; a preference question is pending. The domain window
requires both reveal times explicitly and has no implicit visibility default.

## Full requirement coverage

| Requirement from the brief | Current evidence / remaining work |
| --- | --- |
| Friends' groups and private memberships | Browser creation/join/invite/roster views and producer contract authored; verified accounts, private endpoints and storage remain |
| Predict exact score; derive sign and goal difference | Draft pure scoring plus submission/edit UI source; shared persistence and browser acceptance remain |
| Separate knockout qualifier, including shootouts | Draft independent bonus scoring; canonical result ingestion and accepted-pick consistency policy remain |
| Group score uses 90 minutes plus stoppage; knockouts use the score after extra time when played | Result contract only; no provider adapter or real result has been imported |
| Penalty kicks excluded from the score | Explicit result contract; qualifier is a separate field |
| Edit until one minute before kickoff | Snapshot/window source; authoritative server-time enforcement remains |
| Hide picks until kickoff | Separate reveal predicate; private queries/RLS and browser acceptance remain |
| Revision history visible after the match, last edit timestamp | Gated browser history view and revision DTOs authored; database/API enforcement remain |
| Freeze closure across data outages/schedule changes | Stored cutoff and closure-latch predicate; transactional persistence remains |
| Score precedence 5/3/2/1/0 | Draft source; 46 approved match-scoring cases passed across precedence, factors, bonuses and policies |
| Round factors ×1, ×1.5, ×2, ×3 | Half-point integer scoring source; no rounded quarterfinal totals |
| Qualification bonuses +3, final +5; never multiplied | Draft source; focused scoring checks passed |
| Third-place bonus | Requires explicit `winner` or `none`; source says qualified although nobody advances |
| Oráculo before first match | Explicit deadline contract; midnight-local versus opening-minus-60-minutes decision remains |
| Champion20, runner-up12, semifinalists1each, scorer15, MVP12, goalkeeper10, young-player8 | Draft pure records/settlement/scoring with 55 approved Oráculo cases passed; official records, submission and service integration remain |
| Cinderella10 | Pot-four snapshot, full stage/points/GD/goals/pre-tournament-rank ordering and explicit tied-winner policy in draft source; authoritative snapshots and policy activation remain |
| Pufo | Draft source requires explicit fixed10 or stage10/7/5/3 policy and same-stage/tie treatment; owner selection and activation remain unresolved |
| Worst goal difference8 / worst group team | Draft source supports explicit whole-tournament or group-only GD scope with preserved ties; scope choice and category identity remain unresolved |
| Overall, matchday, group-stage, knockout and Oráculo rankings | Pure ranking source and server-owned filter/table UI authored; aggregation, correction/reveal enforcement and runtime acceptance remain |
| Equal-point ranks | Current source shares competition rank; it does not award an extra competitive tie-break |
| Streaks, exact hits, worst day and weekly comeback | Day/week boundaries and simultaneous-match ordering need explicit policy; implementation remains |
| Brujo(3 exact in a row), Gafe(5 misses in a row) | Thresholds retained; ordered-event/badge implementation remains |
| Copión frustrado, Antifútbol, Patriota roto, Oráculo badges | Definitions/thresholds remain incomplete; avoid invented awards |
| FIFA as official result source | Provenance/version contract only; official data access, licensing and result ingestion remain |
| Administrative edits require an audit log | Append-only correction contract; privileged endpoints and database enforcement remain |
| Dedicated personal GitHub repository | Source publication receipt records actual remote evidence |
| Working application on Vercel and necessary shared database | Browser client source authored; backend, provisioning, deployment and full-path verification remain unfinished |

Optional advanced markets from the source (group winners/qualifiers, total goals,
highest-scoring team/match, clean sheets and exact final) remain optional backlog.
Corners, cards, fouls, first-goal minute/scorer, VAR, injuries, substitutions and
similar micro-events are explicitly excluded.

## Rule version and acceptance

`research-2026-v1` identifies proposed match-scoring source, not an activated
tournament rulebook. Before inviting participants, the chosen tournament must
reference an immutable active ruleset with its unresolved policies filled in.
The scorer evaluates recorded score and qualifier picks separately; whether a
decisive predicted score must agree with the qualifier is a submission-policy
decision, not silently enforced by this draft scorer.

The separate `research-2026-oracle-v1` [Oráculo engine contract](references/oracle-contract.md)
keeps missing results and missing policy choices unsettled. Supplying one of its
draft interpretations to a pure function does not approve an active rulebook.
The [approved 119-case domain run](results/2026/10-28/oracle-source.md) supplies
bounded runtime evidence; it does not activate these policies or establish the
remaining application/service requirements.

The [application source receipt](results/2026/10-28/application-source.md)
records the subsequent browser client. Its 38 new authored API/controller cases
are unrun, and no browser/server/database execution is implied. The proposed
[first group-service slice](proposals/group-service.md) does not activate a
tournament, a ruleset, Auth or schema changes.

Completion requires the full app contract, real shared persistence, server-side
time/visibility enforcement, published source and hosted behavior. Syntax or
pure domain tests cannot establish those requirements. The original goal is
not redefined around this initial package.
