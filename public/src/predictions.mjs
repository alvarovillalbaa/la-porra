import { el, button, field, notice, emptyState, formatDate, formatPoints } from './ui.mjs';

const MATCH_STATUS = { scheduled: 'Programado', live: 'En juego', finished: 'Finalizado', postponed: 'Aplazado' };
const MODES = { live: 'En directo', archive: 'Archivo', replay: 'Repetición' };
const FILTERS = { overall: 'General', matchday: 'Jornada', group_stage: 'Fase de grupos', knockout: 'Eliminatorias', oracle: 'Oráculo' };

function heading(context, title, description) {
  return el('header', { className: 'view-heading' },
    el('p', { className: 'eyebrow' }, context.name),
    el('h1', {}, title), el('p', {}, description),
    el('span', { className: 'status-pill' }, MODES[context.mode]));
}

function timing(label, date) {
  return el('div', {}, el('dt', {}, label), el('dd', {}, formatDate(date)));
}

function qualifierName(match, id) {
  if (id === match.home.id) return match.home.name;
  if (id === match.away.id) return match.away.name;
  return 'Sin elegir';
}

function scoreSummary(match, prediction) {
  if (prediction === null) return el('p', { className: 'muted' }, 'Todavía no has guardado un pronóstico.');
  return el('div', { className: 'own-prediction' },
    el('p', {}, `${match.home.name} ${prediction.homeGoals} – ${prediction.awayGoals} ${match.away.name}`),
    match.qualifierLabel !== null ? el('p', {}, `${match.qualifierLabel}: ${qualifierName(match, prediction.qualifierId)}`) : null,
    el('p', { className: 'muted' }, `Última edición guardada: ${formatDate(prediction.updatedAt)}`));
}

function predictionValues(match, draft) {
  if (draft) return { ...draft };
  const prediction = match.ownPrediction;
  return {
    homeGoals: prediction === null ? '' : String(prediction.homeGoals),
    awayGoals: prediction === null ? '' : String(prediction.awayGoals),
    qualifierId: prediction?.qualifierId ?? '', baseRevisionId: prediction?.revisionId ?? null,
  };
}

function validGoals(value) {
  return /^(?:0|[1-9][0-9]?)$/.test(value);
}

function predictionForm(context, match, draft, conflict, busy, actions) {
  let values = predictionValues(match, draft);
  if (match.qualifierLabel === null) values.qualifierId = '';
  const editable = context.rulesState === 'active' && match.canEdit;
  const disabled = !editable || busy;
  const validation = notice('', 'error');
  validation.hidden = true;
  const changed = patch => {
    values = { ...values, ...patch };
    validation.hidden = true;
    actions.changePrediction(match.id, { ...values });
  };
  const goalInput = (side, name) => field(`Goles de ${name}`, el('input', {
    id: ['prediction', context.groupId, context.tournamentId, context.rulesetVersionId, context.mode, match.id, side].join(':'),
    className: 'score-input', type: 'number', inputmode: 'numeric', min: 0, max: 99, step: 1,
    required: true, disabled, value: values[side],
    onInput: event => changed({ [side]: event.currentTarget.value }),
  }));
  const form = el('form', {
    className: 'prediction-form',
    'aria-label': `Tu pronóstico: ${match.home.name} contra ${match.away.name}`,
    'aria-busy': String(busy),
    onSubmit: event => {
      event.preventDefault();
      if (!editable || busy || conflict) return;
      let error = null;
      if (!validGoals(values.homeGoals) || !validGoals(values.awayGoals)) error = 'Escribe un marcador con goles enteros del 0 al 99.';
      else if (match.qualifierLabel !== null && values.qualifierId
        && ![match.home.id, match.away.id].includes(values.qualifierId)) error = `Revisa «${match.qualifierLabel}»: elige uno de los dos equipos.`;
      else if (match.qualifierRequired && !values.qualifierId) error = `Completa «${match.qualifierLabel}».`;
      if (error) { validation.textContent = error; validation.hidden = false; return; }
      void actions.savePrediction(match.id, { ...values });
    },
  }, el('div', { className: 'score-inputs' }, goalInput('homeGoals', match.home.name),
    el('span', { 'aria-hidden': 'true' }, '–'), goalInput('awayGoals', match.away.name)));
  if (match.qualifierLabel !== null) {
    const qualifier = el('select', { id: ['prediction', context.groupId, context.tournamentId, context.rulesetVersionId, context.mode, match.id, 'qualifier'].join(':'),
      disabled, required: match.qualifierRequired, value: values.qualifierId,
      onChange: event => changed({ qualifierId: event.currentTarget.value }) },
    el('option', { value: '' }, 'Sin elegir'),
    el('option', { value: match.home.id }, match.home.name), el('option', { value: match.away.id }, match.away.name));
    // Set the value after options exist; initial selection must keep the in-memory draft.
    qualifier.value = values.qualifierId;
    form.append(field(match.qualifierLabel, qualifier, {
      hint: 'Elección separada del marcador. Los goles de la tanda de penaltis no se suman al resultado.',
    }));
  }
  form.append(validation,
    el('div', { className: 'inline-actions' },
      button(busy ? 'Guardando…' : 'Guardar pronóstico', null, { type: 'submit', variant: 'primary', disabled: disabled || conflict }),
      draft ? button('Descartar borrador', () => actions.discardPrediction(match.id), { disabled: busy }) : null));
  if (!editable) form.append(notice(context.rulesState !== 'active'
    ? 'Las reglas están en borrador. Los pronósticos todavía no se pueden guardar.'
    : match.editReason ?? 'Este pronóstico no se puede editar.'));
  return form;
}

