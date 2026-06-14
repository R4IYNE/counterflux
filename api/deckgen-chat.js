/**
 * v1.3.x — /api/deckgen-chat
 *
 * Conversational sibling of /api/deckgen. Where deckgen is single-shot,
 * this endpoint holds a multi-turn conversation: the client sends the
 * running messages[] array each turn and Mila replies with prose plus
 * optional structured adds/cuts the user can apply atomically.
 *
 * It is a strict SUBSET of deckgen's work: same origin guard, JWT, budget,
 * candidate-pool build, and Anthropic dispatch — but NO response cache
 * (chat is contextual; caching would break multi-turn) and a forgiving
 * narration-style parse instead of the hard recommended[] schema. The
 * hallucination guard still applies: adds must be in the candidate pool,
 * cuts must be in the current deck.
 *
 * Flow:
 *   1. Origin guard + POST + key check
 *   2. Verify Supabase JWT (401 if missing/invalid)
 *   3. Validate body (commander, power, messages, deckCards)
 *   4. Budget check — shared 20/day counter, 429 if exceeded
 *   5. Commander metadata + EDHREC candidate pool (best-effort)
 *   6. Compose cached system blocks + pass the conversation through
 *   7. Sonnet 4.6 call (AbortController + 60s timeout → 504 + refund)
 *   8. Parse the { reply, adds, cuts } envelope; drop hallucinations
 *   9. Enrich surviving rows with display names; return 200
 */

import Anthropic from '@anthropic-ai/sdk';
import { checkRequest } from './_origin-guard.js';
import { buildCandidatePool } from '../src/services/deckgen-candidates.js';
import {
  CHAT_SYSTEM_PROMPT,
  buildChatContextBlock,
  parseChatEnvelope,
  normalizeConversation,
} from '../src/services/deckgen-chat-prompt.js';
import {
  CHAT_DAILY_BUDGET,
  CHAT_BUDGET,
  verifyJWT,
  assertAndIncrementBudget,
  refundBudget,
  fetchEdhrecSynergyNames,
  fetchCardsByNames,
  fetchCommanderCard,
  fetchOwnedScryfallIds,
} from './_deckgen-shared.js';

const MODEL_SONNET = 'claude-sonnet-4-6';
const ANTHROPIC_MAX_TOKENS = 2048;
const EDHREC_TOP_N = 300;
const ANTHROPIC_TIMEOUT_MS = 60_000;
const MAX_MESSAGES = 24;       // last ~12 conversational turns
const MAX_DECK_CARDS = 200;    // a Commander deck is 100; cap defends the prompt

