import { createApi } from './api.mjs';
import { createWorkspace } from './workspace.mjs';
import { renderGroups, renderGroupDetails } from './groups.mjs';
import { renderMatches, renderOracle, renderRankings, renderRules } from './predictions.mjs';
import { el, button, notice, emptyState } from './ui.mjs';

const container = document.getElementById('app');
const NAVIGATION = [
  ['groups', 'Mis grupos', '01'], ['matches', 'Partidos', '02'], ['knockout', 'Eliminatorias', '03'],
  ['oracle', 'Oráculo', '04'], ['rankings', 'Clasificación', '05'], ['rules', 'Reglas', '06'],
];
let workspace;
workspace = createWorkspace({ api: createApi(), onChange: render });

function loader(title = 'Actualizando tu grupo…') {
  return el('section', { className: 'loading-state', role: 'status' }, el('span', { className: 'loading-mark', 'aria-hidden': 'true' }, '○'), el('p', {}, title));
}

function downloadDrafts() {
  const blob = new Blob([JSON.stringify(workspace.draftExport(), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: 'la-porra-pronosticos-sin-enviar.json' });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reviewPanel(state, drafts) {
  if (!state.review) return null;
  const review = state.review;
  let comparison;
  if (review.kind === 'prediction') {
    const match = state.matches?.find(row => row.id === review.matchId), draft = drafts.predictions.get(review.matchId);
    if (!match || !draft) return null;
    const teamName = id => id === match.home.id ? match.home.name : id === match.away.id ? match.away.name : 'Sin elegir';
    comparison = el('dl', { className: 'review-comparison' },
      el('div', {}, el('dt', {}, 'Último marcador guardado'), el('dd', {}, match.ownPrediction
        ? `${match.home.name} ${match.ownPrediction.homeGoals} – ${match.ownPrediction.awayGoals} ${match.away.name}` : 'Sin pronóstico guardado'),
        match.qualifierLabel !== null ? el('dd', {}, `${match.qualifierLabel}: ${teamName(match.ownPrediction?.qualifierId)}`) : null),
      el('div', {}, el('dt', {}, 'Tu borrador sin enviar'), el('dd', {}, `${match.home.name} ${draft.homeGoals || '—'} – ${draft.awayGoals || '—'} ${match.away.name}`),
        match.qualifierLabel !== null ? el('dd', {}, `${match.qualifierLabel}: ${teamName(draft.qualifierId)}`) : null));
  } else {
    if (!state.oracle || !drafts.oracleDraft) return null;
    comparison = el('dl', { className: 'review-comparison' }, state.oracle.categories.map(category => {
      const labels = ids => ids.map(id => category.options.find(option => option.id === id)?.label ?? id).join(', ') || 'Sin elegir';
      return el('div', {}, el('dt', {}, category.label), el('dd', {}, `Guardado: ${labels(category.selectedIds)}`),
        el('dd', {}, `Tu borrador: ${labels(drafts.oracleDraft.picks[category.id])}`));
    }));
  }
  return el('section', { className: 'review-panel', role: 'region', 'aria-labelledby': 'review-title', tabindex: '-1' },
    el('p', { className: 'eyebrow' }, 'Revisión antes de reenviar'), el('h2', { id: 'review-title' }, 'Compara las dos versiones'),
    comparison, el('p', {}, 'Conservar tu borrador cambia únicamente la versión de referencia. Todavía tendrás que pulsar Guardar para enviarlo.'),
    el('div', { className: 'inline-actions' },
      button('Mantener mi borrador con esta base', workspace.actions.acceptReviewedBase, { variant: 'primary' }),
      button('Seguir revisando', workspace.actions.cancelReview)));
}

function content(state) {
  const busy = workspace.busyState();
  const drafts = workspace.scope();
  if (state.section === 'groups') {
    return el('div', { className: 'groups-layout' },
      renderGroups({ groups: state.groups, selectedGroupId: state.selectedGroupId, session: state.session, busy: busy.group, drafts: state.groupDrafts }, workspace.actions),
      state.viewLoading && !state.groupDetails ? loader() : state.groupDetails ? renderGroupDetails({
        ...state.groupDetails, invitations: workspace.groupInvitations(), busy: busy.group, drafts: state.groupDrafts,
      }, workspace.actions) : state.groups.length ? emptyState('Elige tu grupo', 'Selecciona un grupo para ver sus miembros e invitaciones.') : null);
  }
  if (state.viewLoading) return loader();
  if (state.viewError) return emptyState('No se ha podido actualizar', state.viewError, button('Reintentar', workspace.actions.refresh, { variant: 'primary' }));
  if (!state.selectedGroupId) return emptyState('La porra empieza con tu grupo', 'Crea un grupo o únete con el código de un amigo.', button('Ir a mis grupos', () => workspace.actions.selectSection('groups'), { variant: 'primary' }));
  if (!state.context) return emptyState('Todavía no hay un torneo', 'Los partidos y sus reglas aparecerán cuando el grupo tenga un torneo configurado.', button('Ver mi grupo', () => workspace.actions.selectSection('groups')));
  if (state.section === 'rules') return renderRules({ context: state.context });
  if (state.section === 'oracle') return state.oracle ? renderOracle({ context: state.context, oracle: state.oracle,
    draft: drafts.oracleDraft, conflict: drafts.oracleConflict,
    busy: busy.oracle,
  }, workspace.actions) : loader('Cargando el Oráculo…');
  if (state.section === 'rankings') return state.rankings ? renderRankings({ context: state.context, rankings: state.rankings }, workspace.actions) : loader('Cargando la clasificación…');
  return state.matches ? renderMatches({ context: state.context, matches: state.matches, mode: state.section === 'knockout' ? 'knockout' : 'matches',
    drafts: drafts.predictions, conflicts: drafts.conflicts, busy: busy.matches, histories: drafts.histories,
  }, workspace.actions) : loader('Cargando los partidos…');
}

function entry(state) {
  const heading = state.status === 'anonymous' ? 'La porra se disfruta en grupo.'
    : state.status === 'unavailable' ? 'Tu grupo todavía no está disponible.' : 'No hemos podido conectar.';
  return el('main', { id: 'main', tabindex: '-1' }, el('section', { className: 'entry-state' },
    el('div', { className: 'brand-symbol', 'aria-hidden': 'true' }, 'LP'),
    el('p', { className: 'eyebrow' }, 'La Porra · Entre amigos'), el('h1', {}, heading),
    el('p', {}, state.status === 'anonymous' ? 'Entra para compartir pronósticos, guardar tus elecciones y seguir los aciertos de tus amigos. Solo puntos.'
      : 'Puedes volver a intentarlo cuando el servicio esté disponible.'),
    state.message ? notice(state.message.text, state.message.kind) : null,
    state.status === 'anonymous' ? el('a', { className: 'button button--primary', href: state.session.loginPath }, 'Entrar')
      : button('Volver a intentar', workspace.start, { variant: 'primary' }),
    el('p', { className: 'entry-state__footnote' }, 'Partidos · Eliminatorias · Oráculo')));
}

function render() {
  const state = workspace.state;
  const focusId = document.activeElement?.id;
  const selection = document.activeElement instanceof HTMLInputElement && ['text', 'search'].includes(document.activeElement.type)
    ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  if (state.status === 'loading') { container.replaceChildren(el('main', { id: 'main', tabindex: '-1', 'aria-busy': 'true' }, loader('Conectando con tu grupo…'))); return; }
  if (state.status !== 'member') { container.replaceChildren(entry(state)); return; }
  const group = state.groups.find(item => item.id === state.selectedGroupId);
  const nav = el('nav', { className: 'main-navigation', 'aria-label': 'La Porra' }, NAVIGATION.map(([section, label, number]) =>
    button(label, () => workspace.actions.selectSection(section), { className: `nav-link${state.section === section ? ' nav-link--active' : ''}`,
      'aria-current': state.section === section ? 'page' : null, 'data-number': number })));
  const switcher = state.groups.length ? el('select', { id: 'group-switcher', 'aria-label': 'Tu grupo', value: state.selectedGroupId ?? '',
    onChange: event => workspace.actions.selectGroup(event.currentTarget.value),
  }, state.groups.map(item => el('option', { value: item.id }, item.name))) : el('span', { className: 'muted' }, 'Aún no tienes un grupo');
  const drafts = workspace.scope(), pendingDrafts = workspace.draftExport().scopes.length;
  const sidebar = el('aside', { className: 'sidebar' },
    el('a', { className: 'brand', href: '/', 'aria-label': 'La Porra, inicio', onClick: event => { event.preventDefault(); void workspace.actions.selectSection('groups'); } }, el('span', { className: 'brand-symbol', 'aria-hidden': 'true' }, 'LP'), el('span', {}, 'La Porra')),
    el('p', { className: 'sidebar__caption' }, 'La mejor rivalidad es entre amigos.'), nav,
    el('div', { className: 'sidebar__footer' }, el('span', { className: 'member-avatar', 'aria-hidden': 'true' }, state.session.user.displayName.slice(0, 1).toUpperCase()),
      el('div', {}, el('strong', {}, state.session.user.displayName), el('p', {}, 'Aquí jugamos por puntos.'))));
  const main = el('main', { id: 'main', tabindex: '-1', className: 'app-main', 'aria-busy': String(state.viewLoading) },
    el('header', { className: 'topbar' }, el('div', { className: 'group-switch' }, el(state.groups.length ? 'label' : 'span', { ...(state.groups.length ? { htmlFor: 'group-switcher' } : {}), className: 'eyebrow' }, 'Tu grupo'), switcher),
      el('div', { className: 'topbar__actions' },
        button(state.viewLoading ? 'Actualizando…' : 'Actualizar', workspace.actions.refresh, { disabled: state.viewLoading }))),
    el('div', { className: 'page-content' },
      state.message ? notice(state.message.text, state.message.kind) : null,
      workspace.hasUnsent() ? el('div', { className: 'draft-banner', role: 'status' },
        el('p', {}, 'Tienes cambios sin enviar. Se conservan solo en esta sesión.'),
        pendingDrafts ? button('Descargar borradores de pronósticos', downloadDrafts) : null) : null,
      state.viewError && state.section === 'groups' ? notice(state.viewError, 'error') : null,
      reviewPanel(state, drafts), content(state)),
    el('footer', { className: 'app-footer' }, el('span', {}, group?.name ?? 'La Porra'), el('span', {}, 'Horas en tu zona local. Consulta el cierre de edición de cada partido.')));
  container.replaceChildren(el('div', { className: 'app-layout' }, sidebar, main));
  const focus = focusId && document.getElementById(focusId);
  if (focus) { focus.focus({ preventScroll: true }); if (selection && focus instanceof HTMLInputElement) focus.setSelectionRange(...selection); }
}

window.addEventListener('beforeunload', event => {
  if (!workspace.hasUnsent()) return;
  event.preventDefault(); event.returnValue = '';
});
void workspace.start();