function otherPredictions(match) {
  if (match.pickVisibility !== 'visible') return notice('Los pronósticos de tus amigos todavía están ocultos.');
  if (!match.otherPredictions.length) return el('p', { className: 'muted' }, 'Todavía no hay otros pronósticos visibles.');
  return el('ul', { className: 'others-list' }, match.otherPredictions.map(row => el('li', {},
    el('strong', {}, row.displayName),
    el('p', {}, `${row.prediction.homeGoals} – ${row.prediction.awayGoals}`),
    match.qualifierLabel !== null ? el('p', {}, `${match.qualifierLabel}: ${qualifierName(match, row.prediction.qualifierId)}`) : null,
    el('p', { className: 'muted' }, `Última edición: ${formatDate(row.prediction.updatedAt)}`))));
}

function historySection(match, history, busy, actions) {
  if (match.historyVisibility !== 'visible') return el('p', { className: 'muted' }, 'El historial de cambios todavía está oculto.');
  const visible = history?.visibility === 'visible';
  return el('section', {}, el('h3', {}, 'Historial de cambios'),
    button(visible ? 'Actualizar historial' : 'Ver historial', () => { void actions.loadHistory(match.id); }, { disabled: busy }),
    visible ? (history.revisions.length
      ? el('ol', { className: 'history-list' }, history.revisions.map(revision => el('li', {},
        el('strong', {}, revision.displayName),
        el('p', {}, `${revision.homeGoals} – ${revision.awayGoals}`),
        match.qualifierLabel !== null ? el('p', {}, `${match.qualifierLabel}: ${qualifierName(match, revision.qualifierId)}`) : null,
        el('p', { className: 'muted' }, formatDate(revision.createdAt)),
        revision.reason === null ? null : el('p', {}, revision.reason))))
      : el('p', { className: 'muted' }, 'No hay revisiones visibles.')) : null);
}

