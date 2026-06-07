/**
 * Phase 17 (v1.3) — /api/deckgen
 *
 * The AI deck-generation orchestrator. Takes a request from the client,
 * authenticates the user, enforces the daily budget, builds a candidate
 * pool, calls Claude with prompt caching, validates the response, caches
 * it, and returns structured JSON.
 *
 * Flow (happy path):
 *   1. Origin guard (reuses api/_origin-guard.js)
 *   2. Verify Supabase JWT — returns 401 if missing/invalid
 *   3. Check per-user daily budget — 429 if exceeded
 *   4. Build cache key, check Supabase deckgen_cache — return cached on hit
 *   5. Fetch EDHREC top synergies for the commander
 *   6. Fetch commander card metadata (color_identity, oracle_text)
 *   7. Fetch the synergy cards from Supabase cards table (or Scryfall fallback)
 *   8. If useCollectionOnly, fetch collection ids via the user's JWT
 *   9. Build candidate pool (server-side filter, NEVER sent to Anthropic raw)
 *  10. Compose system + user prompts
 *  11. Call Anthropic (Opus for build/fill/upgrade, Sonnet for retune)
 *  12. Parse + validate the response (every scryfall_id must be in the pool)
 *  13. Increment the user's daily counter
 *  14. Write to deckgen_cache
 *  15. Return 200 with { recommended, budget_remaining, cache_hit: false }
 *
 * Tests: see tests/api-deckgen.test.js for unit coverage of budget enforcement,
 * cache key reuse, response validation, and Claude-recommends-out-of-pool
 * rejection. The full happy path is integration-tested against fakes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { checkRequest } from './_origin-guard.js';
import {
  buildCandidatePool,
  buildCacheKey,
  hashCollection,
} from '../src/services/deckgen-candidates.js';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
} from '../src/services/deckgen-prompt.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAILY_BUDGET = 20;
const CACHE_TTL_DAYS = 7;
const MODEL_OPUS = 'claude-opus-4-8';
const MODEL_SONNET = 'claude-sonnet-4-6';
const ANTHROPIC_MAX_TOKENS = 8192;
const EDHREC_TOP_N = 300;
const ALLOWED_MODES = new Set(['build', 'fill', 'upgrade', 'retune']);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // 1. Origin + body-size guard
  const guard = checkRequest(req);
  if (!guard.ok) return res.status(guard.status).json(guard.body);

  // Method check — POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[api/deckgen] ANTHROPIC_API_KEY not set on Vercel');
    return res.status(500).json({ error: 'server misconfigured' });
  }

  // 2. Verify JWT
  const auth = await verifyJWT(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);
  const { userId, supabase } = auth;

  // 3. Validate request body
  const body = req.body || {};
  const { commanderId, partialCardIds = [], powerLevel = 5, useCollectionOnly = false, mode = 'build', archetypeHint = '', deckSize = 100 } = body;

  if (!commanderId || typeof commanderId !== 'string') {
    return res.status(400).json({ error: 'commanderId required' });
  }
  if (!ALLOWED_MODES.has(mode)) {
    return res.status(400).json({ error: 'invalid mode' });
  }
  if (!Number.isFinite(powerLevel) || powerLevel < 1 || powerLevel > 10) {
    return res.status(400).json({ error: 'powerLevel must be 1-10' });
  }

  // 4. Budget enforcement — lazy daily reset
  const budget = await assertAndIncrementBudget(supabase, userId);
  if (!budget.ok) return res.status(budget.status).json(budget.body);

  // 5. Build cache key + check cache BEFORE the expensive work
  let ownedIds = null;
  if (useCollectionOnly) {
    ownedIds = await fetchOwnedScryfallIds(supabase);
  }
  const collectionHash = hashCollection(ownedIds);
  const cacheKey = buildCacheKey({ commanderId, powerLevel, mode, archetypeHint, collectionHash });

  const cached = await readCache(supabase, cacheKey);
  if (cached) {
    // Cache hits don't burn budget — refund the increment.
    await refundBudget(supabase, userId);
    return res.status(200).json({
      ...cached,
      cache_hit: true,
      budget_remaining: DAILY_BUDGET - (budget.usedAfter - 1),
    });
  }

  // 6. Fetch commander metadata FIRST so we have the name for EDHREC's
  //    slug-keyed endpoint. Commander cards aren't in our synced tables —
  //    Scryfall is the source of truth.
  let candidatePool;
  let commander;
  try {
    commander = await fetchCommanderCard(supabase, commanderId);
    if (!commander) {
      await refundBudget(supabase, userId);
      return res.status(404).json({ error: 'commander not found' });
    }

    // EDHREC returns names, not scryfall_ids. Resolve names to full Scryfall
    // card objects via /cards/collection — that gives us both the
    // scryfall_id AND the candidate metadata (cmc, mana_cost, type_line,
    // color_identity, legalities) in one round-trip.
    const synergyNames = await fetchEdhrecSynergyNames(commander.name);
    const resolvedCards = await fetchCardsByNames(synergyNames.slice(0, EDHREC_TOP_N));

    // Synergy score lookup — preserve the EDHREC ordering signal even though
    // we've now resolved to scryfall_ids. Use position-in-list as a proxy
    // score (top of list = highest synergy).
    const nameToOrder = new Map();
    synergyNames.forEach((n, i) => nameToOrder.set(String(n).toLowerCase(), i));
    const synergies = resolvedCards.map((c) => ({
      name: c.name,
      scryfall_id: c.id,
      synergy_score: 1 - (nameToOrder.get(String(c.name).toLowerCase()) ?? EDHREC_TOP_N) / EDHREC_TOP_N,
    }));

    candidatePool = buildCandidatePool({
      synergies,
      cards: resolvedCards,
      ownedIds: ownedIds ? new Set(ownedIds) : null,
      colorIdentity: commander.color_identity || [],
      commander,
    });
  } catch (err) {
    console.error('[api/deckgen] candidate-pool build failed:', err?.message || err);
    await refundBudget(supabase, userId);
    return res.status(502).json({ error: 'failed to build candidate pool' });
  }

  if (candidatePool.length < 30) {
    await refundBudget(supabase, userId);
    return res.status(409).json({
      error: 'insufficient candidates',
      detail: `Only ${candidatePool.length} cards available — EDHREC data may be cold or the collection filter is too strict.`,
    });
  }

  // 7. Resolve partial deck (if mode requires it)
  const partial = await resolvePartialCards(supabase, partialCardIds);

  // 8. Compose prompt + call Claude
  const userPrompt = buildUserPrompt({
    commander,
    candidates: candidatePool,
    partial,
    powerLevel,
    mode,
    archetypeHint,
    deckSize,
  });

  const model = mode === 'retune' ? MODEL_SONNET : MODEL_OPUS;

  let parsed;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const claudeResponse = await client.messages.create({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });
    parsed = parseClaudeResponse(claudeResponse);
  } catch (err) {
    console.error('[api/deckgen] Anthropic call failed:', err?.message || err);
    await refundBudget(supabase, userId);
    return res.status(502).json({ error: 'AI provider error', detail: err?.message || 'unknown' });
  }

  // 9. Validate response — every scryfall_id must be in the candidate pool
  const poolIds = new Set(candidatePool.map((c) => c.scryfall_id));
  const validated = parsed.recommended.filter((r) => poolIds.has(r.scryfall_id));
  const dropped = parsed.recommended.length - validated.length;
  if (validated.length < 10) {
    // Claude hallucinated >90% — treat as a failed call.
    console.warn('[api/deckgen] response validation salvaged only', validated.length, 'of', parsed.recommended.length);
    await refundBudget(supabase, userId);
    return res.status(502).json({
      error: 'AI response did not match candidate pool',
      detail: 'Claude returned scryfall_ids outside the provided pool. Try again.',
    });
  }
  if (dropped > 0) {
    console.info('[api/deckgen] dropped', dropped, 'hallucinated cards from response');
  }

  const responseBody = {
    recommended: validated,
    mode,
    powerLevel,
    cache_hit: false,
    budget_remaining: DAILY_BUDGET - budget.usedAfter,
  };

  // 10. Write to cache (best-effort — non-fatal on failure)
  try {
    await writeCache(supabase, { hash: cacheKey, userId, response: responseBody });
  } catch (err) {
    console.warn('[api/deckgen] cache write failed (non-fatal):', err?.message || err);
  }

  return res.status(200).json(responseBody);
}

// ---------------------------------------------------------------------------
// JWT verification — uses Supabase to validate the bearer token.
// ---------------------------------------------------------------------------

async function verifyJWT(req) {
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
// Budget — atomic lazy-reset increment.
// ---------------------------------------------------------------------------

async function assertAndIncrementBudget(supabase, userId) {
  const today = utcDateOnly(new Date());

  // Fetch current state
  const { data: profile, error: profErr } = await supabase
    .from('profile')
    .select('deckgen_generations_today, deckgen_last_reset')
    .eq('user_id', userId)
    .maybeSingle();

  if (profErr) {
    console.error('[api/deckgen] profile read failed:', profErr.message);
    return { ok: false, status: 500, body: { error: 'profile read failed' } };
  }

  const lastReset = profile?.deckgen_last_reset || null;
  const currentCount = profile?.deckgen_generations_today || 0;

  let usedBefore = currentCount;
  if (!lastReset || lastReset < today) {
    usedBefore = 0;
  }

  if (usedBefore >= DAILY_BUDGET) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'daily limit reached',
        detail: `Mila needs a break — brewing limit (${DAILY_BUDGET}/day) resets at midnight UTC.`,
        budget_remaining: 0,
      },
    };
  }

  const usedAfter = usedBefore + 1;

  // Upsert profile row (in case it doesn't exist yet — first deckgen call)
  if (!profile) {
    const { error: insErr } = await supabase
      .from('profile')
      .upsert({
        user_id: userId,
        deckgen_generations_today: usedAfter,
        deckgen_last_reset: today,
        updated_at: new Date().toISOString(),
      });
    if (insErr) {
      console.error('[api/deckgen] profile insert failed:', insErr.message);
      return { ok: false, status: 500, body: { error: 'profile insert failed' } };
    }
  } else {
    const { error: updErr } = await supabase
      .from('profile')
      .update({
        deckgen_generations_today: usedAfter,
        deckgen_last_reset: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (updErr) {
      console.error('[api/deckgen] profile update failed:', updErr.message);
      return { ok: false, status: 500, body: { error: 'profile update failed' } };
    }
  }

  return { ok: true, usedBefore, usedAfter };
}

/**
 * Decrement the daily counter when a call fails after we've already
 * incremented it (e.g. cache-hit, Claude error, candidate-pool failure).
 * Best-effort — logs but doesn't fail the request on errors.
 */
