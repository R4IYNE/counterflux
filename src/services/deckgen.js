/**
 * Phase 17 (v1.3) — Client-side deckgen wrapper.
 *
 * Thin layer between the Alpine store and /api/deckgen. Responsibilities:
 *   1. Attach the user's Supabase JWT to every request
 *   2. Hit the Dexie cache first (offline-friendly, instant)
 *   3. On miss: POST /api/deckgen, then mirror the response to Dexie
 *   4. Surface budget errors and AI failures as typed return values
 *      (no throws — store layer can render them without try/catch)
 *
 * Hash recipe matches api/deckgen.js so a client-side cache check produces
 * the same key the server uses. We DO need to know whether the user is in
 * 'collection-only' mode to compute the hash correctly; the caller passes
 * the collection-hash up explicitly.
 */

import { db } from '../db/schema.js';
import { buildCacheKey } from './deckgen-candidates.js';

const ENDPOINT = '/api/deckgen';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a deck via /api/deckgen.
 *
 * @param {Object} input
 * @param {string} input.commanderId
 * @param {number} input.powerLevel        - 1-10
 * @param {string} input.mode              - 'build' | 'fill' | 'upgrade' | 'retune'
 * @param {boolean} input.useCollectionOnly
 * @param {string} input.archetypeHint
 * @param {Array<string>} input.partialCardIds
 * @param {string} input.collectionHash    - From hashCollection() — call site passes this
 *                                           so cache lookups match server-side hashing
 *                                           even when the local Dexie collection diverges
 * @param {Function} input.getAccessToken  - () => Promise<string|null> — returns the
 *                                           current Supabase access token
 * @returns {Promise<{ok: true, response, cacheHit}|{ok: false, code, message}>}
 */
export async function generateDeck(input) {
  const {
    commanderId,
    powerLevel = 5,
    mode = 'build',
    useCollectionOnly = false,
    archetypeHint = '',
    partialCardIds = [],
    collectionHash = 'no-collection',
    deckDiagnostics = '',
    getAccessToken,
    onProgress,
    onCard,
  } = input;

  if (!commanderId) {
    return { ok: false, code: 'invalid_input', message: 'commanderId required' };
  }

  // 1. Local Dexie cache check — fast path, no network, no budget spend
  const cacheKey = buildCacheKey({
    commanderId,
    powerLevel,
    mode,
    archetypeHint,
    collectionHash,
  });
  const cached = await readLocalCache(cacheKey);
  if (cached) {
    return { ok: true, response: cached, cacheHit: true };
  }

  // 2. Resolve access token (Supabase session)
  let token = null;
  try {
    token = typeof getAccessToken === 'function' ? await getAccessToken() : null;
  } catch {
    token = null;
  }
  if (!token) {
    return {
      ok: false,
      code: 'unauthenticated',
      message: 'Sign in to use AI brewing.',
    };
  }

  // 3. POST to /api/deckgen
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        commanderId,
        powerLevel,
        mode,
        useCollectionOnly,
        archetypeHint,
        partialCardIds,
        deckDiagnostics,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      code: 'network_error',
      message: 'Couldn\'t reach the AI — check your connection.',
      detail: err?.message,
    };
  }

  // 4. Pre-stream errors (auth / budget / pool / commander) come back as a
  //    normal JSON body with a non-2xx status. A 200 is an NDJSON STREAM:
  //    {type:'progress',cards} lines while Mila generates, then a final
  //    {type:'done',...} (or {type:'error',code,message} on mid-stream failure).
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch { body = { error: 'invalid response' }; }
    return {
      ok: false,
      code: mapStatusToCode(res.status),
      message: friendlyMessage(res.status, body),
      detail: body,
    };
  }

  const parsed = await readNdjsonStream(res, onProgress, onCard);
  if (parsed.error) {
    return { ok: false, code: parsed.error.code || 'server_error', message: parsed.error.message || 'Brew failed.' };
  }
  if (!parsed.done) {
    return { ok: false, code: 'server_error', message: 'No result came back — try again.' };
  }

  // Strip the protocol field; cache + return the result body.
  const { type, ...response } = parsed.done;
  void type;
  try {
    await writeLocalCache(cacheKey, response);
  } catch {
    // Non-fatal — cache writes failing just means slower next-call
  }

  return { ok: true, response, cacheHit: !!response.cache_hit };
}