export default async function handler(req, res) {
  // 1. Origin + body-size guard
  const guard = checkRequest(req);
  if (!guard.ok) return res.status(guard.status).json(guard.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[api/deckgen-chat] ANTHROPIC_API_KEY not set on Vercel');
    return res.status(500).json({ error: 'server misconfigured' });
  }

  // 2. Verify JWT
  const auth = await verifyJWT(req);
  if (!auth.ok) return res.status(auth.status).json(auth.body);
  const { userId, supabase } = auth;

  // 3. Validate request body
  const body = req.body || {};
  const {
    commanderId,
    powerLevel = 5,
    useCollectionOnly = false,
    messages = [],
    deckCards = [],
    deckDiagnostics = '',
  } = body;

  if (!commanderId || typeof commanderId !== 'string') {
    return res.status(400).json({ error: 'commanderId required' });
  }
  if (!Number.isFinite(powerLevel) || powerLevel < 1 || powerLevel > 10) {
    return res.status(400).json({ error: 'powerLevel must be 1-10' });
  }
  const cleanMessages = normalizeConversation(messages, { maxMessages: MAX_MESSAGES });
  if (cleanMessages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }
  if (cleanMessages[cleanMessages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'last message must be from the user' });
  }
  const cleanDeck = sanitizeDeckCards(deckCards);

  // 4. Budget enforcement — chat has its own daily counter (audit fix #5) so a
  //    multi-turn refinement session doesn't starve the 20/day brew budget.
  const budget = await assertAndIncrementBudget(supabase, userId, CHAT_BUDGET);
  if (!budget.ok) return res.status(budget.status).json(budget.body);

  // 5. Commander metadata (required) + EDHREC candidate pool (best-effort)
  const commander = await fetchCommanderCard(commanderId);
  if (!commander) {
    await refundBudget(supabase, userId, CHAT_BUDGET);
    return res.status(404).json({ error: 'commander not found' });
  }

  let ownedIds = null;
  if (useCollectionOnly) {
    ownedIds = await fetchOwnedScryfallIds(supabase);
  }

  let candidatePool = [];
  try {
    candidatePool = await buildPool({ commander, ownedIds });
  } catch (err) {
    // Pool build failure is non-fatal for chat — Mila can still answer
    // questions and propose cuts. Adds just won't have a pool to draw from.
    console.warn('[api/deckgen-chat] candidate-pool build failed (non-fatal):', err?.message || err);
    candidatePool = [];
  }

  // 6. Compose system blocks. Persona + rules block and the pool/deck context
  //    block are both ephemeral-cached so warm conversational turns are cheap.
  const contextBlock = buildChatContextBlock({
    commander,
    candidates: candidatePool,
    deckCards: cleanDeck,
    powerLevel,
    deckDiagnostics: typeof deckDiagnostics === 'string' ? deckDiagnostics : '',
  });

  // 7. Anthropic dispatch — Sonnet, AbortController + hard timeout.
  let parsed;
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), ANTHROPIC_TIMEOUT_MS);
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
    const claudeResponse = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: [
        { type: 'text', text: CHAT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
      ],
      messages: cleanMessages,
    }, { signal: abortController.signal });

    const text = (claudeResponse?.content || [])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const poolIds = new Set(candidatePool.map((c) => c.scryfall_id));
    const deckIds = new Set(cleanDeck.map((c) => c.scryfall_id));
    parsed = parseChatEnvelope(text, { poolIds, deckIds });
  } catch (err) {
    clearTimeout(abortTimer);
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
    if (isTimeout) {
      console.warn('[api/deckgen-chat] Anthropic call exceeded ' + (ANTHROPIC_TIMEOUT_MS / 1000) + 's timeout');
      await refundBudget(supabase, userId, CHAT_BUDGET);
      return res.status(504).json({
        error: 'AI provider timeout',
        detail: 'Mila took too long thinking. Try again — a retry usually resolves it.',
      });
    }
    console.error('[api/deckgen-chat] call/parse failed:', err?.message || err);
    await refundBudget(supabase, userId, CHAT_BUDGET);
    return res.status(502).json({ error: 'AI provider error', detail: err?.message || 'unknown' });
  } finally {
    clearTimeout(abortTimer);
  }

  // 8. Enrich surviving adds/cuts with display names so the client can render
  //    without a card lookup (it has neither the pool nor needs to hydrate).
  const poolMap = new Map(candidatePool.map((c) => [c.scryfall_id, c]));
  const deckMap = new Map(cleanDeck.map((c) => [c.scryfall_id, c]));
  const adds = parsed.adds.map((a) => ({
    ...a,
    name: poolMap.get(a.scryfall_id)?.name || a.scryfall_id,
  }));
  const cuts = parsed.cuts.map((c) => ({
    ...c,
    name: deckMap.get(c.scryfall_id)?.name || c.scryfall_id,
  }));

  return res.status(200).json({
    reply: parsed.reply,
    adds,
    cuts,
    budget_remaining: CHAT_DAILY_BUDGET - budget.usedAfter,
  });
}

// ---------------------------------------------------------------------------
// Candidate pool — same recipe as /api/deckgen (EDHREC names → Scryfall
// objects → colour/legality/ownership filter via buildCandidatePool).
// ---------------------------------------------------------------------------

async function buildPool({ commander, ownedIds }) {
  const synergyNames = await fetchEdhrecSynergyNames(commander.name);
  const resolvedCards = await fetchCardsByNames(synergyNames.slice(0, EDHREC_TOP_N));

  const nameToOrder = new Map();
  synergyNames.forEach((n, i) => nameToOrder.set(String(n).toLowerCase(), i));
  const synergies = resolvedCards.map((c) => ({
    name: c.name,
    scryfall_id: c.id,
    synergy_score: 1 - (nameToOrder.get(String(c.name).toLowerCase()) ?? EDHREC_TOP_N) / EDHREC_TOP_N,
  }));

  return buildCandidatePool({
    synergies,
    cards: resolvedCards,
    ownedIds: ownedIds ? new Set(ownedIds) : null,
    colorIdentity: commander.color_identity || [],
    commander,
  });
}

// ---------------------------------------------------------------------------
// Input sanitisation
// ---------------------------------------------------------------------------

function sanitizeDeckCards(deckCards) {
  if (!Array.isArray(deckCards)) return [];
  const out = [];
  const seen = new Set();
  for (const c of deckCards) {
    if (!c || typeof c.scryfall_id !== 'string') continue;
    if (seen.has(c.scryfall_id)) continue;
    seen.add(c.scryfall_id);
    out.push({ scryfall_id: c.scryfall_id, name: typeof c.name === 'string' ? c.name : '' });
    if (out.length >= MAX_DECK_CARDS) break;
  }
  return out;
}
