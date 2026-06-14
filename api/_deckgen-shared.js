/**
 * v1.3.x — Shared server helpers for the deckgen endpoints.
 *
 * Extracted verbatim from api/deckgen.js (Phase 17) so /api/deckgen and
 * /api/deckgen-chat share ONE copy of JWT verification, budget enforcement,
 * and the Scryfall/EDHREC lookups rather than drifting two copies. The
 * function bodies are unchanged from the originals — this is a relocation,
 * not a behaviour change.
 *
 * deckgen-specific concerns (the deckgen_cache read/write, candidate-pool
 * orchestration, recommended[] parsing) stay in their own endpoints.
 */

import { createClient } from '@supabase/supabase-js';

export const DAILY_BUDGET = 20;
// Audit fix #5: conversational refinement is cheap (Sonnet) and inherently
// multi-turn, so chat gets its own, more generous daily counter rather than
// starving the 20/day brew budget. Still bounded to prevent runaway-loop abuse.
export const CHAT_DAILY_BUDGET = 60;

// Column sets the budget helpers operate on. Brew = the original columns;
// chat = the v1.3.x split (see 20260614_counterflux_deckgen_chat_budget.sql).
export const BREW_BUDGET = { countColumn: 'deckgen_generations_today', resetColumn: 'deckgen_last_reset', cap: DAILY_BUDGET };
export const CHAT_BUDGET = { countColumn: 'deckgen_chat_generations_today', resetColumn: 'deckgen_chat_last_reset', cap: CHAT_DAILY_BUDGET };

// ---------------------------------------------------------------------------
// JWT verification — uses Supabase to validate the bearer token.
// ---------------------------------------------------------------------------

export async function verifyJWT(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, body: { error: 'missing bearer token' } };
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, status: 401, body: { error: 'empty bearer token' } };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    console.error('[api/deckgen] Supabase env vars missing');
    return { ok: false, status: 500, body: { error: 'server misconfigured' } };
  }

  // User-scoped client — every query through this respects the user's JWT
  // and RLS. The Authorization header is set globally on the client so
  // PostgREST receives it on every request.
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    db: { schema: 'counterflux' },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Signature-validating call. Returns the user object on a real token,
  // a 401-style error on a forged/expired one.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, body: { error: 'invalid token' } };
  }

  return { ok: true, userId: data.user.id, supabase };
}

// ---------------------------------------------------------------------------
// Budget — atomic lazy-reset increment. Shared 20/day counter across all
// deckgen modes (build/fill/upgrade/retune + chat).
// ---------------------------------------------------------------------------

export async function assertAndIncrementBudget(supabase, userId, budget = BREW_BUDGET) {
  const { countColumn, resetColumn, cap } = budget;
  const today = utcDateOnly(new Date());

  // Fetch current state for this budget's columns.
  const { data: profile, error: profErr } = await supabase
    .from('profile')
    .select(`${countColumn}, ${resetColumn}`)
    .eq('user_id', userId)
    .maybeSingle();

  if (profErr) {
    console.error('[api/deckgen] profile read failed:', profErr.message);
    return { ok: false, status: 500, body: { error: 'profile read failed' } };
  }

  const lastReset = profile?.[resetColumn] || null;
  const currentCount = profile?.[countColumn] || 0;

  let usedBefore = currentCount;
  if (!lastReset || lastReset < today) {
    usedBefore = 0;
  }

  if (usedBefore >= cap) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'daily limit reached',
        detail: `Mila needs a break — daily limit (${cap}/day) resets at midnight UTC.`,
        budget_remaining: 0,
      },
    };
  }

  const usedAfter = usedBefore + 1;
  const patch = { [countColumn]: usedAfter, [resetColumn]: today, updated_at: new Date().toISOString() };

  // Upsert profile row (in case it doesn't exist yet — first deckgen call)
  if (!profile) {
    const { error: insErr } = await supabase
      .from('profile')
      .upsert({ user_id: userId, ...patch });
    if (insErr) {
      console.error('[api/deckgen] profile insert failed:', insErr.message);
      return { ok: false, status: 500, body: { error: 'profile insert failed' } };
    }
  } else {
    const { error: updErr } = await supabase
      .from('profile')
      .update(patch)
      .eq('user_id', userId);
    if (updErr) {
      console.error('[api/deckgen] profile update failed:', updErr.message);
      return { ok: false, status: 500, body: { error: 'profile update failed' } };
    }
  }

  return { ok: true, usedBefore, usedAfter };
}