async function refundBudget(supabase, userId) {
  try {
    const { data } = await supabase
      .from('profile')
      .select('deckgen_generations_today')
      .eq('user_id', userId)
      .maybeSingle();
    const current = data?.deckgen_generations_today || 0;
    if (current === 0) return;
    await supabase
      .from('profile')
      .update({ deckgen_generations_today: current - 1 })
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[api/deckgen] refund failed (non-fatal):', err?.message || err);
  }
}

function utcDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cache reads + writes
// ---------------------------------------------------------------------------

async function readCache(supabase, hash) {
  const { data, error } = await supabase
    .from('deckgen_cache')
    .select('response, fetched_at, ttl_days')
    .eq('hash', hash)
    .maybeSingle();
  if (error || !data) return null;
  const fetchedAt = new Date(data.fetched_at).getTime();
  const ttlMs = (data.ttl_days || CACHE_TTL_DAYS) * 24 * 60 * 60 * 1000;
  if (Date.now() - fetchedAt > ttlMs) return null;
  return data.response;
}

async function writeCache(supabase, { hash, userId, response }) {
  await supabase.from('deckgen_cache').upsert({
    hash,
    user_id: userId,
    response,
    fetched_at: new Date().toISOString(),
    ttl_days: CACHE_TTL_DAYS,
  });
}

