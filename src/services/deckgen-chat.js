/**
 * v1.3.x — Client-side Mila Brew Chat wrapper.
 *
 * Thin layer between the deckgenChat Alpine store and /api/deckgen-chat.
 * Mirrors src/services/deckgen.js generateDeck():
 *   1. Attach the user's Supabase JWT
 *   2. POST the conversation + deck context
 *   3. Surface budget/AI errors as typed return values (no throws)
 *
 * Unlike deckgen there is NO local cache — a chat turn is contextual
 * (depends on the whole conversation + current deck), so caching would
 * break multi-turn behaviour.
 */

const ENDPOINT = '/api/deckgen-chat';

/**
 * Send one chat turn to Mila.
 *
 * @param {Object} input
 * @param {string} input.commanderId
 * @param {number} input.powerLevel
 * @param {boolean} input.useCollectionOnly
 * @param {Array<{role:'user'|'assistant', content:string}>} input.messages - running conversation
 * @param {Array<{scryfall_id:string, name:string}>} input.deckCards - current deck (for cut targets)
 * @param {Function} input.getAccessToken - () => Promise<string|null>
 * @returns {Promise<{ok:true, reply, adds, cuts, budgetRemaining}|{ok:false, code, message}>}
 */
export async function sendChatMessage(input) {
  const {
    commanderId,
    powerLevel = 5,
    useCollectionOnly = false,
    messages = [],
    deckCards = [],
    deckDiagnostics = '',
    getAccessToken,
  } = input;

  if (!commanderId) {
    return { ok: false, code: 'invalid_input', message: 'commanderId required' };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, code: 'invalid_input', message: 'messages required' };
  }

  let token = null;
  try {
    token = typeof getAccessToken === 'function' ? await getAccessToken() : null;
  } catch {
    token = null;
  }
  if (!token) {
    return { ok: false, code: 'unauthenticated', message: 'Sign in to chat with Mila.' };
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ commanderId, powerLevel, useCollectionOnly, messages, deckCards, deckDiagnostics }),
    });
  } catch (err) {
    return {
      ok: false,
      code: 'network_error',
      message: 'Mila couldn\'t reach the AI — check your connection.',
      detail: err?.message,
    };
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = { error: 'invalid response' };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: mapStatusToCode(res.status),
      message: friendlyMessage(res.status, body),
      detail: body,
    };
  }

  return {
    ok: true,
    reply: typeof body?.reply === 'string' ? body.reply : '',
    adds: Array.isArray(body?.adds) ? body.adds : [],
    cuts: Array.isArray(body?.cuts) ? body.cuts : [],
    budgetRemaining: typeof body?.budget_remaining === 'number' ? body.budget_remaining : null,
  };
}

function mapStatusToCode(status) {
  switch (status) {
    case 400: return 'invalid_input';
    case 401: return 'unauthenticated';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 405: return 'method_not_allowed';
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
  if (status === 401) return 'Sign in to chat with Mila.';
  if (status === 404) return body?.error || 'Couldn\'t find that commander.';
  if (status === 502) return body?.detail || 'Mila got distracted — try again in a moment.';
  if (status === 504) return body?.detail || 'Mila took too long — try again in a moment.';
  if (status === 400) return body?.error || 'Request was invalid.';
  return body?.error || 'Something went wrong.';
}
