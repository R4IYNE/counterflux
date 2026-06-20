/**
 * v1.3.x — Mila Brew Chat prompt construction.
 *
 * Conversational sibling of deckgen-prompt.js. Where deckgen is single-shot
 * ("build me 99 cards"), chat is multi-turn ("more removal" → "now cut the
 * durdle" → "why Sol Ring?"). Two pieces:
 *
 *   1. CHAT_SYSTEM_PROMPT — stable instructions (persona + rules + the JSON
 *      envelope contract). Qualifies for Anthropic's ephemeral prompt cache.
 *   2. buildChatContextBlock() — the candidate pool + current deck + power
 *      level, rendered as a second cacheable system block. Stays warm across
 *      pure-conversation turns; only changes when the deck does (after an
 *      Apply). Sent as a SEPARATE system block so the conversation messages
 *      array can grow turn-over-turn without re-paying for the pool.
 *
 * Pure module — no SDK or network calls. Tested in isolation.
 *
 * Output contract (every assistant turn): STRICT JSON, no prose outside it:
 *   {
 *     "reply":  "<1-4 sentences, conversational>",
 *     "adds":   [ { "scryfall_id": "<from pool>", "role": "<bucket>", "reasoning": "<1-2 sentences>" } ],
 *     "cuts":   [ { "scryfall_id": "<from current deck>", "reasoning": "<1-2 sentences>" } ]
 *   }
 * adds/cuts are optional — a pure-conversation turn ("why Sol Ring?") returns
 * empty arrays and just talks.
 */

import { MILA_PERSONA } from './deckgen-prompt.js';

const POWER_RUBRIC = [
  '- Casual (1-3): precon-tier, no infinite combos, no fast mana beyond Sol Ring, wins turn 9+.',
  '- Focused (4-6): clear theme, ~2 win-cons, modest fast mana, wins turn 6-8.',
  '- Optimized (7-9): tuned, 3-4 win-cons, full fast mana, interaction-dense, wins turn 5-7.',
  '- cEDH (10): T1-T4 win, free interaction, tier-1 mana base.',
].join('\n');

const ROLE_BUCKETS = 'LAND, RAMP, DRAW, REMOVAL_SINGLE, REMOVAL_SWEEP, WIN_CON, SUPPORT';

const ENVELOPE_SCHEMA = `{
  "reply": "<1-4 sentences — answer the user, explain your thinking>",
  "adds": [ { "scryfall_id": "<exact id from the candidate pool>", "role": "<one of the role buckets>", "reasoning": "<1-2 sentences: why this card, this commander, this power level>" } ],
  "cuts": [ { "scryfall_id": "<exact id from the CURRENT DECK list>", "reasoning": "<1-2 sentences: why this card should leave>" } ]
}`;

// ---------------------------------------------------------------------------
// System prompt — stable, cached. Keep edits rare.
// ---------------------------------------------------------------------------

export const CHAT_SYSTEM_PROMPT = [
  MILA_PERSONA,
  ``,
  `You are in an ongoing CONVERSATION helping the user refine one Commander deck. Each turn the user asks for a change in plain language ("more removal", "cut the durdle", "lean spellslinger", "swap the slow ramp") or asks a question ("why Sol Ring?", "is my curve too high?"). You respond conversationally AND, when the request implies deck changes, propose them as structured adds and cuts.`,
  ``,
  `## What you can touch`,
  ``,
  `- You receive a CANDIDATE POOL (pre-filtered for the commander's colour identity, paper-legality, and format-legality) and the CURRENT DECK (the cards in the deck right now).`,
  `- Every card you ADD must be a scryfall_id from the CANDIDATE POOL. Never invent a card or use an id you weren't given — the user gets a card they cannot own or play, and the change is silently dropped.`,
  `- Every card you CUT must be a scryfall_id from the CURRENT DECK list. Never cut a card that isn't in the deck.`,
  `- Never add or cut the commander.`,
  ``,
  `## Power level`,
  ``,
  POWER_RUBRIC,
  ``,
  `## Role buckets`,
  ``,
  ROLE_BUCKETS,
  ``,
  `## How to behave`,
  ``,
  `1. Be conversational and concise. The "reply" field is you talking to the user — warm, knowledgeable, never preachy. Reference specific cards by name when it helps.`,
  `2. Propose a TARGETED change, not a rebuild. If the user asks for "more removal", suggest 2-5 removal adds (and, when the deck is already ~100 cards, an equal number of weak cuts to make room) — not 30 cards.`,
  `3. When you suggest cuts to make room for adds, keep adds and cuts balanced so the deck stays near its current size, unless the user explicitly asks to grow or shrink it.`,
  `4. If the user only asks a question ("why did you pick X?", "is my ramp ok?"), answer it in "reply" and return empty "adds" and "cuts".`,
  `5. Respect the target power level and any direction the user has given earlier in the conversation.`,
  ``,
  `## Output format`,
  ``,
  `Return STRICT JSON only — no prose outside the JSON, no markdown fences. The schema is:`,
  ``,
  '```json',
  ENVELOPE_SCHEMA,
  '```',
  ``,
  `"adds" and "cuts" are optional and may be empty. "reply" is always present.`,
].join('\n');

// ---------------------------------------------------------------------------
// Per-session context block — pool + current deck + power level.
// ---------------------------------------------------------------------------

/**
 * Build the cacheable context block describing the candidate pool, the
 * current deck, and the target power level. Rendered as a second system
 * block so it stays cache-warm across conversation turns and only changes
 * when the deck or pool changes.
 *
 * @param {Object} input
 * @param {Object} input.commander       - { name, color_identity, type_line, oracle_text }
 * @param {Array<Object>} input.candidates - From buildCandidatePool() — { scryfall_id, name, cmc, mana_cost, type_line, color_identity }
 * @param {Array<Object>} input.deckCards - Current deck cards — { scryfall_id, name }
 * @param {number} input.powerLevel       - 1-10
 * @returns {string}
 */
