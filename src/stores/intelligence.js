import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import {
  getCommanderSynergies,
  normalizeSalt,
  aggregateDeckSalt,
  fetchTopSaltMap,
} from '../services/edhrec.js';
import { findDeckCombos } from '../services/spellbook.js';
import {
  detectGaps,
  DEFAULT_THRESHOLDS,
  detectGapsRAG,
  RAG_THRESHOLDS,
} from '../utils/gap-detection.js';

/**
 * Cache staleness threshold for combo data (24 hours).
 * Combo data changes less frequently than synergies.
 */
const COMBO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Initialize the intelligence Alpine store.
 * Orchestrates EDHREC synergies, Spellbook combos, salt scores,
 * and gap detection — exposing structured state for UI components.
 *
 * Call during app startup after initDeckStore().
 */
export function initIntelligenceStore() {
  Alpine.store('intelligence', {
    // === State ===
    synergies: [],
    combos: { included: [], almostIncluded: [] },
    comboMap: {},
    gaps: [],
    saltScore: null,
    saltLabel: '',
    loading: { edhrec: false, spellbook: false },
    error: { edhrec: false, spellbook: false },
    thresholds: null,

    // === EDHREC synergies + salt ===

    /**
     * Fetch EDHREC synergy data and salt score for a commander.
     * Degrades gracefully on failure (D-03): shows warning toast,
     * clears synergies, and sets error flag.
     * @param {string} commanderName
     */
    async fetchForCommander(commanderName) {
      this.loading.edhrec = true;
      this.error.edhrec = false;

      const result = await getCommanderSynergies(commanderName);

      if (result.error) {
        this.error.edhrec = true;
        this.synergies = [];
        this.saltScore = null;
        this.saltLabel = '';
        Alpine.store('toast')?.warning(
          'Intelligence unavailable \u2014 using local heuristics.'
        );
      } else {
        // Filter synergies to cards with at least one paper-legal commander printing
        const filtered = [];
        for (const s of result.synergies) {
          const printings = await db.cards.where('name').equals(s.name).toArray();
          const hasLegal = printings.some(c =>
            c.games?.includes('paper') &&
            c.set_type !== 'memorabilia' &&
            c.legalities?.commander === 'legal'
          );
          if (hasLegal) filtered.push(s);
        }
        this.synergies = filtered;

        // === DECK-04 root-cause fix (09-RESEARCH §"DECK-04") ===
        // Salt is the AGGREGATE across the deck's cards, not just the
        // commander's own salt score.  fetchTopSaltMap pulls EDHREC's
        // Top-100 saltiest in a single cached request; we look up each
        // active card by name (default 0 for cards outside the top 100)
        // and run the values through aggregateDeckSalt (existing math
        // primitive, unchanged).  v1.0 only ever showed `commanderSalt`,
        // which is why the gauge always read near-zero for "salty" decks
        // built around stax pieces — Stasis/Winter Orb/etc. dominate the
        // aggregate but the commander itself is usually mild.
        try {
          const saltMap = await fetchTopSaltMap();
          const activeCards = Alpine.store('deck')?.activeCards || [];
          // activeCards entries carry `card` (Scryfall projection) per
          // src/stores/deck.js loadDeck() — fall back to entry.name for
          // any callers that pass a flatter shape.
          const saltValues = activeCards.map((entry) => {
            const name = entry?.card?.name || entry?.name;
            return name ? (saltMap[name] ?? 0) : 0;
          });
          const aggregate = aggregateDeckSalt(saltValues);
          if (aggregate != null && aggregate > 0) {
            this.saltScore = aggregate;
            this.saltLabel = saltLabel(this.saltScore);
          } else if (result.commanderSalt != null) {
            // Backward-compat fallback: commander salt only when no deck
            // cards land in the Top-100 (e.g. Mila's first-boot empty
            // deck, or a freshly-imported deck whose card data hasn't
            // hydrated yet).
            this.saltScore = normalizeSalt(result.commanderSalt);
            this.saltLabel = saltLabel(this.saltScore);
          } else {
            this.saltScore = null;
            this.saltLabel = '';
          }
        } catch {
          // Network or schema failure — degrade to commander-only path.
          if (result.commanderSalt != null) {
            this.saltScore = normalizeSalt(result.commanderSalt);
            this.saltLabel = saltLabel(this.saltScore);
          } else {
            this.saltScore = null;
            this.saltLabel = '';
          }
        }
      }

      this.loading.edhrec = false;
    },

    // === Spellbook combos ===

    /**
     * Fetch combo data for a deck via Commander Spellbook.
     * Checks local combo_cache first (24h TTL), fetches fresh on miss.
     * Builds comboMap for O(1) per-card badge lookup.
     * @param {Object} deck - Active deck object with id, commander_name, partner_name
     * @param {Array} cards - Active deck cards with card.name
     */
    async fetchCombos(deck, cards) {
      this.loading.spellbook = true;
      this.error.spellbook = false;

      const commanderNames = [deck.commander_name, deck.partner_name].filter(
        Boolean
      );
      const cardNames = cards.map((c) => c.card?.name).filter(Boolean);

      try {
        // Check cache
        const cached = await db.combo_cache.get(deck.id);
        let result;

        if (cached && Date.now() - cached.fetched_at < COMBO_CACHE_TTL_MS) {
          result = cached.data;
        } else {
          result = await findDeckCombos(commanderNames, cardNames);

          if (result.error) {
            this.error.spellbook = true;
            this.combos = { included: [], almostIncluded: [] };
            this.comboMap = {};
            Alpine.store('toast')?.warning('Combo detection unavailable.');
            this.loading.spellbook = false;
            return;
          }

          // Cache result
          await db.combo_cache.put({
            deck_id: deck.id,
            data: result,
            fetched_at: Date.now(),
          });
        }

        // Mark missing pieces on almostIncluded combos
        const deckCardSet = new Set([...commanderNames, ...cardNames]);
        for (const combo of result.almostIncluded) {
          for (const piece of combo.pieces) {
            piece.missing = !deckCardSet.has(piece.name);
          }
        }

        this.combos = result;
        this.comboMap = buildComboMap(result.included);
      } catch {
        this.error.spellbook = true;
        this.combos = { included: [], almostIncluded: [] };
        this.comboMap = {};
      }

      this.loading.spellbook = false;
    },

    // === Gap detection (synchronous, local) ===

    /**
     * Detect category gaps by comparing analytics against thresholds.
     *
     * Phase 9 Plan 1 Task 3 (DECK-03): switched from the two-tier
     * critical/warning detector to the three-tier RAG detector. The new
     * shape carries `severity: 'red' | 'amber' | 'green'` plus
     * `suggestedAdd` so deck-analytics-panel can render the
     * `[RED|AMBER] +N` badge format mandated by D-04. Per-deck custom
     * thresholds (this.thresholds, set via saveDeckThresholds) override
     * RAG_THRESHOLDS keys defensively — callers historically passed
     * single-number values (legacy DEFAULT_THRESHOLDS shape), so we
     * normalise those into { green: N, amber: round(N * 0.6) } before
     * feeding detectGapsRAG.
     *
     * @param {Object} analytics - Output from computeDeckAnalytics
     * @param {number} deckSize - Total deck size (default 100)
     * @param {string[]} deckTags - Strategy tags for archetype-aware
     *                              creature threshold pick (D-03 RESEARCH).
     */
    updateGaps(analytics, deckSize = 100, deckTags = []) {
      let ragMap = RAG_THRESHOLDS;
      if (this.thresholds) {
        // Normalise legacy single-number thresholds into { green, amber }
        // so saveDeckThresholds doesn't have to be touched in this PR.
        const normalised = {};
        for (const [k, v] of Object.entries(this.thresholds)) {
          normalised[k] = (typeof v === 'number')
            ? { green: v, amber: Math.max(1, Math.round(v * 0.6)) }
            : v;
        }
        ragMap = normalised;
      }
      this.gaps = detectGapsRAG(analytics, ragMap, deckTags, deckSize);
    },

    // === Per-deck threshold management ===

    /**
     * Load custom thresholds for a deck from Dexie meta store.
     * Falls back to null (use DEFAULT_THRESHOLDS) if not set.
     * @param {number} deckId
     */
    async loadDeckThresholds(deckId) {
      try {
        const cached = await db.meta.get('thresholds-' + deckId);
        this.thresholds = cached?.thresholds || null;
      } catch {
        this.thresholds = null;
      }
    },

    /**
     * Save custom thresholds for a deck and recalculate gaps.
     * @param {number} deckId
     * @param {Object} thresholds - Category-to-minimum-count map
     */
    async saveDeckThresholds(deckId, thresholds) {
      await db.meta.put({ key: 'thresholds-' + deckId, thresholds });
      this.thresholds = thresholds;
    },

    // === Card-level combo helpers ===

    /**
     * Get the number of combos a card participates in.
     * @param {string} cardName
     * @returns {number}
     */
    getComboCount(cardName) {
      return (this.comboMap[cardName] || []).length;
    },

    /**
     * Get all combos a card participates in.
     * @param {string} cardName
     * @returns {Array}
     */
    getCombosForCard(cardName) {
      return this.comboMap[cardName] || [];
    },

    // === Lifecycle ===

    /**
     * Reset all intelligence state to initial values.
     * Called when navigating away from deck editor.
     */
    reset() {
      this.synergies = [];
      this.combos = { included: [], almostIncluded: [] };
      this.comboMap = {};
      this.gaps = [];
      this.saltScore = null;
      this.saltLabel = '';
      this.loading = { edhrec: false, spellbook: false };
      this.error = { edhrec: false, spellbook: false };
      this.thresholds = null;
    },
  });
}

// === Internal helpers ===

/**
 * Derive salt label from normalized 0-10 score.
 * @param {number} score
 * @returns {string}
 */
function saltLabel(score) {
  if (score == null) return '';
  if (score <= 3) return 'MILD';
  if (score <= 6) return 'SPICY';
  return 'CRITICAL';
}

/**
 * Build a map of card name -> array of combos that card participates in.
 * Enables O(1) lookup for combo badge rendering on card tiles.
 * @param {Array} includedCombos - Array of combo objects with pieces[].name
 * @returns {Object} Map of cardName -> [combo, ...]
 */
function buildComboMap(includedCombos) {
  const map = {};
  for (const combo of includedCombos) {
    for (const piece of combo.pieces) {
      if (!map[piece.name]) map[piece.name] = [];
      map[piece.name].push(combo);
    }
  }
  return map;
}
