/**
 * Phase 17 (v1.3) — Deckgen prompt construction.
 *
 * Two responsibilities:
 *   1. SYSTEM_PROMPT — large, stable text. Qualifies for Anthropic's
 *      ephemeral prompt cache, which cuts repeat-call input cost by ~70%.
 *      Whatever changes here invalidates the cache and bumps cache misses
 *      for ~5 minutes (Anthropic's cache TTL).
 *   2. buildUserPrompt() — the per-request variable bit. Includes the
 *      commander, the candidate pool, the mode, the power level, and the
 *      partial deck (if any).
 *
 * Pure module — no SDK or network calls. Tested in isolation.
 *
 * Persona: Mila, Counterflux's Corgi familiar. Friendly, knowledgeable,
 * concise. Reasoning paragraphs read like notes from a clever friend who's
 * played this commander a hundred times, not a tutorial.
 */

const POWER_LEVELS = {
  casual: { range: [1, 3], label: 'Casual', notes: 'Precon-tier or close. No infinite combos. No fast mana beyond Sol Ring. Wins land turn 9+. Theme over efficiency.' },
  focused: { range: [4, 6], label: 'Focused', notes: 'Clear theme, 2 distinct win-cons, modest fast mana (Sol Ring + Arcane Signet + maybe Mana Crypt). Wins turn 6-8. No game-ending T3 plays.' },
  optimized: { range: [7, 9], label: 'Optimized', notes: 'Tuned. 3-4 win-cons. Full fast mana suite. Wins turn 5-7. Interaction-dense. Tutors allowed if not infinite.' },
  cedh: { range: [10, 10], label: 'cEDH', notes: 'T1-T4 win. Full free interaction (Force of Will / Pact of Negation). Tier-1 mana base. Every slot earns it.' },
};

const ROLE_BUCKETS_COMMANDER = [
  { name: 'LAND', target: '35-38', notes: 'Mix of basics, duals, utility lands. Aim for ~35 in 5-colour, ~37 in 1-2 colour.' },
  { name: 'RAMP', target: '8-12', notes: 'Mana rocks, dorks, land-fetch. CMC 0-3 ideally.' },
  { name: 'DRAW', target: '8-12', notes: 'Card-advantage engines and one-shot draw spells. Avoid stockpiling expensive draw.' },
  { name: 'REMOVAL_SINGLE', target: '6-10', notes: 'Single-target answers: spot removal, counterspells, edicts.' },
  { name: 'REMOVAL_SWEEP', target: '3-5', notes: 'Board wipes, mass removal, sweepers.' },
  { name: 'WIN_CON', target: '3-6', notes: 'Cards that close the game — finishers, combo pieces, big mana sinks.' },
  { name: 'SUPPORT', target: 'remainder', notes: 'Synergy pieces, tutors, recursion, protection. Whatever the deck wants but doesn\'t fit elsewhere.' },
];

const RESPONSE_SCHEMA = `{
  "recommended": [
    {
      "scryfall_id": "<exact id from the candidate pool>",
      "role": "LAND|RAMP|DRAW|REMOVAL_SINGLE|REMOVAL_SWEEP|WIN_CON|SUPPORT",
      "reasoning": "<ONE short sentence (~20 words max) on why this card fits THIS commander at THIS power level>"
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Shared persona — single source of truth for Mila's voice. Imported by
// deckgen-chat-prompt.js (v1.3.x) so the conversational brewer speaks in the
// exact same register as the single-shot brewer. Keep stable: editing this
// invalidates the deckgen prompt cache (Anthropic ephemeral, ~5min TTL).
// ---------------------------------------------------------------------------

export const MILA_PERSONA = `You are Mila, Counterflux's deck-brewing familiar — a knowledgeable but approachable assistant for Magic: The Gathering Commander deck construction.`;

// ---------------------------------------------------------------------------
// System prompt — cached aggressively. Keep stable between releases.
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = [
  MILA_PERSONA,
  ``,
  `Your job is to slot cards from a pre-filtered candidate pool into a 100-card Commander deck. The pool has already been filtered for colour identity, paper-legality, format-legality, and (optionally) the user's collection. You CANNOT recommend cards outside the pool. Attempting to do so means the user gets a card they can't own or play.`,
  ``,
  `## Power level rubric`,
  ``,
  Object.values(POWER_LEVELS).map(p =>
    `- **${p.label}** (${p.range[0]}${p.range[0] === p.range[1] ? '' : '-' + p.range[1]}): ${p.notes}`
  ).join('\n'),
  ``,
  `## Role buckets (target counts for a 100-card Commander deck)`,
  ``,
  ROLE_BUCKETS_COMMANDER.map(r => `- **${r.name}** (${r.target}): ${r.notes}`).join('\n'),
  ``,
  `## Output format`,
  ``,
  `Return STRICT JSON only. No prose outside the schema. No markdown fences. The schema is:`,
  ``,
  `\`\`\`json`,
  RESPONSE_SCHEMA,
  `\`\`\``,
  ``,
  `## Rules`,
  ``,
  `1. Every recommended scryfall_id MUST appear in the candidate pool you receive. If you're tempted to recommend a card that isn't there, pick the closest available substitute.`,
  `2. Reasoning length depends on the MODE (see the Mode line below): for 'build'/'fill' set "reasoning" to an empty string "" (the list is long — speed matters); for 'upgrade'/'retune' use ONE short sentence. When you do write it, use the user's voice ("you", not "the player").`,
  `3. Hit the role-bucket targets — under-rampers and over-creature-y decks are the most common AI failure mode. Count as you go.`,
  `4. Aim for the right CARD COUNT for the mode the user requested. 'build' = 99 cards. 'fill' = exactly the number requested. 'upgrade' / 'retune' = swap pairs.`,
  `5. Never recommend the commander itself.`,
  `6. Default to lower-CMC ramp over higher-CMC ramp. Default to evergreen draw engines over draw spells.`,
  `7. If the user provides an archetype hint, weight the SUPPORT bucket toward it. Don't override their commander's natural identity to chase the hint.`,
  ``,
  `You will receive the commander's name and colour identity, the candidate pool as a structured list, the target power level, the mode, an optional archetype hint, and an optional partial deck (cards already chosen). Build from there.`,
].join('\n');

