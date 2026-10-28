import { ApiError } from './api.mjs';

const SECTIONS = new Set(['groups', 'matches', 'knockout', 'oracle', 'rankings', 'rules']);
const EMPTY_DRAFTS = () => ({ predictions: new Map(), conflicts: new Set(), oracleDraft: null, oracleConflict: false, histories: new Map() });
const contextKey = context => JSON.stringify([context.groupId, context.tournamentId, context.rulesetVersionId, context.mode]);
const copyPicks = picks => Object.fromEntries(Object.entries(picks).map(([key, ids]) => [key, [...ids]]));
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

const ERROR_COPY = {
  revision_conflict: 'Hay una versión guardada más reciente. Conservamos tu borrador para que puedas revisarla.',
  invitation_invalid: 'Ese código no es válido. Comprueba que lo has copiado completo.',
  invitation_expired: 'La invitación ha caducado. Pide un código nuevo al grupo.',
  invitation_used: 'La invitación ya no admite más miembros.',
  window_closed: 'El plazo de edición está cerrado. Tu borrador no se ha enviado.',
  rules_not_active: 'El torneo todavía no tiene un reglamento activo.',
  tournament_unconfigured: 'El grupo todavía no tiene un torneo configurado.',
  rate_limited: 'Hay demasiadas solicitudes. Espera un momento antes de intentarlo de nuevo.',
  protocol_invalid: 'La respuesta recibida no se puede mostrar. Tus cambios sin enviar siguen aquí.',
  request_timeout: 'La respuesta ha tardado demasiado. Conservamos el mismo envío para que puedas reintentarlo.',
  network_error: 'No hemos podido confirmar el envío. Tus cambios siguen aquí; reintenta cuando tengas conexión.',
  service_unavailable: 'El servicio no está disponible en este momento. Puedes volver a intentarlo.',
};

