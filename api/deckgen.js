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
// v1.3.x — JWT/budget/lookup helpers moved to a shared module so
// /api/deckgen and /api/deckgen-chat share one implementation.
import {
  DAILY_BUDGET,
  SCRYFALL_HEADERS,
  verifyJWT,
  assertAndIncrementBudget,
  refundBudget,
  fetchEdhrecSynergyNames,
  fetchCardsByNames,
  fetchCommanderCard,
  fetchOwnedScryfallIds,
} from './_deckgen-shared.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// DAILY_BUDGET imported from ./_deckgen-shared.js (shared across deckgen modes)
const CACHE_TTL_DAYS = 7;
const MODEL_OPUS = 'claude-opus-4-8';
const MODEL_SONNET = 'claude-sonnet-4-6';
const ANTHROPIC_MAX_TOKENS = 8192;
const EDHREC_TOP_N = 300;
const ALLOWED_MODES = new Set(['build', 'fill', 'upgrade', 'retune']);
// 260608: hard timeout on the Anthropic call. Opus p95 lands around 30s
// for a 99-card brew; 60s gives meaningful headroom for tail-latency
// outliers without letting a hung call drag past Vercel's default 300s
// budget. Sonnet retune is much faster (single-digit seconds typical)
// so the same cap is generous. AbortError converts to a clean 504 +
// budget refund.
const ANTHROPIC_TIMEOUT_MS = 60_000;

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
  const { commanderId, partialCardIds = [], powerLevel = 5, useCollectionOnly = false, mode = 'build', archetypeHint = '', deckSize = 100, deckDiagnostics = '' } = body;

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
    commander = await fetchCommanderCard(commanderId);
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
    deckDiagnostics: typeof deckDiagnostics === 'string' ? deckDiagnostics : '',
  });

  const model = mode === 'retune' ? MODEL_SONNET : MODEL_OPUS;

  let parsed;
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), ANTHROPIC_TIMEOUT_MS);
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
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
    }, { signal: abortController.signal });
    parsed = parseClaudeResponse(claudeResponse);
  } catch (err) {
    clearTimeout(abortTimer);
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
    if (isTimeout) {
      console.warn('[api/deckgen] Anthropic call exceeded ' + (ANTHROPIC_TIMEOUT_MS / 1000) + 's timeout');
      await refundBudget(supabase, userId);
      return res.status(504).json({
        error: 'AI provider timeout',
        detail: 'Mila took too long thinking. Try again — a retry usually resolves it.',
      });
    }
    console.error('[api/deckgen] Anthropic call failed:', err?.message || err);
    await refundBudget(supabase, userId);
    return res.status(502).json({ error: 'AI provider error', detail: err?.message || 'unknown' });
  } finally {
    clearTimeout(abortTimer);
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
// Scryfall card lookups (deckgen-only — chat doesn't resolve partial decks)
// ---------------------------------------------------------------------------

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
        headers: { 'Content-Type': 'application/json', ...SCRYFALL_HEADERS },
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