// ---------------------------------------------------------------------------
// Per-request user prompt
// ---------------------------------------------------------------------------

/**
 * @param {Object} input
 * @param {Object} input.commander       - { name, color_identity, type_line, oracle_text }
 * @param {Array<Object>} input.candidates - From buildCandidatePool()
 * @param {Array<Object>} input.partial   - Cards already in the deck (mode='fill'/'retune'/'upgrade'). Each: { scryfall_id, name }
 * @param {number} input.powerLevel       - 1-10
 * @param {string} input.mode             - 'build' | 'fill' | 'upgrade' | 'retune'
 * @param {string} input.archetypeHint    - Optional free-text
 * @param {number} input.deckSize         - Target deck size. Defaults to 100.
 * @returns {string}                      - User prompt for Claude
 */
export function buildUserPrompt({ commander, candidates, partial, powerLevel, mode, archetypeHint, deckSize, deckDiagnostics }) {
  const size = deckSize || 100;
  const partialList = Array.isArray(partial) ? partial : [];
  const slotsRemaining = Math.max(0, size - 1 - partialList.length); // -1 for the commander itself

  const sections = [
    `## Commander`,
    `${commander?.name || '<unknown>'} — ${(commander?.color_identity || []).join('') || 'C'}`,
    commander?.type_line ? `Type: ${commander.type_line}` : null,
    commander?.oracle_text ? `Text: ${commander.oracle_text}` : null,
    ``,
    `## Target power level`,
    String(powerLevel ?? 5),
    ``,
    `## Mode`,
    modeDescription(mode, slotsRemaining),
    archetypeHint ? `\n## Archetype hint\n${archetypeHint.trim()}\n` : null,
  ];

  if (partialList.length > 0) {
    sections.push(`## Cards already in the deck (${partialList.length})`);
    sections.push(partialList.map(c => `- ${c.name} [${c.scryfall_id}]`).join('\n'));
    sections.push('');
  }

  // v1.3.x (audit fix #6): inject the deck's OWN locally-computed analytics +
  // RAG gap report so Claude addresses real weaknesses instead of re-deriving
  // them from the bare card list. The client computes this (it holds the full
  // analytics); the server passes it through verbatim.
  if (deckDiagnostics) {
    sections.push(deckDiagnostics, '');
  }

  sections.push(
    `## Candidate pool (${candidates.length} cards — recommend ONLY from this list)`,
    candidates.map(c => formatCandidate(c)).join('\n'),
    ``,
    `Return the JSON now.`,
  );

  return sections.filter(Boolean).join('\n');
}

// 260615: build/fill emit a LOT of cards (up to 99). Per-card reasoning there
// blows the output past the request timeout (~6-8K tokens). So those modes set
// reasoning to "" — the user reviews the list + role buckets, not 99 essays, and
// can ask Mila Chat about any specific pick. upgrade/retune are a handful of
// swaps, so they KEEP reasoning (it's the whole point of a swap suggestion).
const OMIT_REASONING = `For EVERY card set "reasoning" to an empty string "" — do NOT write per-card explanations. This list is long and the response must stay fast; the role label is enough context.`;
const KEEP_REASONING = `For each swap, "reasoning" is ONE short sentence (~20 words) on why the swap helps.`;

function modeDescription(mode, slotsRemaining) {
  switch (mode) {
    case 'fill':
      return `'fill' — recommend exactly ${slotsRemaining} cards to complete the deck. The user has already chosen the cards in the partial list; do not duplicate them. ${OMIT_REASONING}`;
    case 'upgrade':
      return `'upgrade' — recommend swaps. For each recommendation, set 'swap_out' to the scryfall_id of the card being replaced (must be in the partial-deck list). Aim for 5-15 surgical swaps that improve the deck without overhauling it. ${KEEP_REASONING}`;
    case 'retune':
      return `'retune' — same swap format as 'upgrade'. The goal is to shift the deck's power level toward the target. Cap at 15 swaps; the user wants surgical moves, not a rebuild. ${KEEP_REASONING}`;
    case 'build':
    default:
      return `'build' — recommend a full 99-card list (the commander is already chosen and not part of the 99). Hit the role-bucket targets. ${OMIT_REASONING}`;
  }
}

function formatCandidate(c) {
  const cmc = typeof c.cmc === 'number' ? c.cmc : '?';
  const ci = (c.color_identity || []).join('') || 'C';
  const tl = (c.type_line || '').split(' — ')[0]; // type only, drop subtype to save tokens
  return `- [${c.scryfall_id}] ${c.name} · CMC ${cmc} · ${ci} · ${tl}`;
}
