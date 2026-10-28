import { ProtocolError, parseEnvelope, parseMatch, serializeMutation, validateCsrfToken, validateId, RANKING_FILTERS } from './protocol.mjs';

const BACKEND_CODES = new Set([
  'revision_conflict', 'membership_required', 'invitation_invalid', 'invitation_expired', 'invitation_used', 'window_closed', 'rules_not_active',
  'tournament_unconfigured', 'forbidden', 'unauthorized', 'invalid_request', 'service_unavailable', 'rate_limited',
]);
const CODES = new Set([...BACKEND_CODES,
  'protocol_invalid', 'response_too_large', 'request_cancelled', 'request_timeout', 'network_error', 'csrf_unavailable', 'context_required',
  'session_changed', 'request_failed',
]);
const MAX_BYTES = 2 * 1024 * 1024;

export class ApiError extends Error {
  constructor(status, code) {
    const safe = CODES.has(code) ? code : 'request_failed';
    super(safe); this.name = 'ApiError'; this.code = safe;
    this.status = Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0;
  }
}

function options(value, resource) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new ApiError(0, 'invalid_request');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!['signal', resource].filter(Boolean).includes(key) || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw new ApiError(0, 'invalid_request');
  }
  if (value.signal !== undefined && !(value.signal instanceof AbortSignal)) throw new ApiError(0, 'invalid_request');
  return value;
}
function identity(value) { try { return validateId(value); } catch { throw new ApiError(0, 'invalid_request'); } }
const segment = value => encodeURIComponent(identity(value));

function disposeBody(body) {
  try { void body?.cancel().catch(() => undefined); } catch { /* Cancellation cannot delay the result. */ }
}

/** Also bounds injected adapters that ignore AbortSignal, and disposes late responses. */
function untilAbort(value, signal, { onAbort, onLate } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const stop = () => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', stop);
      onAbort?.(); reject(new ApiError(0, 'request_cancelled'));
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    Promise.resolve(value).then(result => {
      if (settled) { onLate?.(result); return; }
      settled = true; signal.removeEventListener('abort', stop); resolve(result);
    }, error => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', stop); reject(error);
    });
  });
}