function matchCard(context, match, draft, conflict, busy, history, actions) {
  return el('article', { className: 'match-card' },
    el('header', { className: 'section-heading' },
      el('div', {}, el('p', { className: 'eyebrow' }, `${match.roundLabel} · ${match.matchdayLabel}`),
        el('h2', { className: 'match-card__teams' }, `${match.home.name} – ${match.away.name}`)),
      el('span', { className: 'status-pill' }, MATCH_STATUS[match.status])),
    el('dl', { className: 'deadline-grid' }, timing('Inicio', match.kickoffAt), timing('Cierre de edición', match.cutoffAt), timing('Pronósticos visibles desde', match.revealAt)),
    el('section', {}, el('h3', {}, 'Tu pronóstico guardado'), scoreSummary(match, match.ownPrediction)),
    conflict ? el('section', { className: 'conflict-panel' },
      notice('El pronóstico guardado ha cambiado. Tu borrador sigue aquí; revisa la última versión antes de volver a guardar.', 'warning'),
      button('Revisar última versión guardada', () => actions.reviewPredictionConflict(match.id), { disabled: busy })) : null,
    predictionForm(context, match, draft, conflict, busy, actions),
    el('section', {}, el('h3', {}, 'La porra de tus amigos'), otherPredictions(match)),
    historySection(match, history, busy, actions));
}

export function renderMatches({ context, matches, mode, drafts, conflicts, busy, histories }, actions) {
  const knockout = mode === 'knockout';
  const selected = knockout ? matches.filter(match => match.kind === 'knockout') : matches;
  return el('section', { className: 'view' },
    heading(context, knockout ? 'Eliminatorias' : 'Partidos', knockout
      ? 'Elige el marcador y consulta las elecciones adicionales de cada partido.'
      : 'Un marcador, tus amigos y ganas de acertar.'),
    selected.length ? el('div', { className: 'cards' }, selected.map(match => matchCard(context, match,
      drafts.get(match.id), conflicts.has(match.id), busy.has(match.id), histories.get(match.id), actions)))
      : emptyState(knockout ? 'Aún no hay eliminatorias' : 'Aún no hay partidos', 'Cuando se publiquen los partidos aparecerán aquí.'));
}

function oraclePicks(oracle, draft) {
  return Object.fromEntries(oracle.categories.map(category => [category.id, [...(draft?.picks[category.id] ?? category.selectedIds)]]));
}

function categorySummary(category, ids) {
  if (!ids.length) return 'Sin elegir';
  const options = new Map(category.options.map(option => [option.id, option.label]));
  return ids.map(id => options.get(id)).join(', ');
}

function oracleSaved(oracle) {
  return el('dl', { className: 'rules-list' }, oracle.categories.map(category =>
    el('div', {}, el('dt', {}, category.label), el('dd', {}, categorySummary(category, category.selectedIds)))));
}

function oracleOthers(oracle) {
  if (oracle.pickVisibility !== 'visible') return notice('Las elecciones del Oráculo de tus amigos todavía están ocultas.');
  if (!oracle.otherPicks.length) return el('p', { className: 'muted' }, 'Todavía no hay otras elecciones visibles.');
  return el('ul', { className: 'others-list' }, oracle.otherPicks.map(member => el('li', {},
    el('h3', {}, member.displayName), el('dl', { className: 'rules-list' }, oracle.categories.map(category =>
      el('div', {}, el('dt', {}, category.label), el('dd', {}, categorySummary(category, member.picks[category.id]))))))));
}