// ---------------------------------------------------------------------------
// NDJSON stream reader
// ---------------------------------------------------------------------------

/**
 * Read a 200 /api/deckgen NDJSON stream. Invokes onProgress(cards) for
 * {type:'progress'} events and returns { done, error } where `done` is the
 * final result body and `error` is a mid-stream failure event (if any).
 * Resilient to chunk boundaries; falls back to a buffered parse when the
 * response has no streamable body (older browsers / jsdom tests).
 *
 * @param {Response} res
 * @param {(cards:number)=>void} [onProgress]
 * @param {(card:object)=>void} [onCard]
 * @returns {Promise<{done: object|null, error: object|null}>}
 */
export async function readNdjsonStream(res, onProgress, onCard) {
  const result = { done: null, error: null };
  const handleLine = (line) => {
    const t = (line || '').trim();
    if (!t) return;
    let evt;
    try { evt = JSON.parse(t); } catch { return; }
    if (evt.type === 'progress') {
      if (typeof onProgress === 'function') { try { onProgress(evt.cards || 0); } catch { /* ignore */ } }
    } else if (evt.type === 'card') {
      if (typeof onCard === 'function' && evt.card) { try { onCard(evt.card); } catch { /* ignore */ } }
    } else if (evt.type === 'done') {
      result.done = evt;
    } else if (evt.type === 'error') {
      result.error = evt;
    }
  };

  if (!res.body || typeof res.body.getReader !== 'function') {
    try {
      const text = await res.text();
      for (const line of text.split('\n')) handleLine(line);
    } catch { /* leave result empty → caller treats as no-result */ }
    return result;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handleLine(buffer); // trailing line with no final newline
  } catch {
    if (!result.done && !result.error) {
      result.error = { code: 'network_error', message: 'Lost the connection mid-brew — try again.' };
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Local Dexie cache reads/writes
// ---------------------------------------------------------------------------

async function readLocalCache(hash) {
  try {
    const row = await db.deckgen_cache.get(hash);
    if (!row) return null;
    if (Date.now() - row.fetched_at > CACHE_TTL_MS) return null;
    return row.response;
  } catch {
    return null;
  }
}

async function writeLocalCache(hash, response) {
  await db.deckgen_cache.put({
    hash,
    response,
    fetched_at: Date.now(),
    user_id: null, // populated server-side on the Supabase mirror
  });
}

// ---------------------------------------------------------------------------
// Status code → typed result
// ---------------------------------------------------------------------------

function mapStatusToCode(status) {
  switch (status) {
    case 400: return 'invalid_input';
    case 401: return 'unauthenticated';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 405: return 'method_not_allowed';
    case 409: return 'insufficient_candidates';
    case 413: return 'payload_too_large';
    case 429: return 'budget_exhausted';
    case 502: return 'ai_provider_error';
    case 504: return 'ai_provider_timeout';
    case 500:
    default:  return 'server_error';
  }
}

function friendlyMessage(status, body) {
  if (status === 429) return body?.detail || 'Daily brewing limit reached — resets at midnight UTC.';
  if (status === 401) return 'Sign in to use AI brewing.';
  if (status === 409) return body?.detail || 'Not enough candidate cards — try again in 24h or pick a more-played commander.';
  if (status === 502) return body?.detail || 'The AI got distracted — try again in a moment.';
  if (status === 504) return body?.detail || 'The AI took too long — try again in a moment.';
  if (status === 400) return body?.error || 'Request was invalid.';
  return body?.error || 'Something went wrong.';
}
