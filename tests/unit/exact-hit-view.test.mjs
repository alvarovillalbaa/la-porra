import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateExactScoreHits } from '../../src/exact-hits.mjs';
import { RULESET_VERSION, scoreMatchPrediction } from '../../src/scoring.mjs';
import { renderRankings } from '../../public/src/predictions.mjs';
import { parseEnvelope } from '../../public/src/protocol.mjs';
import { findAll, snapshot, withAuthoredDOM } from '../helpers/authored-dom.mjs';

// Actual view + ui.mjs, with authored DOM primitives only. No real producer or browser.
const context = Object.freeze({ groupId: 'group', tournamentId: 'tournament', name: 'Torneo de prueba', mode: 'archive',
  rulesetVersionId: 'rules', rulesState: 'draft', rules: [], pendingPolicies: ['Reglas sin activar'] });
const ranking = () => ({
  filter: 'overall', availableFilters: ['overall', 'group_stage', 'oracle'],
  visibility: 'visible', computedAt: '2026-10-28T12:00:00.000Z',
  rows: [{ memberId: 'points_member', displayName: 'Amiga de los puntos', rank: 1,
    pointsUnits: 21, settledCount: 7, pendingCount: 2 }],
});
const exactRow = (overrides = {}) => ({ memberId: 'points_member', displayName: 'Amiga de los puntos',
  rank: 1, exactHitCount: 3, settledMatchCount: 7, ...overrides });
const exactData = rows => ({ computedAt: '2027-02-12T10:00:00.000Z', rows });
const elements = (root, tag) => findAll(root, node => node.tagName === tag.toUpperCase());
const card = root => findAll(root, node => node.className.split(/\s+/).includes('exact-hit-ranking'))[0];
const tableRows = table => elements(table, 'tbody')[0].childNodes.map(row => row.childNodes.map(cell => cell.textContent));
const pointsTable = root => elements(root, 'table').find(table => elements(table, 'caption')[0].textContent.startsWith('Clasificación:'));
const render = (value, selectRankingFilter = async () => {}) => renderRankings(parseEnvelope('rankings', {
  data: { context, rankings: value }, viewerId: 'viewer', serverTime: '2026-10-28T12:00:00.000Z',
}, { groupId: context.groupId, filter: value.filter }).data, { selectRankingFilter });
// These intentionally invalid raw DTOs test rendering defense, not producer admissibility.
const renderDefense = value => renderRankings({ context, rankings: value }, { selectRankingFilter: async () => {} });

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('legacy missing and explicit null exact-hit data show unavailable without invented rows', () => {
  withAuthoredDOM(() => {
    for (const value of [ranking(), { ...ranking(), exactHitRanking: null }]) {
      const view = render(value), section = card(view);
      assert.ok(section);
      assert.match(section.textContent, /todavía no está disponible/);
      assert.equal(elements(section, 'table').length, 0);
      assert.equal(elements(view, 'table').length, 1, 'The existing points table remains available');
      assert.doesNotMatch(section.textContent, /Sin participantes/);
    }
  });
});

test('provided empty exact-hit data has a distinct empty state and its own update time', () => {
  withAuthoredDOM(() => {
    const view = render({ ...ranking(), rows: [], exactHitRanking: exactData([]) }), section = card(view);
    assert.match(section.textContent, /Sin participantes en esta clasificación/);
    assert.match(section.textContent, /Actualización de marcadores exactos:/);
    assert.match(section.textContent, /2027/);
    assert.doesNotMatch(section.textContent, /todavía no está disponible/);
    assert.equal(elements(section, 'table').length, 0);
    assert.equal(pointsTable(view), undefined);
    assert.match(view.textContent, /La clasificación está por empezar/);
  });
});

test('genuine zero exact-hit counts render a participant row rather than unavailable or empty', () => {
  withAuthoredDOM(() => {
    const section = card(render({ ...ranking(), exactHitRanking: exactData([exactRow({ exactHitCount: 0, settledMatchCount: 4 })]) }));
    const table = elements(section, 'table')[0];
    assert.deepEqual(tableRows(table), [['1', 'Amiga de los puntos', '0', '4']]);
    assert.doesNotMatch(section.textContent, /todavía no está disponible|Sin participantes/);
    assert.equal(elements(elements(table, 'tbody')[0], 'th')[0].getAttribute('scope'), 'row');
  });
});

test('exact-hit producer order ranks and equal-count ties remain unchanged', () => {
  withAuthoredDOM(() => {
    const rows = [
      exactRow({ memberId: 'zeta', displayName: 'Zeta', rank: 1, exactHitCount: 3, settledMatchCount: 5 }),
      exactRow({ memberId: 'alpha', displayName: 'Alfa', rank: 1, exactHitCount: 3, settledMatchCount: 9 }),
      exactRow({ memberId: 'mu', displayName: 'Mu', rank: 3, exactHitCount: 1, settledMatchCount: 4 }),
    ];
    const pointRows = rows.map((row, index) => ({ memberId: row.memberId, displayName: row.displayName, rank: index + 1,
      pointsUnits: 30 - index, settledCount: row.settledMatchCount, pendingCount: 0 }));
    const value = freeze({ ...ranking(), rows: pointRows, exactHitRanking: exactData(rows) });
    const before = JSON.stringify(value);
    const table = elements(card(render(value)), 'table')[0];
    assert.deepEqual(tableRows(table), [['1', 'Zeta', '3', '5'], ['1', 'Alfa', '3', '9'], ['3', 'Mu', '1', '4']]);
    assert.equal(JSON.stringify(value), before);
  });
});