/** Cookie and CSRF transport only. No identity, authorization, clock or score is invented here. */
export function createApi({ fetch: fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new ApiError(0, 'network_error');
  let csrfToken = null;
  async function request(operation, path, { method = 'GET', input, scope = {}, opts, resourceName } = {}) {
    const config = options(opts, resourceName);
    const mutation = method !== 'GET';
    if (mutation && csrfToken === null) throw new ApiError(0, 'csrf_unavailable');
    if (resourceName && config[resourceName] === undefined) throw new ApiError(0, 'context_required');
    let body, parsedResource, intent;
    try {
      parsedResource = config[resourceName];
      if (operation === 'savePrediction' || operation === 'history') {
        parsedResource = parseMatch(parsedResource);
        if (parsedResource.id !== scope.matchId) throw new ApiError(0, 'invalid_request');
      }
      intent = mutation ? serializeMutation(operation, input, parsedResource) : undefined;
      body = mutation ? JSON.stringify(intent) : undefined;
      if (body !== undefined && new TextEncoder().encode(body).byteLength > MAX_BYTES) throw new ApiError(0, 'invalid_request');
    } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(0, 'invalid_request'); }
    const controller = new AbortController(); let expired = false;
    const cancel = () => controller.abort();
    const timer = setTimeout(() => { expired = true; controller.abort(); }, 30_000);
    config.signal?.addEventListener('abort', cancel, { once: true });
    if (config.signal?.aborted) controller.abort();
    try {
      if (controller.signal.aborted) throw new ApiError(0, 'request_cancelled');
      const response = await untilAbort(fetchImpl(path, { method, credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', ...(mutation ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } : {}) }, body }), controller.signal,
      { onLate: value => disposeBody(value?.body) });
      if (controller.signal.aborted) { disposeBody(response.body); throw new ApiError(0, 'request_cancelled'); }
      if (!response.ok) {
        if (response.status === 401) csrfToken = null;
        let code = 'request_failed';
        try {
          const failure = await json(response, 8192, controller.signal);
          if (failure && typeof failure === 'object' && !Array.isArray(failure)
            && failure.error && typeof failure.error === 'object' && !Array.isArray(failure.error)
            && BACKEND_CODES.has(failure.error.code)) code = failure.error.code;
        } catch (error) { if (controller.signal.aborted) throw error; }
        throw new ApiError(response.status, code);
      }
      if (response.status !== 200 && !(mutation && response.status === 201)) {
        disposeBody(response.body); throw new ApiError(0, 'protocol_invalid');
      }
      const value = await json(response, MAX_BYTES, controller.signal);
      if (controller.signal.aborted) throw new ApiError(0, 'request_cancelled');
      try {
        const envelope = parseEnvelope(operation, value, { ...scope, ...(['savePrediction', 'history'].includes(operation) ? { match: parsedResource } : {}) });
        if (operation === 'createGroup' && envelope.data.group.name !== intent.name) throw new ApiError(0, 'protocol_invalid');
        if (operation === 'savePrediction' && (envelope.data.prediction.homeGoals !== intent.homeGoals
          || envelope.data.prediction.awayGoals !== intent.awayGoals || envelope.data.prediction.qualifierId !== intent.qualifierId)) throw new ApiError(0, 'protocol_invalid');
        return envelope;
      }
      catch { throw new ApiError(0, 'protocol_invalid'); }
    } catch (error) {
      if (config.signal?.aborted) throw new ApiError(0, 'request_cancelled');
      if (expired) throw new ApiError(0, 'request_timeout');
      if (error instanceof ApiError) throw error;
      if (error instanceof ProtocolError) throw new ApiError(0, error.code);
      throw new ApiError(0, 'network_error');
    } finally { clearTimeout(timer); config.signal?.removeEventListener('abort', cancel); }
  }
  const groupPath = groupId => `/api/groups/${segment(groupId)}`;
  return Object.freeze({
    setCsrfToken(value) {
      try { csrfToken = value === null ? null : validateCsrfToken(value); }
      catch { throw new ApiError(0, 'invalid_request'); }
    },
    session: async opts => request('session', '/api/session', { opts }),
    groups: async opts => request('groups', '/api/groups', { opts }),
    group: async (groupId, opts) => request('group', groupPath(groupId), { scope: { groupId: identity(groupId) }, opts }),
    tournament: async (groupId, opts) => request('tournament', `${groupPath(groupId)}/tournament`, { scope: { groupId: identity(groupId) }, opts }),
    matches: async (groupId, opts) => request('matches', `${groupPath(groupId)}/matches`, { scope: { groupId: identity(groupId) }, opts }),
    history: async (groupId, matchId, opts) => request('history', `${groupPath(groupId)}/matches/${segment(matchId)}/history`, { scope: { groupId: identity(groupId), matchId: identity(matchId) }, opts, resourceName: 'match' }),
    oracle: async (groupId, opts) => request('oracle', `${groupPath(groupId)}/oracle`, { scope: { groupId: identity(groupId) }, opts }),
    rankings: async (groupId, filter, opts) => {
      if (!RANKING_FILTERS.includes(filter)) throw new ApiError(0, 'invalid_request');
      return request('rankings', `${groupPath(groupId)}/rankings?${new URLSearchParams({ filter })}`, { scope: { groupId: identity(groupId), filter }, opts });
    },
    createGroup: async (input, opts) => request('createGroup', '/api/groups', { method: 'POST', input, opts }),
    redeemInvitation: async (input, opts) => request('redeemInvitation', '/api/invitations/redeem', { method: 'POST', input, opts }),
    createInvitation: async (groupId, input, opts) => request('createInvitation', `${groupPath(groupId)}/invitations`, { method: 'POST', input, opts }),
    revokeInvitation: async (groupId, inviteId, input, opts) => request('revokeInvitation', `${groupPath(groupId)}/invitations/${segment(inviteId)}`, { method: 'DELETE', input, opts }),
    leaveGroup: async (groupId, input, opts) => request('leaveGroup', `${groupPath(groupId)}/membership`, { method: 'DELETE', input, opts }),
    savePrediction: async (groupId, matchId, input, opts) => request('savePrediction', `${groupPath(groupId)}/matches/${segment(matchId)}/prediction`,
      { method: 'PUT', input, scope: { groupId: identity(groupId), matchId: identity(matchId) }, opts, resourceName: 'match' }),
    saveOracle: async (groupId, input, opts) => request('saveOracle', `${groupPath(groupId)}/oracle`, { method: 'PUT', input, scope: { groupId: identity(groupId) }, opts, resourceName: 'oracle' }),
  });
}

async function json(response, maximum, signal) {
  if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    disposeBody(response.body); throw new ApiError(0, 'protocol_invalid');
  }
  const length = response.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > maximum) {
    disposeBody(response.body); throw new ApiError(0, 'response_too_large');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(0, 'protocol_invalid');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const chunk = await untilAbort(reader.read(), signal, { onAbort: () => disposeBody(reader) }); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) { disposeBody(reader); throw new ApiError(0, 'response_too_large'); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new ApiError(0, 'protocol_invalid'); }
  } finally { reader.releaseLock(); }
}