/** Browser state only. Authorization, revisions, visibility and scores belong to the service. */
export function createWorkspace({ api, onChange = () => {}, makeId = () => crypto.randomUUID() }) {
  const state = {
    status: 'loading', session: null, groups: [], selectedGroupId: null, section: 'groups',
    groupDetails: null, context: null, matches: null, oracle: null, rankings: null,
    rankingFilter: 'overall', viewLoading: false, viewError: null, message: null, review: null,
    groupDrafts: { newGroupName: '', inviteCode: '' }, pending: new Set(),
  };
  let epoch = 0, viewEpoch = 0, resourceEpoch = 0;
  let sessionRequests = new AbortController(), viewRequests = new AbortController();
  const scopes = new Map(), intents = new Map(), privateInvitations = new Map();
  const changed = () => onChange(state);
  const memberId = () => state.session?.state === 'member' ? state.session.user.id : null;
  const capture = () => ({ epoch, userId: memberId() });
  const current = stamp => stamp.epoch === epoch && stamp.userId === memberId() && stamp.userId !== null;
  const selected = groupId => groupId === state.selectedGroupId;
  const scope = () => {
    if (!state.context) return EMPTY_DRAFTS();
    const key = contextKey(state.context);
    if (!scopes.has(key)) scopes.set(key, { ...EMPTY_DRAFTS(), context: state.context });
    const drafts = scopes.get(key);
    if (stable(drafts.context) !== stable(state.context)) drafts.histories.clear();
    drafts.context = state.context;
    return drafts;
  };

  function clearPrivate() {
    epoch += 1; viewEpoch += 1; resourceEpoch += 1;
    sessionRequests.abort(); viewRequests.abort();
    sessionRequests = new AbortController(); viewRequests = new AbortController();
    api.setCsrfToken(null);
    state.session = null; state.groups = []; state.selectedGroupId = null;
    state.groupDetails = null; state.context = null; state.matches = null; state.oracle = null; state.rankings = null;
    state.groupDrafts = { newGroupName: '', inviteCode: '' };
    state.review = null; state.pending.clear(); state.viewLoading = false; state.viewError = null;
    scopes.clear(); intents.clear(); privateInvitations.clear();
  }

  function bind(envelope, stamp) {
    if (!current(stamp)) return false;
    if (envelope.viewerId !== stamp.userId) throw new ApiError(0, 'session_changed');
    return true;
  }

  function failure(error, groupId = null) {
    if (error?.code === 'request_cancelled') return;
    if (error?.status === 401 || error?.code === 'session_changed') {
      clearPrivate(); state.status = 'error';
      state.message = { kind: 'warning', text: 'La sesión ha cambiado o ha caducado. Vuelve a conectar para continuar.' };
      changed();
      return;
    }
    if (groupId && [403, 404].includes(error?.status)) {
      if (selected(groupId)) {
        viewEpoch += 1; viewRequests.abort(); state.selectedGroupId = null;
        state.groupDetails = null; state.context = null; state.matches = null; state.oracle = null; state.rankings = null;
        state.review = null; state.viewLoading = false;
      }
      state.groups = state.groups.filter(group => group.id !== groupId);
      privateInvitations.delete(groupId);
      for (const value of scopes.values()) if (value.context.groupId === groupId) value.histories.clear();
      state.message = { kind: 'warning', text: 'Ya no se puede acceder a ese grupo. Actualiza tus grupos para continuar.' };
      changed();
      return;
    }
    state.message = { kind: 'error', text: ERROR_COPY[error?.code] ?? 'No se ha podido completar la operación. Tus cambios sin enviar siguen aquí.' };
  }

  async function start() {
    clearPrivate(); state.status = 'loading'; state.message = null; state.viewError = null; changed();
    const startedEpoch = epoch;
    try {
      const response = await api.session({ signal: sessionRequests.signal });
      if (startedEpoch !== epoch) return;
      state.session = response.data;
      state.status = response.data.state;
      if (response.data.state === 'member') {
        api.setCsrfToken(response.data.csrfToken);
        await loadGroups();
      }
    } catch (error) {
      if (startedEpoch !== epoch) return;
      state.status = 'error'; failure(error);
    } finally { if (startedEpoch === epoch) changed(); }
  }

  async function loadGroups(preferred = null) {
    if (!memberId()) return;
    const stamp = capture();
    try {
      const response = await api.groups({ signal: sessionRequests.signal });
      if (!bind(response, stamp)) return;
      state.groups = response.data.groups;
      const target = preferred && state.groups.some(group => group.id === preferred) ? preferred
        : state.groups.some(group => group.id === state.selectedGroupId) ? state.selectedGroupId
          : state.groups[0]?.id ?? null;
      if (target) await selectGroup(target);
      else {
        state.selectedGroupId = null; state.groupDetails = null; state.context = null;
        state.matches = null; state.oracle = null; state.rankings = null;
      }
    } catch (error) { if (current(stamp)) failure(error); }
    finally { if (current(stamp)) changed(); }
  }

  async function selectGroup(groupId) {
    if (!state.groups.some(group => group.id === groupId) || !memberId()) return;
    state.selectedGroupId = groupId; state.groupDetails = null; state.context = null;
    state.matches = null; state.oracle = null; state.rankings = null; state.review = null;
    await loadSelectedGroup();
  }

  async function loadSelectedGroup() {
    const groupId = state.selectedGroupId;
    if (!groupId || !memberId()) return;
    viewRequests.abort(); viewRequests = new AbortController();
    const generation = ++viewEpoch, stamp = capture();
    state.viewLoading = true; state.viewError = null; state.review = null; changed();
    try {
      const [detail, tournament] = await Promise.all([
        api.group(groupId, { signal: viewRequests.signal }),
        api.tournament(groupId, { signal: viewRequests.signal }),
      ]);
      if (!current(stamp) || generation !== viewEpoch || !selected(groupId)) return;
      if (!bind(detail, stamp) || !bind(tournament, stamp)) return;
      if (detail.data.group.tournamentId !== (tournament.data.context?.tournamentId ?? null)) throw new ApiError(0, 'protocol_invalid');
      state.groupDetails = detail.data; state.context = tournament.data.context;
      if (!detail.data.group.permissions.canInvite) privateInvitations.delete(groupId);
      const existing = privateInvitations.get(groupId);
      if (existing) for (const id of existing.keys()) {
        if (!detail.data.invitations.some(invite => invite.id === id && !invite.revoked)) existing.delete(id);
      }
      await loadView();
    } catch (error) {
      if (!current(stamp) || generation !== viewEpoch) return;
      state.viewError = 'No hemos podido cargar el grupo. Tus borradores siguen en esta sesión.';
      failure(error, groupId);
    } finally {
      if (current(stamp) && generation === viewEpoch) { state.viewLoading = false; changed(); }
    }
  }

  async function loadView() {
    const groupId = state.selectedGroupId, context = state.context, section = state.section;
    if (!groupId || !context || !memberId() || ['groups', 'rules'].includes(section)) return;
    viewRequests.abort(); viewRequests = new AbortController();
    const generation = viewEpoch, resource = ++resourceEpoch, stamp = capture(), expected = stable(context);
    state.viewLoading = true; state.viewError = null; state.review = null;
    if (section === 'oracle') state.oracle = null;
    else if (section === 'rankings') state.rankings = null;
    else state.matches = null;
    changed();
    try {
      const options = { signal: viewRequests.signal };
      const response = section === 'oracle' ? await api.oracle(groupId, options)
        : section === 'rankings' ? await api.rankings(groupId, state.rankingFilter, options) : await api.matches(groupId, options);
      if (!current(stamp) || generation !== viewEpoch || resource !== resourceEpoch || !selected(groupId) || section !== state.section) return;
      if (!bind(response, stamp)) return;
      if (stable(response.data.context) !== expected) {
        state.context = null; state.matches = null; state.oracle = null; state.rankings = null;
        state.viewError = 'El torneo o su reglamento ha cambiado. Actualiza el grupo antes de continuar.';
        return;
      }
      if (section === 'oracle') state.oracle = response.data.oracle;
      else if (section === 'rankings') state.rankings = response.data.rankings;
      else state.matches = response.data.matches;
    } catch (error) {
      if (!current(stamp) || generation !== viewEpoch || resource !== resourceEpoch || section !== state.section) return;
      state.viewError = 'No se ha podido actualizar esta vista. Tus borradores siguen aquí.';
      failure(error, groupId);
    } finally { if (current(stamp) && generation === viewEpoch && resource === resourceEpoch) { state.viewLoading = false; changed(); } }
  }

  async function mutate(key, payload, request, confirmed, { groupId = null, conflict } = {}) {
    if (!memberId() || state.pending.has(key)) return;
    const stamp = capture(), fingerprint = stable(payload);
    let intent = intents.get(key);
    try {
      if (!intent || intent.fingerprint !== fingerprint) { intent = { fingerprint, mutationId: makeId() }; intents.set(key, intent); }
    } catch { state.message = { kind: 'error', text: 'Tu navegador no puede preparar este envío. Conservamos tus cambios.' }; changed(); return; }
    state.pending.add(key); state.message = null; changed();
    try {
      const response = await request({ ...payload, mutationId: intent.mutationId }, sessionRequests.signal);
      if (!bind(response, stamp)) return;
      intents.delete(key);
      await confirmed(response, stamp);
    } catch (error) {
      if (!current(stamp)) return;
      if (error?.status === 409 && conflict) await conflict();
      if (!current(stamp)) return;
      failure(error, groupId);
    } finally { if (current(stamp)) { state.pending.delete(key); changed(); } }
  }

  function changePrediction(matchId, values) {
    const match = state.matches?.find(row => row.id === matchId);
    if (!match || !state.context) return;
    const drafts = scope(), previous = drafts.predictions.get(matchId);
    drafts.predictions.set(matchId, { homeGoals: String(values.homeGoals), awayGoals: String(values.awayGoals),
      qualifierId: String(values.qualifierId ?? ''), baseRevisionId: previous ? previous.baseRevisionId : match.ownPrediction?.revisionId ?? null });
  }

  async function savePrediction(matchId, values) {
    const match = state.matches?.find(row => row.id === matchId), context = state.context;
    if (!match || !context || context.rulesState !== 'active' || !match.canEdit) return;
    changePrediction(matchId, values);
    const drafts = scope(), draft = drafts.predictions.get(matchId), groupId = context.groupId;
    if (drafts.conflicts.has(matchId)) return;
    if (!/^(?:0|[1-9][0-9]?)$/.test(draft.homeGoals) || !/^(?:0|[1-9][0-9]?)$/.test(draft.awayGoals)) return;
    const sentDraft = stable(draft);
    const payload = { baseRevisionId: draft.baseRevisionId, homeGoals: Number(draft.homeGoals), awayGoals: Number(draft.awayGoals), qualifierId: draft.qualifierId || null };
    await mutate(`prediction:${contextKey(context)}:${matchId}`, payload,
      (body, signal) => api.savePrediction(groupId, matchId, body, { signal, match }),
      async (_response, stamp) => {
        const newerDraft = drafts.predictions.has(matchId) && stable(drafts.predictions.get(matchId)) !== sentDraft;
        if (newerDraft) drafts.conflicts.add(matchId);
        else { drafts.predictions.delete(matchId); drafts.conflicts.delete(matchId); }
        if (selected(groupId)) {
          await loadView();
          if (current(stamp) && selected(groupId)) state.message = { kind: newerDraft ? 'info' : 'success', text: newerDraft
            ? 'El envío anterior está confirmado. Conservamos tu borrador nuevo; revisa su base antes de guardarlo.' : 'Pronóstico guardado.' };
        }
      }, { groupId, conflict: async () => { drafts.conflicts.add(matchId); if (selected(groupId)) await loadView(); } });
  }

  function changeOracle(picks) {
    if (!state.oracle || !state.context) return;
    const drafts = scope();
    drafts.oracleDraft = { picks: copyPicks(picks), baseRevisionId: drafts.oracleDraft ? drafts.oracleDraft.baseRevisionId : state.oracle.revisionId };
  }

  async function saveOracle(picks) {
    const oracle = state.oracle, context = state.context;
    if (!oracle || !context || context.rulesState !== 'active' || !oracle.canEdit) return;
    changeOracle(picks);
    const drafts = scope(), groupId = context.groupId;
    if (drafts.oracleConflict) return;
    const sentDraft = stable(drafts.oracleDraft);
    const payload = { baseRevisionId: drafts.oracleDraft.baseRevisionId, picks: copyPicks(drafts.oracleDraft.picks) };
    await mutate(`oracle:${contextKey(context)}`, payload,
      (body, signal) => api.saveOracle(groupId, body, { signal, oracle }),
      async (_response, stamp) => {
        const newerDraft = drafts.oracleDraft !== null && stable(drafts.oracleDraft) !== sentDraft;
        if (newerDraft) drafts.oracleConflict = true;
        else { drafts.oracleDraft = null; drafts.oracleConflict = false; }
        if (selected(groupId)) {
          await loadView();
          if (current(stamp) && selected(groupId)) state.message = { kind: newerDraft ? 'info' : 'success', text: newerDraft
            ? 'El envío anterior está confirmado. Conservamos tus elecciones nuevas; revisa su base antes de guardarlas.' : 'Oráculo guardado.' };
        }
      }, { groupId, conflict: async () => { drafts.oracleConflict = true; if (selected(groupId)) await loadView(); } });
  }

  const actions = {
    start, refresh: () => state.selectedGroupId ? loadSelectedGroup() : loadGroups(), selectGroup,
    async selectSection(section) {
      if (!SECTIONS.has(section)) return;
      viewRequests.abort(); viewRequests = new AbortController(); viewEpoch += 1;
      state.section = section; state.review = null; state.viewError = null; state.viewLoading = false;
      if (state.selectedGroupId && !state.groupDetails) await loadSelectedGroup();
      else await loadView();
      changed();
    },
    changeGroupDraft(name, value) { if (['newGroupName', 'inviteCode'].includes(name)) state.groupDrafts[name] = value; },
    async createGroup(name) {
      const submitted = name.trim();
      if (!submitted) return;
      await mutate('group:create', { name: submitted }, (body, signal) => api.createGroup(body, { signal }), async (response, stamp) => {
        if (state.groupDrafts.newGroupName.trim() === submitted) state.groupDrafts.newGroupName = '';
        state.section = 'groups'; await loadGroups(response.data.group.id);
        if (!current(stamp)) return;
        state.message = { kind: 'success', text: 'La creación del grupo está confirmada. Actualiza si todavía no aparece.' };
      });
    },
    async redeemInvitation(code) {
      const submitted = code.trim();
      await mutate('group:join', { code: submitted }, (body, signal) => api.redeemInvitation(body, { signal }), async (response, stamp) => {
        if (state.groupDrafts.inviteCode.trim() === submitted) state.groupDrafts.inviteCode = '';
        state.section = 'groups'; await loadGroups(response.data.group.id);
        if (!current(stamp)) return;
        state.message = { kind: 'success', text: 'El servidor ha confirmado tu incorporación al grupo.' };
      });
    },
    async createInvitation(groupId) {
      if (!selected(groupId) || !state.groupDetails?.group.permissions.canInvite) return;
      await mutate(`invite:create:${groupId}`, {}, (body, signal) => api.createInvitation(groupId, body, { signal }), async (response, stamp) => {
        if (!privateInvitations.has(groupId)) privateInvitations.set(groupId, new Map());
        privateInvitations.get(groupId).set(response.data.invitation.id, response.data.invitation);
        if (selected(groupId)) await loadSelectedGroup();
        if (!current(stamp) || !selected(groupId)) return;
        const available = state.groupDetails?.group.permissions.canInvite
          && state.groupDetails.invitations.some(invite => invite.id === response.data.invitation.id && !invite.revoked);
        state.message = { kind: 'success', text: available ? 'Invitación creada. Copia el código y compártelo con quien quieras invitar.' : 'La creación de la invitación está confirmada. Actualiza el grupo para consultar su estado.' };
      }, { groupId });
    },
    async revokeInvitation(groupId, invitationId) {
      if (!selected(groupId) || !state.groupDetails?.group.permissions.canInvite) return;
      await mutate(`invite:revoke:${groupId}:${invitationId}`, {}, (body, signal) => api.revokeInvitation(groupId, invitationId, body, { signal }), async (_response, stamp) => {
        privateInvitations.get(groupId)?.delete(invitationId);
        if (selected(groupId)) await loadSelectedGroup();
        if (!current(stamp) || !selected(groupId)) return;
        state.message = { kind: 'success', text: 'Invitación revocada.' };
      }, { groupId });
    },
    async leaveGroup(groupId) {
      if (!selected(groupId) || !state.groupDetails?.group.permissions.canLeave) return;
      await mutate(`group:leave:${groupId}`, {}, (body, signal) => api.leaveGroup(groupId, body, { signal }), async (_response, stamp) => {
        privateInvitations.delete(groupId);
        state.groups = state.groups.filter(group => group.id !== groupId);
        if (selected(groupId)) {
          state.selectedGroupId = null; state.section = 'groups';
          state.groupDetails = null; state.context = null; state.matches = null; state.oracle = null; state.rankings = null; state.review = null;
        }
        for (const value of scopes.values()) if (value.context.groupId === groupId) value.histories.clear();
        await loadGroups();
        if (!current(stamp)) return;
        state.message = { kind: 'success', text: 'Has salido del grupo.' };
      }, { groupId });
    },
    async copyInvitation(code) {
      const groupId = state.selectedGroupId, stamp = capture();
      if (!groupId || !state.groupDetails?.group.permissions.canInvite || !state.groupDetails.invitations.some(invite =>
        !invite.revoked && privateInvitations.get(groupId)?.get(invite.id)?.code === code)) return;
      try {
        await navigator.clipboard.writeText(code);
        if (current(stamp) && selected(groupId)) state.message = { kind: 'success', text: 'Código copiado.' };
      }
      catch { if (current(stamp) && selected(groupId)) state.message = { kind: 'warning', text: 'No se ha podido copiar. Selecciona el código y cópialo manualmente.' }; }
      if (!current(stamp) || !selected(groupId)) return;
      changed();
    },
    changePrediction, savePrediction, changeOracle, saveOracle,
    discardPrediction(id) { scope().predictions.delete(id); scope().conflicts.delete(id); state.review = null; changed(); },
    discardOracle() { scope().oracleDraft = null; scope().oracleConflict = false; state.review = null; changed(); },
    reviewPredictionConflict(id) {
      const match = state.matches?.find(row => row.id === id), draft = scope().predictions.get(id);
      if (!match || !draft) return;
      state.review = { kind: 'prediction', matchId: id, revisionId: match.ownPrediction?.revisionId ?? null }; changed();
    },
    reviewOracleConflict() { if (state.oracle && scope().oracleDraft) { state.review = { kind: 'oracle', revisionId: state.oracle.revisionId }; changed(); } },
    acceptReviewedBase() {
      const review = state.review, drafts = scope();
      if (review?.kind === 'prediction') {
        const match = state.matches?.find(row => row.id === review.matchId), draft = drafts.predictions.get(review.matchId);
        if (!match || !draft || (match.ownPrediction?.revisionId ?? null) !== review.revisionId) return;
        draft.baseRevisionId = review.revisionId; drafts.conflicts.delete(review.matchId);
      } else if (review?.kind === 'oracle' && state.oracle && drafts.oracleDraft && state.oracle.revisionId === review.revisionId) {
        drafts.oracleDraft.baseRevisionId = review.revisionId; drafts.oracleConflict = false;
      } else return;
      state.review = null; state.message = { kind: 'info', text: 'Base revisada. Tu borrador sigue sin enviar; guárdalo cuando estés conforme.' }; changed();
    },
    cancelReview() { state.review = null; changed(); },
    async loadHistory(matchId) {
      const groupId = state.selectedGroupId, match = state.matches?.find(row => row.id === matchId), drafts = scope();
      if (!groupId || match?.historyVisibility !== 'visible') return;
      const stamp = capture(), generation = viewEpoch, resource = resourceEpoch, expected = stable(state.context);
      try {
        const response = await api.history(groupId, matchId, { signal: viewRequests.signal, match });
        if (!current(stamp) || generation !== viewEpoch || resource !== resourceEpoch || !selected(groupId)
          || stable(state.context) !== expected || state.matches?.find(row => row.id === matchId)?.historyVisibility !== 'visible') return;
        if (!bind(response, stamp)) return;
        drafts.histories.set(matchId, response.data); changed();
      } catch (error) { if (current(stamp) && generation === viewEpoch && resource === resourceEpoch) { failure(error, groupId); changed(); } }
    },
    async selectRankingFilter(filter) {
      if (!state.rankings?.availableFilters.includes(filter)) return;
      state.rankingFilter = filter; await loadView(); changed();
    },
  };

  return {
    state, actions, start, scope,
    groupInvitations() {
      const detail = state.groupDetails;
      if (!detail) return [];
      return detail.invitations.map(invitation => ({ ...invitation,
        code: detail.group.permissions.canInvite && !invitation.revoked
          ? privateInvitations.get(detail.group.id)?.get(invitation.id)?.code ?? null : null }));
    },
    busyState() {
      const key = state.context && contextKey(state.context);
      const prefix = key && `prediction:${key}:`;
      return {
        group: [...state.pending].some(value => value.startsWith('group:') || value.startsWith('invite:')),
        oracle: key ? state.pending.has(`oracle:${key}`) : false,
        matches: new Set(prefix ? [...state.pending].filter(value => value.startsWith(prefix)).map(value => value.slice(prefix.length)) : []),
      };
    },
    hasUnsent() { return Boolean(state.groupDrafts.newGroupName || state.groupDrafts.inviteCode || [...scopes.values()].some(value => value.predictions.size || value.oracleDraft)); },
    draftExport() { return { schemaVersion: 'la-porra-unsent-v1', scopes: [...scopes.values()].filter(value => value.predictions.size || value.oracleDraft).map(value => ({
      groupId: value.context.groupId, tournamentId: value.context.tournamentId, rulesetVersionId: value.context.rulesetVersionId,
      predictions: [...value.predictions].map(([matchId, draft]) => ({ matchId, ...draft })), oracle: value.oracleDraft,
    })) }; },
  };
}