// ---------------------------------------------------------------------------
// EDHREC + Supabase card lookups
// ---------------------------------------------------------------------------

/**
 * Fetches EDHREC top synergy card NAMES for a commander. Server-side this
 * goes direct to json.edhrec.com (no CORS issue, no proxy needed). The
 * 200ms client-side rate limit doesn't apply here either — production
 * usage hits this < 20×/day per user, well inside EDHREC's polite limits.
 *
 * EDHREC keys commander pages by slugified name. We pull from THREE
 * cardlist categories — 'highsynergycards' is the strongest signal but
 * smaller decks need the broader 'topcards' too. Order is preserved so
 * the caller can use list-position as a synergy score.
 *
 * @returns {Promise<Array<string>>} ordered list of card names
 */
async function fetchEdhrecSynergyNames(commanderName) {
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

function sanitizeName(name) {
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
async function fetchCardsByNames(names) {
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

async function fetchCommanderCard(supabase, commanderId) {
  // Commander cards live in db.cards on the client and `cards` is NOT a
  // synced table — so the server doesn't have a cards table to query. Use
  // Scryfall directly for the metadata (paid Scryfall is free, no rate limit
  // issues for single-card lookups).
  try {
    const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(commanderId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[api/deckgen] commander fetch failed:', err?.message || err);
    return null;
  }
}

async function fetchCardsByIds(supabase, scryfallIds) {
  // Same situation as fetchCommanderCard — cards isn't synced. Use Scryfall's
  // /cards/collection POST endpoint (max 75 IDs per call).
  if (!scryfallIds.length) return [];
  const out = [];
  for (let i = 0; i < scryfallIds.length; i += 75) {
    const batch = scryfallIds.slice(i, i + 75);
    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const c of (data.data || [])) out.push(c);
    } catch (err) {
      console.warn('[api/deckgen] cards/collection batch failed:', err?.message || err);
    }
  }
  return out;
}

async function fetchOwnedScryfallIds(supabase) {
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

async function resolvePartialCards(supabase, partialIds) {
  if (!Array.isArray(partialIds) || partialIds.length === 0) return [];
  const cards = await fetchCardsByIds(supabase, partialIds);
  return cards.map((c) => ({ scryfall_id: c.id, name: c.name }));
}

// ---------------------------------------------------------------------------
// Claude response parsing
// ---------------------------------------------------------------------------

/**
 * Parses Claude's structured response. The system prompt demands STRICT JSON
 * with no markdown fences, but defensive — strip fences if Claude wraps the
 * output anyway, then JSON.parse.
 */
function parseClaudeResponse(claudeResponse) {
  const text = (claudeResponse?.content || [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('empty response');

  // Strip code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenceMatch ? fenceMatch[1] : text;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('invalid JSON: ' + err.message);
  }

  if (!parsed || !Array.isArray(parsed.recommended)) {
    throw new Error('missing recommended array');
  }

  // Coerce each row to a known shape
  parsed.recommended = parsed.recommended
    .filter((r) => r && typeof r.scryfall_id === 'string')
    .map((r) => ({
      scryfall_id: r.scryfall_id,
      role: typeof r.role === 'string' ? r.role : 'SUPPORT',
      reasoning: typeof r.reasoning === 'string' ? r.reasoning : '',
      swap_out: typeof r.swap_out === 'string' ? r.swap_out : null,
    }));

  return parsed;
}
