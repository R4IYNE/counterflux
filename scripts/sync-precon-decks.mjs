#!/usr/bin/env node
// scripts/sync-precon-decks.mjs
//
// Phase 14.07j — build-time generator for src/data/precon-deck-memberships.json.
//
// Fetches MTGJSON's DeckList.json (the index of every published WotC deck)
// + each individual deck file for the multi-deck Commander bundles we care
// about, then writes a static lookup of scryfall_id → deck membership keyed
// by Scryfall set code. Replaces the brittle color-identity heuristic that
// Phase 14.07c-e shipped with O(1) deterministic data:
//
//   {
//     "fic": {
//       "Limit Break (FINAL FANTASY VII)": ["07b4e4f8-...", "31513afc-...", ...],
//       "Revival Trance (FINAL FANTASY VI)": [...],
//       ...
//     },
//     "who": { ... },
//     ...
//   }
//
// Each deck list is exactly 100 Scryfall IDs (1 commander + 99 mainBoard),
// matching what WotC actually shipped in the boxed product.
//
// Run manually whenever a new multi-deck Commander product releases:
//   node scripts/sync-precon-decks.mjs
// or via npm:
//   npm run sync:precons
//
// Output is written to src/data/precon-deck-memberships.json. Commit the
// result so the runtime bundles a static asset (no network at app boot).

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MTGJSON_DECKLIST_URL = 'https://mtgjson.com/api/v5/DeckList.json';
const MTGJSON_DECK_URL = (fileName) =>
  `https://mtgjson.com/api/v5/decks/${fileName}.json`;
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/precon-deck-memberships.json',
);

// We only ship deck-membership data for *multi-deck* Commander bundles —
// single-deck products like Secret Lair drops or solo precons don't need
// the splitter. Group MTGJSON decks by set code and keep groups of 2+.
//
// Also skip "Collector's Edition" duplicates (same card list, foil/alt-art
// reprints) — the user doesn't need two tile entries per actual deck.
const MIN_DECKS_PER_BUNDLE = 2;
const COLLECTORS_EDITION_RE = /Collector'?s? Edition/i;
const COMMANDER_DECK_TYPE = 'Commander Deck';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Counterflux/1.0 sync-precon-decks' },
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.json();
}

function normalizeDeckName(name) {
  // MTGJSON deck names include parentheses with the source product
  // (e.g. "Limit Break (FINAL FANTASY VII)"). Keep them — they disambiguate
  // products like "Eldrazi Unbound (Commander Masters)" from any future
  // "Eldrazi Unbound" deck in another product. Cheap, accurate, no
  // information loss.
  return name.trim();
}

async function main() {
  console.log(`[sync-precons] fetching ${MTGJSON_DECKLIST_URL}…`);
  const index = await fetchJson(MTGJSON_DECKLIST_URL);
  const allDecks = index.data || [];
  console.log(`[sync-precons] ${allDecks.length} decks in DeckList`);

  // Group commander decks by set code, dropping Collector's Edition variants.
  const byCode = new Map();
  for (const deck of allDecks) {
    if (deck.type !== COMMANDER_DECK_TYPE) continue;
    if (COLLECTORS_EDITION_RE.test(deck.name)) continue;
    const code = (deck.code || '').toLowerCase();
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(deck);
  }

  const bundleCodes = Array.from(byCode.entries())
    .filter(([, decks]) => decks.length >= MIN_DECKS_PER_BUNDLE)
    .map(([code]) => code);

  console.log(
    `[sync-precons] ${bundleCodes.length} multi-deck Commander bundles to fetch:`,
    bundleCodes.join(', '),
  );

  const memberships = {};
  let totalDecksFetched = 0;
  let totalCards = 0;

  for (const code of bundleCodes) {
    memberships[code] = {};
    for (const meta of byCode.get(code)) {
      const url = MTGJSON_DECK_URL(meta.fileName);
      let deckJson;
      try {
        deckJson = await fetchJson(url);
      } catch (err) {
        console.warn(`[sync-precons] skip ${meta.fileName}: ${err.message}`);
        continue;
      }
      const deck = deckJson.data || {};
      const cards = [...(deck.commander || []), ...(deck.mainBoard || [])];
      const entries = [];
      for (const card of cards) {
        const id = card?.identifiers?.scryfallId;
        const name = card?.name || '';
        const count = card?.count ?? 1;
        if (!id && !name) continue;
        // Phase 14.07k — store {id, name} per card so the runtime splitter
        // can fall back to name match when the id misses (different printings,
        // bonus-set cards). Honour count by repeating the entry verbatim so
        // basic lands and other multiples land in deckCards N times.
        for (let i = 0; i < count; i++) entries.push({ id, name });
      }
      const deckName = normalizeDeckName(deck.name || meta.name);
      memberships[code][deckName] = entries;
      totalDecksFetched += 1;
      totalCards += entries.length;
      console.log(
        `[sync-precons]   ${code} · ${deckName} → ${entries.length} cards`,
      );
    }
  }

  // Stable JSON output for diff-friendly commits
  const sortedOutput = {};
  for (const code of Object.keys(memberships).sort()) {
    sortedOutput[code] = {};
    for (const name of Object.keys(memberships[code]).sort()) {
      sortedOutput[code][name] = memberships[code][name];
    }
  }

  const payload = JSON.stringify(
    {
      $schema: 'precon-deck-memberships v1',
      generated_at: new Date().toISOString(),
      generator: 'scripts/sync-precon-decks.mjs',
      source: MTGJSON_DECKLIST_URL,
      bundle_count: bundleCodes.length,
      deck_count: totalDecksFetched,
      card_count: totalCards,
      memberships: sortedOutput,
    },
    null,
    2,
  );

  await writeFile(OUTPUT_PATH, payload + '\n', 'utf8');
  console.log(
    `[sync-precons] wrote ${OUTPUT_PATH} — ${bundleCodes.length} bundles, ${totalDecksFetched} decks, ${totalCards} cards`,
  );
}

main().catch((err) => {
  console.error('[sync-precons] failed:', err);
  process.exit(1);
});