export function buildChatContextBlock({ commander, candidates, deckCards, powerLevel, deckDiagnostics }) {
  const pool = Array.isArray(candidates) ? candidates : [];
  const deck = Array.isArray(deckCards) ? deckCards : [];

  const sections = [
    `## Commander`,
    `${commander?.name || '<unknown>'} — ${(commander?.color_identity || []).join('') || 'C'}`,
    commander?.type_line ? `Type: ${commander.type_line}` : null,
    commander?.oracle_text ? `Text: ${commander.oracle_text}` : null,
    ``,
    `## Target power level`,
    `${powerLevel ?? 5}/10`,
    ``,
    `## Current deck (${deck.length} cards — you may CUT only from this list)`,
    deck.length > 0
      ? deck.map((c) => `- [${c.scryfall_id}] ${c.name || ''}`).join('\n')
      : '(empty — nothing to cut yet)',
    ``,
    // v1.3.x (audit fix #6): the deck's own locally-computed analytics + gaps.
    deckDiagnostics ? deckDiagnostics : null,
    deckDiagnostics ? `` : null,
    `## Candidate pool (${pool.length} cards — you may ADD only from this list)`,
    pool.length > 0
      ? pool.map((c) => formatCandidate(c)).join('\n')
      : '(no candidates available)',
  ];

  return sections.filter((s) => s !== null && s !== undefined).join('\n');
}

function formatCandidate(c) {
  const cmc = typeof c.cmc === 'number' ? c.cmc : '?';
  const ci = (c.color_identity || []).join('') || 'C';
  const tl = (c.type_line || '').split(' — ')[0]; // type only, drop subtype to save tokens
  return `- [${c.scryfall_id}] ${c.name} · CMC ${cmc} · ${ci} · ${tl}`;
}

// ---------------------------------------------------------------------------
// Conversation normalisation — pure, so the endpoint's input handling is
// testable without the SDK. Bounds the prompt and enforces the two
// invariants the Anthropic Messages API requires: the array is non-empty
// and the FIRST message is from the user. Slicing a long alternating
// conversation to its tail can land on an assistant turn, which the API
// rejects — so we drop any leading assistant turn(s) after slicing.
// ---------------------------------------------------------------------------

/**
 * @param {Array<{role:string, content:string}>} messages
 * @param {Object} [opts]
 * @param {number} [opts.maxMessages=24] - keep at most this many recent turns
 * @returns {Array<{role:'user'|'assistant', content:string}>}
 */
export function normalizeConversation(messages, { maxMessages = 24 } = {}) {
  if (!Array.isArray(messages)) return [];
  const clean = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant')
      && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))   // L31 — per-message length cap
    .slice(-maxMessages);
  // Anthropic requires the first message to be from the user.
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

// ---------------------------------------------------------------------------
// Response parsing + hallucination guard — pure, so it's unit-testable
// without mocking the Anthropic SDK. The endpoint calls this with the pool +
// deck id sets and then enriches the surviving rows with display names.
// ---------------------------------------------------------------------------

/**
 * Parse Claude's chat envelope and drop any add not in the candidate pool or
 * any cut not in the current deck (the same hallucination guard deckgen
 * applies to its recommended[] list). Throws on unparseable / malformed JSON
 * so the endpoint can map it to a 502 + budget refund.
 *
 * @param {string} rawText - the text content of Claude's message
 * @param {Object} [opts]
 * @param {Set<string>} [opts.poolIds] - valid add ids. Omit to skip add validation.
 * @param {Set<string>} [opts.deckIds] - valid cut ids. Omit to skip cut validation.
 * @returns {{ reply: string, adds: Array, cuts: Array, dropped: { adds: number, cuts: number } }}
 */
export function parseChatEnvelope(rawText, { poolIds, deckIds } = {}) {
  const text = String(rawText || '').trim();
  if (!text) throw new Error('empty response');

  // Strip code fences if Claude wrapped the JSON despite instructions.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenceMatch ? fenceMatch[1] : text;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error('invalid JSON: ' + err.message);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('response was not an object');
  }

  const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
  if (!reply) throw new Error('missing reply');

  const rawAdds = Array.isArray(parsed.adds) ? parsed.adds : [];
  const rawCuts = Array.isArray(parsed.cuts) ? parsed.cuts : [];

  const cleanAdds = [];
  for (const a of rawAdds) {
    if (!a || typeof a.scryfall_id !== 'string') continue;
    if (poolIds instanceof Set && !poolIds.has(a.scryfall_id)) continue;
    cleanAdds.push({
      scryfall_id: a.scryfall_id,
      role: typeof a.role === 'string' ? a.role : 'SUPPORT',
      reasoning: typeof a.reasoning === 'string' ? a.reasoning : '',
    });
  }

  const cleanCuts = [];
  for (const c of rawCuts) {
    if (!c || typeof c.scryfall_id !== 'string') continue;
    if (deckIds instanceof Set && !deckIds.has(c.scryfall_id)) continue;
    cleanCuts.push({
      scryfall_id: c.scryfall_id,
      reasoning: typeof c.reasoning === 'string' ? c.reasoning : '',
    });
  }

  return {
    reply,
    adds: cleanAdds,
    cuts: cleanCuts,
    dropped: { adds: rawAdds.length - cleanAdds.length, cuts: rawCuts.length - cleanCuts.length },
  };
}
