// src/services/scryfall-queue.js
// Rate-limited Scryfall request queue per Scryfall ToS (50-100ms min spacing
// + required User-Agent header). Previously referenced by CONTEXT.md +
// STACK.md but did not exist (Phase 8 Research Pitfall 1) — this module is
// the foundation that Plans 2 and 3 consume (plus a retroactive refactor
// of src/services/sets.js).
//
// Contract:
//   - Minimum 100ms spacing between consecutive fetches (defensive vs
//     Scryfall's 50-100ms guideline; matches PITFALLS.md §13).
//   - Injects `User-Agent: Counterflux/1.1 (MTG collection manager)`.
//   - Serialises concurrent invocations (promise chain, not parallel).
//   - Throws `Error('Scryfall {status}: {url}')` on non-2xx responses so
//     callers can surface errors to the UI.

const USER_AGENT = 'Counterflux/1.1 (MTG collection manager)';
const MIN_DELAY_MS = 100;
const MAX_RETRIES = 3;       // L5 — bounded retries on 429/503
const BACKOFF_MS = 1000;

let _lastRequestAt = 0;
let _queue = Promise.resolve();

/**
 * Serially-queued fetch against Scryfall with minimum 100ms spacing between
 * requests and required User-Agent header. Throws on non-2xx status.
 *
 * @param {string} url - Scryfall API URL (full, including https://api.scryfall.com/)
 * @param {RequestInit} [options] - Standard fetch options; headers are merged
 *   with the required User-Agent (caller-supplied headers take precedence
 *   for non-User-Agent keys).
 * @returns {Promise<any>} Parsed JSON response body.
 */
export function queueScryfallRequest(url, options = {}) {
  _queue = _queue.then(() => _fetchWithRetry(url, options, 0));
  return _queue;
}

async function _fetchWithRetry(url, options, attempt) {
  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY_MS - (now - _lastRequestAt));
  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  _lastRequestAt = Date.now();
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      ...(options.headers || {}),
    },
  });

  // L5 — honour Retry-After on 429 (rate limit) / 503 with bounded backoff
  // before surfacing the error; the wait holds the serial queue so we don't
  // pile more requests onto an already-throttled endpoint.
  if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
    const retryAfter = parseInt(response.headers?.get?.('retry-after') || '', 10);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : BACKOFF_MS * (attempt + 1);
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
    return _fetchWithRetry(url, options, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Scryfall ${response.status}: ${url}`);
  }
  return response.json();
}

/**
 * Exported for tests ONLY — resets the module-level queue state so that
 * timing assertions between tests are independent. Do not use in production.
 */
export function __resetQueueForTests() {
  _lastRequestAt = 0;
  _queue = Promise.resolve();
}
