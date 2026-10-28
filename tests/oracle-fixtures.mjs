// T2 authored abstract records. These are not real teams, awards or results.
export function oracleInput() {
  return {
    ruleset: {
      id: 'rules-draft-1', version: 'research-2026-oracle-v1', status: 'draft',
      policies: {
        cinderellaTies: 'all',
        flop: { mode: 'fixed-worst', ties: 'all' },
        worstGoalDifference: { scope: 'group', ties: 'all' },
      },
    },
    snapshot: {
      id: 'draw-1', tournamentId: 'authored-tournament',
      teams: [
        { id: 'a', pot: 1, fifaRank: 1 },
        { id: 'b', pot: 1, fifaRank: 2 },
        { id: 'c', pot: 2, fifaRank: 10 },
        { id: 'd', pot: 2, fifaRank: 11 },
        { id: 'e', pot: 3, fifaRank: 20 },
        { id: 'f', pot: 3, fifaRank: 21 },
        { id: 'g', pot: 4, fifaRank: 50 },
        { id: 'h', pot: 4, fifaRank: 60 },
      ],
      players: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(id => ({ id: `player-${id}`, teamId: id })),
    },
    result: {
      id: 'official-revision-1', tournamentId: 'authored-tournament', snapshotId: 'draw-1',
      verified: true, final: true,
      teams: [
        { teamId: 'a', finish: 'champion', groupPoints: 7, groupGoalsFor: 7, groupGoalsAgainst: 1, totalGoalsFor: 14, totalGoalsAgainst: 4 },
        { teamId: 'b', finish: 'group', groupPoints: 0, groupGoalsFor: 1, groupGoalsAgainst: 6, totalGoalsFor: 1, totalGoalsAgainst: 6 },
        { teamId: 'c', finish: 'runner_up', groupPoints: 7, groupGoalsFor: 5, groupGoalsAgainst: 2, totalGoalsFor: 10, totalGoalsAgainst: 3 },
        { teamId: 'd', finish: 'semifinal', groupPoints: 6, groupGoalsFor: 6, groupGoalsAgainst: 2, totalGoalsFor: 10, totalGoalsAgainst: 6 },
        { teamId: 'e', finish: 'semifinal', groupPoints: 5, groupGoalsFor: 3, groupGoalsAgainst: 1, totalGoalsFor: 8, totalGoalsAgainst: 4 },
        { teamId: 'f', finish: 'round_of_16', groupPoints: 4, groupGoalsFor: 3, groupGoalsAgainst: 3, totalGoalsFor: 4, totalGoalsAgainst: 5 },
        { teamId: 'g', finish: 'quarterfinal', groupPoints: 3, groupGoalsFor: 4, groupGoalsAgainst: 5, totalGoalsFor: 7, totalGoalsAgainst: 8 },
        { teamId: 'h', finish: 'group', groupPoints: 2, groupGoalsFor: 2, groupGoalsAgainst: 5, totalGoalsFor: 2, totalGoalsAgainst: 5 },
      ],
      awards: {
        goldenBoot: { verified: true, winnerIds: ['player-a'] },
        goldenBall: { verified: true, winnerIds: ['player-c'] },
        goldenGlove: { verified: true, winnerIds: ['player-e'] },
        youngPlayer: { verified: true, winnerIds: ['player-g'] },
      },
    },
    revision: {
      id: 'pick-revision-1', tournamentId: 'authored-tournament', snapshotId: 'draw-1', rulesetId: 'rules-draft-1',
      picks: {
        champion: 'a', runnerUp: 'c', semifinalists: ['a', 'c', 'd', 'e'],
        goldenBoot: 'player-a', goldenBall: 'player-c', goldenGlove: 'player-e', youngPlayer: 'player-g',
        cinderella: 'g', flop: 'b', worstGoalDifference: 'b',
      },
    },
  };
}

export function category(output, name) {
  const found = output.categories.find(row => row.category === name);
  if (!found) throw new Error(`Missing expected category: ${name}`);
  return found;
}

export function team(input, id) {
  return input.result.teams.find(row => row.teamId === id);
}

export function drawTeam(input, id) {
  return input.snapshot.teams.find(row => row.id === id);
}