export function renderOracle({ context, oracle, draft, conflict, busy }, actions) {
  let picks = oraclePicks(oracle, draft);
  const editable = context.rulesState === 'active' && oracle.canEdit;
  const disabled = !editable || busy;
  const validation = notice('', 'error');
  validation.hidden = true;
  const form = el('form', { 'aria-label': 'Tus elecciones del Oráculo', 'aria-busy': String(busy),
    onSubmit: event => {
      event.preventDefault();
      if (!editable || busy || conflict) return;
      const invalid = oracle.categories.find(category => {
        const ids = picks[category.id];
        return ids.length < category.minSelections || ids.length > category.maxSelections
          || new Set(ids).size !== ids.length || ids.some(id => !category.options.some(option => option.id === id));
      });
      if (invalid) {
        validation.textContent = `Revisa las elecciones de «${invalid.label}»: entre ${invalid.minSelections} y ${invalid.maxSelections}.`;
        validation.hidden = false;
        return;
      }
      void actions.saveOracle(Object.fromEntries(Object.entries(picks).map(([id, ids]) => [id, [...ids]])));
    },
  });
  const categories = oracle.categories.map(category => {
    const multiple = category.maxSelections > 1;
    const select = el('select', { id: ['oracle', context.groupId, context.tournamentId, context.rulesetVersionId, context.mode, category.id].join(':'),
      disabled: disabled || category.maxSelections === 0, multiple, required: category.minSelections > 0,
      ...(multiple ? { size: Math.min(6, Math.max(2, category.options.length)) } : {}),
      onChange: event => {
        const ids = [...event.currentTarget.selectedOptions].map(option => option.value).filter(Boolean);
        picks = { ...picks, [category.id]: ids };
        validation.hidden = true;
        actions.changeOracle(Object.fromEntries(Object.entries(picks).map(([id, selected]) => [id, [...selected]])));
      },
    }, multiple ? null : el('option', { value: '' }, 'Sin elegir'), category.options.map(option =>
      el('option', { value: option.id, selected: picks[category.id].includes(option.id) },
        option.description ? `${option.label} — ${option.description}` : option.label)));
    if (multiple) {
      // ui.el sets the multiple property after children; restore every draft selection together.
      for (const option of select.options) option.selected = picks[category.id].includes(option.value);
    } else select.value = picks[category.id][0] ?? '';
    return el('section', { className: 'oracle-category' },
      el('h2', {}, category.label), el('p', {}, category.description),
      el('p', { className: 'muted' }, `Puntos configurados: ${formatPoints(category.pointsUnits)} · Selecciones: ${category.minSelections}–${category.maxSelections}`),
      field(`Tu elección: ${category.label}`, select, { hint: multiple ? 'Puedes seleccionar varias opciones. En un ordenador, usa Ctrl o ⌘ para añadir o quitar una opción.' : null }));
  });
  form.append(el('div', { className: 'oracle-grid' }, categories), validation,
    el('div', { className: 'inline-actions' },
      button(busy ? 'Guardando…' : 'Guardar Oráculo', null, { type: 'submit', variant: 'primary', disabled: disabled || conflict }),
      draft ? button('Descartar borrador', () => actions.discardOracle(), { disabled: busy }) : null));
  if (!editable) form.append(notice(context.rulesState !== 'active'
    ? 'Las reglas están en borrador. El Oráculo todavía no se puede guardar.'
    : oracle.editReason ?? 'El Oráculo no se puede editar.'));
  return el('section', { className: 'view' },
    heading(context, 'Oráculo', 'Tus grandes pronósticos para todo el torneo.'),
    el('dl', { className: 'deadline-grid' }, timing('Cierre de edición', oracle.cutoffAt),
      el('div', {}, el('dt', {}, 'Elecciones de tus amigos'), el('dd', {}, oracle.pickVisibility === 'visible' ? 'Visibles' : 'Ocultas')),
      el('div', {}, el('dt', {}, 'Ranking del Oráculo'), el('dd', {}, oracle.rankingVisibility === 'visible' ? 'Visible' : 'Oculto'))),
    el('section', {}, el('h2', {}, 'Tus elecciones guardadas'), oracleSaved(oracle)),
    conflict ? el('section', { className: 'conflict-panel' },
      notice('Las elecciones guardadas han cambiado. Conservamos tu borrador; revisa la última versión antes de guardar.', 'warning'),
      button('Revisar última versión guardada', () => actions.reviewOracleConflict(), { disabled: busy })) : null,
    form,
    el('section', {}, el('h2', {}, 'El Oráculo de tus amigos'), oracleOthers(oracle)));
}