test('integer exact-hit statistics leave half-point totals and existing filter actions intact', () => {
  withAuthoredDOM(() => {
    const scope = { groupId: context.groupId, tournamentId: context.tournamentId,
      mode: context.mode, rulesetVersionId: context.rulesetVersionId };
    const score = { home: 2, away: 1, qualifier: 'home' };
    const pair = {
      prediction: { id: 'prediction_revision', ...scope, memberId: 'points_member', matchId: 'quarterfinal', score: { ...score } },
      result: { id: 'result_revision', tournamentId: scope.tournamentId, mode: scope.mode, matchId: 'quarterfinal',
        round: 'quarterfinal', verified: true, final: true, score: { ...score } },
    };
    const report = aggregateExactScoreHits({ selectionId: 'selected_revisions', scope,
      ruleset: { id: scope.rulesetVersionId, version: RULESET_VERSION, status: 'draft' },
      memberIds: ['points_member'], settlements: [pair] });
    const points = scoreMatchPrediction({ round: pair.result.round, prediction: pair.prediction.score, result: pair.result.score });
    assert.equal(points.totalHalfPoints, 21);
    assert.deepEqual(report.rows, [{ memberId: 'points_member', exactHitCount: 1, settledMatchCount: 1, rank: 1 }]);
    const original = { ...ranking(), rows: [{ memberId: 'points_member', displayName: 'Amiga de los puntos', rank: 1,
      pointsUnits: points.totalHalfPoints, settledCount: 1, pendingCount: 0 }] }, calls = [];
    const publicRows = report.rows.map(row => ({ ...row,
      displayName: original.rows.find(member => member.memberId === row.memberId).displayName }));
    const before = snapshot(pointsTable(render(original)));
    const view = render({ ...original, exactHitRanking: exactData(publicRows) }, async filter => { calls.push(filter); });
    assert.deepEqual(snapshot(pointsTable(view)), before, 'The points table keeps its exact structure and values');
    assert.deepEqual(tableRows(pointsTable(view)), [['1', 'Amiga de los puntos', '10,5', '1', '0']]);
    const exact = elements(card(view), 'table')[0];
    assert.deepEqual(tableRows(exact), [['1', 'Amiga de los puntos', '1', '1']]);
    assert.deepEqual(elements(exact, 'thead')[0].childNodes[0].childNodes.map(cell => cell.textContent),
      ['Puesto', 'Amigo', 'Marcadores exactos', 'Pronósticos resueltos']);
    const filters = elements(view, 'button');
    assert.deepEqual(filters.map(button => button.textContent), ['General', 'Fase de grupos', 'Oráculo']);
    filters[1].emit('click');
    assert.deepEqual(calls, ['group_stage']);
  });
});

test('hidden parent rankings render neither the exact-hit card nor supplied member details', () => {
  withAuthoredDOM(() => {
    const value = { ...ranking(), visibility: 'hidden', rows: [],
      exactHitRanking: exactData([exactRow({ displayName: 'PRIVATE_HIDDEN_EXACT_NAME' })]) };
    const view = renderDefense(value);
    assert.equal(card(view), undefined);
    assert.equal(elements(view, 'table').length, 0);
    assert.match(view.textContent, /Esta clasificación todavía está oculta/);
    assert.doesNotMatch(view.textContent, /PRIVATE_HIDDEN_EXACT_NAME|Marcadores exactos/);
  });
});

test('Oráculo rankings exclude the exact-hit card regardless of an optional fixture payload', () => {
  withAuthoredDOM(() => {
    for (const extension of [{}, { exactHitRanking: null }, { exactHitRanking: exactData([exactRow({ displayName: 'INAPPLICABLE_EXACT_NAME' })]) }]) {
      const view = renderDefense({ ...ranking(), filter: 'oracle', ...extension });
      assert.equal(card(view), undefined);
      assert.doesNotMatch(view.textContent, /Marcadores exactos|INAPPLICABLE_EXACT_NAME|todavía no está disponible/);
      assert.equal(elements(pointsTable(view), 'caption')[0].textContent, 'Clasificación: Oráculo');
    }
  });
});

test('exact-hit names remain literal text with semantic table labels and no input mutation', () => {
  withAuthoredDOM(() => {
    const name = '<img src=x onerror=PRIVATE_HANDLER> & amiga';
    const original = ranking(); original.rows[0].displayName = name;
    const value = freeze({ ...original, filter: 'group_stage', exactHitRanking: { computedAt: null, rows: [exactRow({ displayName: name })] } });
    const before = JSON.stringify(value), section = card(render(value));
    const table = elements(section, 'table')[0];
    assert.equal(elements(table, 'caption')[0].textContent, 'Clasificación por marcadores exactos: Fase de grupos');
    assert.equal(tableRows(table)[0][1], name);
    assert.equal(elements(section, 'img').length, 0);
    assert.equal(elements(section, 'script').length, 0);
    assert.match(section.textContent, /Por confirmar/);
    assert.equal(JSON.stringify(value), before);
  });
});