/**
 * Decrement a daily counter when a call fails after we've already incremented
 * it (e.g. cache-hit, Claude error, candidate-pool failure). Best-effort —
 * logs but doesn't fail the request on errors. Pass the same budget descriptor
 * used for the increment so the right counter is refunded.
 */
export async function refundBudget(supabase, userId, budget = BREW_BUDGET) {
  const { countColumn } = budget;
  try {
    const { data } = await supabase
      .from('profile')
      .select(countColumn)
      .eq('user_id', userId)
      .maybeSingle();
    const current = data?.[countColumn] || 0;
    if (current === 0) return;
    await supabase
      .from('profile')
      .update({ [countColumn]: current - 1 })
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[api/deckgen] refund failed (non-fatal):', err?.message || err);
  }
}

export function utcDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// EDHREC + Scryfall card lookups
// ---------------------------------------------------------------------------

/**
 * Fetches EDHREC top synergy card NAMES for a commander. Server-side this
 * goes direct to json.edhrec.com (no CORS issue, no proxy needed).
 *
 * @returns {Promise<Array<string>>} ordered list of card names
 */
export async function fetchEdhrecSynergyNames(commanderName) {
  const slug = sanitizeName(commanderName);
  const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;
  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[api/deckgen] EDHREC fetch returned', res.status, 'for', slug);
      return [];
    }
    data = await res.json();
  } catch (err) {
    console.warn('[api/deckgen] EDHREC fetch failed:', err?.message || err);
    return [];
  }

  const cardlists = data?.container?.json_dict?.cardlists || [];
  const wanted = new Set(['highsynergycards', 'topcards', 'newcards']);
  const names = [];
  const seen = new Set();
  for (const list of cardlists) {
    if (!wanted.has(list?.tag)) continue;
    for (const cv of (list.cardviews || [])) {
      const name = cv?.name;
      if (!name) continue;
      const key = String(name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

export function sanitizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[',]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .replace(/^-+/, '');
}

/**
 * Resolves a list of card NAMES to full Scryfall card objects via the
 * /cards/collection POST endpoint (max 75 names per call, no auth needed).
 * Names that don't resolve to a printing are silently dropped.
 */
export async function fetchCardsByNames(names) {
  if (!names.length) return [];
  const out = [];
  for (let i = 0; i < names.length; i += 75) {
    const batch = names.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const c of (data.data || [])) out.push(c);
    } catch (err) {
      console.warn('[api/deckgen] cards/collection by-name batch failed:', err?.message || err);
    }
  }
  return out;
}

export async function fetchCommanderCard(commanderId) {
  // Commander cards live in db.cards on the client and `cards` is NOT a
  // synced table — so the server doesn't have a cards table to query. Use
  // Scryfall directly for the metadata (free, no rate-limit issue for a
  // single-card lookup).
  try {
    const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(commanderId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[api/deckgen] commander fetch failed:', err?.message || err);
    return null;
  }
}

export async function fetchOwnedScryfallIds(supabase) {
  const { data, error } = await supabase
    .from('collection')
    .select('scryfall_id')
    .eq('category', 'owned');
  if (error) {
    console.warn('[api/deckgen] collection fetch failed:', error.message);
    return [];
  }
  return (data || []).map((r) => r.scryfall_id).filter(Boolean);
}