function renderExactHitRanking(rankings) {
  if (rankings.visibility !== 'visible' || rankings.filter === 'oracle') return null;
  const exact = rankings.exactHitRanking;
  return el('section', { className: 'exact-hit-ranking' },
    el('h2', {}, 'Marcadores exactos'),
    el('p', { className: 'muted' }, 'Solo cuenta pronósticos con un resultado resuelto. Los empates comparten puesto.'),
    exact == null ? notice('La clasificación de marcadores exactos todavía no está disponible.')
      : [el('p', { className: 'muted' }, `Actualización de marcadores exactos: ${formatDate(exact.computedAt)}`),
        exact.rows.length ? el('div', { className: 'table-scroll' }, el('table', { className: 'rankings-table' },
          el('caption', {}, `Clasificación por marcadores exactos: ${FILTERS[rankings.filter]}`),
          el('thead', {}, el('tr', {}, ['Puesto', 'Amigo', 'Marcadores exactos', 'Pronósticos resueltos'].map(label => el('th', { scope: 'col' }, label)))),
          el('tbody', {}, exact.rows.map(row => el('tr', {},
            el('td', {}, row.rank), el('th', { scope: 'row' }, row.displayName),
            el('td', {}, row.exactHitCount), el('td', {}, row.settledMatchCount))))))
          : emptyState('Sin participantes en esta clasificación', 'No hay participantes incluidos en este filtro.')]);
}

export function renderRankings({ context, rankings }, actions) {
  return el('section', { className: 'view' }, heading(context, 'Clasificación', 'Cada acierto cuenta. Los empates comparten puesto.'),
    el('div', { className: 'filter-tabs', role: 'group', 'aria-label': 'Filtrar clasificación' }, rankings.availableFilters.map(filter =>
      button(FILTERS[filter], () => { void actions.selectRankingFilter(filter); }, { 'aria-pressed': String(rankings.filter === filter) }))),
    el('p', { className: 'muted' }, `Última actualización: ${formatDate(rankings.computedAt)}`),
    rankings.visibility !== 'visible' ? notice('Esta clasificación todavía está oculta. Su publicación tiene un plazo propio.')
      : rankings.rows.length ? el('div', { className: 'table-scroll' }, el('table', { className: 'rankings-table' },
        el('caption', {}, `Clasificación: ${FILTERS[rankings.filter]}`),
        el('thead', {}, el('tr', {}, ['Puesto', 'Amigo', 'Puntos', 'Resueltos', 'Pendientes'].map(label => el('th', { scope: 'col' }, label)))),
        el('tbody', {}, rankings.rows.map(row => el('tr', {},
          el('td', {}, row.rank), el('th', { scope: 'row' }, row.displayName), el('td', {}, formatPoints(row.pointsUnits)),
          el('td', {}, row.settledCount), el('td', {}, row.pendingCount))))))
        : emptyState('La clasificación está por empezar', 'Cuando se publiquen los primeros resultados aparecerán aquí.'),
    renderExactHitRanking(rankings));
}

export function renderRules({ context }) {
  return el('section', { className: 'view' }, heading(context, 'Las reglas de nuestra porra', 'Las mismas reglas para todos los amigos del grupo.'),
    el('dl', { className: 'deadline-grid' },
      el('div', {}, el('dt', {}, 'Versión elegida'), el('dd', {}, context.rulesetVersionId)),
      el('div', {}, el('dt', {}, 'Modo elegido'), el('dd', {}, MODES[context.mode])),
      el('div', {}, el('dt', {}, 'Estado'), el('dd', {}, context.rulesState === 'active' ? 'Activo' : 'Borrador'))),
    context.rulesState === 'draft' ? notice('Este reglamento sigue en borrador. Mostrarlo no activa los pronósticos.') : null,
    el('section', {}, el('h2', {}, 'Reglamento seleccionado'),
      context.rules.length ? el('dl', { className: 'rules-list' }, context.rules.map(rule =>
        el('div', {}, el('dt', {}, rule.label), el('dd', {}, rule.description))))
        : el('p', { className: 'muted' }, 'El servidor todavía no ha publicado el detalle de estas reglas.')),
    el('section', {}, el('h2', {}, 'Decisiones pendientes'),
      context.pendingPolicies.length ? el('ul', {}, context.pendingPolicies.map(policy => el('li', {}, policy)))
        : el('p', { className: 'muted' }, 'El servidor no comunica decisiones pendientes para esta versión.')));
}
