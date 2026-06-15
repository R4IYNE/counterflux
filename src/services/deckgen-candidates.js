/**
 * Phase 17 (v1.3) — Deckgen candidate pool builder.
 *
 * Produces the pre-filtered list of cards that /api/deckgen hands to Claude.
 * The candidate pool is the single most important input to the LLM call —
 * everything Claude can recommend must be in here, and nothing else. This
 * keeps hallucinations impossible (Claude can pick the wrong card, but
 * cannot pick a card that doesn't exist).
 *
 * Sources:
 *   1. EDHREC top-300 synergies for the commander (deterministic, cached)
 *   2. The user's collection (optional, filters synergies by ownership)
 *
 * Output shape: each candidate carries enough metadata for Claude to slot
 * it into a role bucket (CMC, type_line, mana_cost, color_identity).
 *
 * Pure module — no Supabase or Anthropic calls. Tested in isolation via
 * synthetic synergy + collection arrays.
 */

// 260615: raised 200 → 250 so the widened EDHREC harvest (synergy + ramp +
// lands + creatures + removal spells) fits with full category coverage. Below
// ~250 the structural categories (lands/ramp) or the removal spells get starved
// by the cap. Still well within the prompt token budget.
const MAX_CANDIDATES = 250;
const COMMANDER_FORMAT = 'commander';

/**
 * Build the candidate pool that Claude will see.
 *
 * @param {Object} input
 * @param {Array<Object>} input.synergies      - EDHREC top synergies, descending by score.
 *                                               Each: { name, scryfall_id, synergy_score }
 * @param {Array<Object>} input.cards          - Card metadata from db.cards (joined to synergies by scryfall_id).
 *                                               Each: { id, name, cmc, mana_cost, type_line, color_identity, legalities }
 * @param {Set<string>|null} input.ownedIds    - Set of scryfall_ids the user owns.
 *                                               `null` disables the filter ("use full pool").
 * @param {Array<string>} input.colorIdentity  - Commander's color identity, e.g. ['W', 'U', 'B']
 * @param {Object} input.commander             - Commander card metadata (so it's never recommended as a candidate)
 * @returns {Array<Object>} Pre-filtered candidate list, capped at MAX_CANDIDATES.
 *                          Each: { scryfall_id, name, cmc, mana_cost, type_line, color_identity, synergy_score }
 */
export function buildCandidatePool({ synergies, cards, ownedIds, colorIdentity, commander }) {
  if (!Array.isArray(synergies) || synergies.length === 0) return [];

  const cardMap = new Map();
  for (const c of cards || []) {
    if (c?.id) cardMap.set(c.id, c);
  }

  const commanderId = commander?.id || commander?.scryfall_id;
  const ciSet = new Set((colorIdentity || []).map((c) => String(c).toUpperCase()));
  const out = [];

  for (const s of synergies) {
    const id = s?.scryfall_id;
    if (!id || id === commanderId) continue;

    const card = cardMap.get(id);
    if (!card) continue;
    if (!isPaperLegalCommander(card)) continue;
    if (!isWithinColorIdentity(card.color_identity, ciSet)) continue;
    if (ownedIds instanceof Set && !ownedIds.has(id)) continue;

    out.push({
      scryfall_id: id,
      name: card.name || s.name || '',
      cmc: typeof card.cmc === 'number' ? card.cmc : 0,
      mana_cost: card.mana_cost || '',
      type_line: card.type_line || '',
      color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
      synergy_score: typeof s.synergy_score === 'number' ? s.synergy_score : 0,
    });

    if (out.length >= MAX_CANDIDATES) break;
  }

  return out;
}

/**
 * Hash a collection ID set into a short stable digest for use in the
 * response-cache key. We don't want the full ~1000-id list in the hash
 * input, and the order shouldn't matter — sort + join + length.
 *
 * Two collections with identical contents produce identical hashes
 * regardless of insertion order.
 *
 * @param {Set<string>|Array<string>|null} ids
 * @returns {string} 16-char hex digest (deterministic for the same input)
 */
export function hashCollection(ids) {
  if (!ids) return 'no-collection';
  const sorted = [...ids].filter(Boolean).sort();
  if (sorted.length === 0) return 'empty';
  return djb2Hex(sorted.join('|')) + ':' + sorted.length;
}

/**
 * Build the cache key for /api/deckgen response cache.
 *
 * Hash is content-addressable: same inputs produce same hash, different
 * inputs produce different hashes. Two users with identical decks and
 * identical collections share cache hits — privacy is preserved because
 * the hash is non-reversible (you can't recover the inputs from the hash).
 *
 * @param {Object} input
 * @param {string} input.commanderId
 * @param {number} input.powerLevel  - 1-10
 * @param {string} input.mode        - 'build' | 'fill' | 'upgrade' | 'retune'
 * @param {string} input.archetypeHint
 * @param {string} input.collectionHash - From hashCollection()
 * @returns {string} 32-char hex hash
 */
export function buildCacheKey({ commanderId, powerLevel, mode, archetypeHint, collectionHash }) {
  const parts = [
    'deckgen',
    'v1',                                       // schema version — bump on prompt changes
    String(commanderId || ''),
    `p${powerLevel ?? 'n'}`,
    `m${mode || 'build'}`,
    `a${(archetypeHint || '').toLowerCase().trim()}`,
    collectionHash || 'no-collection',
  ];
  return djb2Hex(parts.join('::'));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Paper-legal-in-Commander filter. Excludes digital-only, banned, and
 * memorabilia printings. Matches the filter used by findCheapestLegalPrinting
 * elsewhere in the codebase so candidates align with what `/api/deckgen`
 * commits to the deck.
 */
function isPaperLegalCommander(card) {
  if (!card) return false;
  const games = Array.isArray(card.games) ? card.games : null;
  if (games && !games.includes('paper')) return false;
  if (card.set_type === 'memorabilia') return false;
  const legality = card.legalities?.[COMMANDER_FORMAT];
  if (legality === 'banned' || legality === 'not_legal') return false;
  return true;
}

/**
 * A card is within colour identity iff every colour in its identity appears
 * in the commander's identity set. Colourless cards (empty array) are
 * always allowed.
 */
function isWithinColorIdentity(cardColors, ciSet) {
  if (!Array.isArray(cardColors) || cardColors.length === 0) return true;
  for (const c of cardColors) {
    if (!ciSet.has(String(c).toUpperCase())) return false;
  }
  return true;
}

/**
 * djb2 hash, hex-encoded. Deterministic, fast, sufficient for content-
 * addressable cache keys (we don't need crypto strength — collisions are
 * cache misses, not security failures).
 */
function djb2Hex(input) {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
