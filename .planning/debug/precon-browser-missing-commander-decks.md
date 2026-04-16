---
status: diagnosed
trigger: "BROWSE PRECONS browser is missing specific commander decks — either they don't appear in the tile grid at all, or clicking a tile fails to load its decklist"
created: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — two compounding root causes. (a) `set_type` whitelist is too narrow → flagship Commander products (Commander Masters, Commander Legends I+II, Planechase, Archenemy, Premium Deck Series, Game Night, Commander's Arsenal, Commander Collection) are silently filtered out at discovery. (b) Scryfall's `set` is not 1:1 with "WotC precon decklist" → modern multi-deck Commander products (Doctor Who, Fallout, Warhammer 40K, Tales of Middle-earth, Final Fantasy, all 4-deck bundles since C13) load as 400-1000+ card "decklists" mixing all the bundled decks together because Scryfall has no deck-membership metadata.
test: COMPLETE — live-probed Scryfall /sets endpoint, audited set_type distribution, mapped known-popular Commander products to their actual set_types, sampled card_counts on whitelisted sets, cross-referenced with Phase 8 RESEARCH.md §5 Open Question 1 + CONTEXT.md D-09.
expecting: Hand back to user/orchestrator for tier selection (A: minimal allowlist, B: A + bundle size guard, C: curated deck map). Recommendation = A+B together as Phase 8.1 polish; defer C to its own phase.
next_action: Return scope assessment to orchestrator. NO FIX APPLIED — user explicitly asked "scope assessment, not necessarily a fix".

## Symptoms

expected: Click BROWSE PRECONS in the LHS Treasure Cruise add-card panel. Tile grid shows ALL Commander precons sold by WotC (e.g. all 2024 Commander Masters precons, all 2024 Bloomburrow Commander, all Universes Beyond Commander products like Doctor Who, Lord of the Rings Commander), newest first. Click any tile, decklist loads (commander row sorted to top). Click ADD ALL — cards bulk-add to collection.
actual: User reports SOME commander precons are missing from the tile grid, or clicking certain tiles does not load the decklist. Specific precons not yet identified by user.
errors: Not yet captured. Investigation completed without dev-server reproduction — used live Scryfall API probe instead.
reproduction: 1. npm run dev 2. Navigate to /treasure-cruise 3. Click BROWSE PRECONS 4. Inspect tile grid vs Scryfall live API 5. Click tiles to confirm decklists load.
started: Same day as ship — commit dcf50a8 on 2026-04-16. Phase 8 brand new feature.

## Eliminated

- hypothesis: Decklist fetch fails because some sets lack `search_uri` or `released_at`
  evidence: Probed all 70 currently-whitelisted sets (43 commander + 27 duel_deck) — every single one has both fields populated. No data-completeness gap on Scryfall's side for the included list.
  timestamp: 2026-04-16

- hypothesis: Rate-limit queue is silently dropping requests (75-100ms spacing throttling fan-out)
  evidence: `src/services/scryfall-queue.js` is a serial promise chain that throws on non-2xx. Throws are caught by `fetchPreconDecklist` callers and surface as `preconDecklistError` in the store — they are NOT silent. No silent drops possible.
  timestamp: 2026-04-16

- hypothesis: 7-day cache TTL is hiding recently-added precons
  evidence: New precons would only be cached if the user manually visited the browser within the last 7 days. The cache is keyed per-set-code; it doesn't filter the LIST of sets — it stores it. Refresh button in the browser header force-refreshes. Not the cause.
  timestamp: 2026-04-16

- hypothesis: UI sort/filter step is hiding entries (e.g. requires card_count or image_uri)
  evidence: `precon-browser.js` renders every entry from `$store.collection.precons` unconditionally. `sortPrecons()` in precons.js only sorts by released_at + name — no filtering. `image_url` defaults to '' and `keyrune ss-fallback` handles missing icons (per Pitfall 4). Not a UI filter bug.
  timestamp: 2026-04-16

## Evidence

- timestamp: 2026-04-16
  checked: Live Scryfall /sets endpoint — full set_type distribution
  found: Total 1031 sets. The current whitelist `['commander', 'duel_deck']` returns 43 + 27 = 70 sets. Other set_types that contain Commander-style precons: `masters` (32), `box` (43), `archenemy` (4), `planechase` (6), `from_the_vault` (10), `premium_deck` (3), `arsenal` (3), `draft_innovation` (18 — includes Commander Legends sets), `promo` (297 — includes Tales of Middle-earth Deluxe Commander Kit `pltc`).
  implication: Several flagship Commander products are silently filtered out at the discovery step.

- timestamp: 2026-04-16
  checked: Specific user-mentioned precons against live API set_type
  found: Confirmed INCLUDED (set_type=commander): m3c, otc, dsc, blc, ltc, who, plus all 2025/2026 Commander products. Confirmed EXCLUDED (wrong set_type): cmm Commander Masters (set_type=`masters`), clb Commander Legends BfB (`draft_innovation`), cmr Commander Legends (`draft_innovation`), pltc Tales of Middle-earth Deluxe Commander Kit (`promo`), pca/pc2/hop Planechase (`planechase`), arc/e01 Archenemy (`archenemy`), pd2/pd3/h09 Premium Deck Series (`premium_deck`), cm1 Commander's Arsenal + cc1/cc2 Commander Collection (`arsenal`), gnt/gn2/gn3 Game Night (`box`), v09-v17/drb From the Vault (`from_the_vault`).
  implication: User's "missing tiles" hypothesis (a) is confirmed for at least Commander Masters, Commander Legends I+II, Planechase, Archenemy, Premium Deck Series, Game Night, and Commander Collection / Arsenal. These are all real WotC precon products that map to non-whitelisted set_types.

- timestamp: 2026-04-16
  checked: Card counts on the largest WHITELISTED commander/duel_deck sets
  found: who (Doctor Who) = 1178 cards. pip (Fallout) = 1068. 40k (Warhammer 40K) = 617. ltc (Tales of Middle-earth) = 591. fic (Final Fantasy) = 486. moc, ncc, soc, tdc, c21 all > 400. These are not single 100-card decks — they are MULTI-DECK BUNDLES where Scryfall's set is a parent bucket containing 4 separate Commander precons + reprints + foil/showcase variants.
  implication: This is the user's "clicking certain tiles fails to load its decklist" symptom — the decklist DOES load, but it loads as a 1000+-row giant blob that is overwhelming, slow to render, and ADD ALL would dump all 1178 cards instead of the one 100-card deck the user wanted. There is no Scryfall field that distinguishes "deck A vs deck B vs deck C vs deck D within set `who`". The product line "Doctor Who Commander Decks" ships as 4 separate decks (Blast from the Past / Timey-Wimey / Paradox Power / Masters of Evil), but Scryfall represents the whole product as one set with one card pool.

- timestamp: 2026-04-16
  checked: Whether `unique=cards` query (vs current `unique=prints`) would reduce the bloat
  found: who unique=cards = 358 cards (still 4 decks × ~100). who unique=prints = 1178 (with all reprint variants). Reducing to `unique=cards` would help readability but the fundamental "4 decks in one set" problem remains.
  implication: Cosmetic improvement available (switch to unique=cards), but doesn't solve the root ux problem — still no way to pick "just the Blast from the Past deck" from the API alone.

- timestamp: 2026-04-16
  checked: Phase 8 RESEARCH.md §5 Open Question 1 + CONTEXT.md D-09
  found: D-09 was an explicit, locked decision: "Precon browser includes set_type: 'commander' AND set_type: 'duel_deck'. Explicitly excludes set_type: 'starter'." The other set_types (masters, box, archenemy, planechase, from_the_vault, premium_deck, arsenal) were not considered during planning — the discussion focused on `starter` exclusion (Welcome Deck 2017) but did not enumerate the full set_type space. RESEARCH.md §5 Open Question 1 acknowledges Scryfall does not flag commanders within precons; it does NOT discuss the structural "one set = multiple decks" problem.
  implication: This is a planning gap, not a code bug. Phase 8 shipped exactly what D-09 specified. The decision was correct relative to the information surfaced during planning, but the information was incomplete.

## Resolution

root_cause: Two compounding causes:

**Cause 1: Set-type whitelist gap (the "missing tiles" symptom).**
`PRECON_SET_TYPES = ['commander', 'duel_deck']` in `src/services/precons.js:23` excludes several real Commander/multiplayer precon products that Scryfall classifies under other set_types:
- `masters` set_type: Commander Masters (`cmm`, 2023) — flagship reprint Commander product
- `draft_innovation` set_type: Commander Legends (`cmr`, 2020), Commander Legends: Battle for Baldur's Gate (`clb`, 2022) — major Commander products
- `planechase` set_type: Planechase (`hop`, 2009), Planechase 2012 (`pc2`), Planechase Anthology (`pca`, 2016) — multiplayer precons
- `archenemy` set_type: Archenemy (`arc`, 2010), Archenemy: Nicol Bolas (`e01`, 2017) — multiplayer precons
- `premium_deck` set_type: Premium Deck Series Slivers/Fire & Lightning/Graveborn (`h09`/`pd2`/`pd3`)
- `arsenal` set_type: Commander's Arsenal (`cm1`), Commander Collection: Green/Black (`cc1`/`cc2`)
- `box` set_type: Game Night (`gnt`/`gn2`/`gn3`) — pre-built multiplayer decks
- `from_the_vault` set_type: From the Vault series (`v09`-`v17`, `drb`) — premium reprint products
- `promo` set_type: Tales of Middle-earth Deluxe Commander Kit (`pltc`) — and one-offs

**Cause 2: Multi-deck bundle structural gap (the "tile loads but decklist is wrong" symptom).**
Several modern Commander products ship 2-5 separate Commander decks under one Scryfall `set`. The current architecture's `fetchPreconDecklist(code)` returns ALL cards in the set as one decklist:
- `who` Doctor Who: 4 decks (1178 print rows / 358 unique)
- `pip` Fallout: 4 decks (1068 print rows)
- `40k` Warhammer 40K: 4 decks (617 print rows)
- `ltc` Tales of Middle-earth Commander: 4 decks (591 print rows)
- `fic` Final Fantasy Commander: 4 decks (486 print rows)
- `m3c`, `dsc`, `blc`, `otc`, `mkc`, `lcc`, `moc`, `onc`, `ncc`, `c20`-`c21`, etc. — all the modern "4-deck bundle" Commander products
- `scd` Starter Commander Decks: 5 decks (352 cards)
- `cmm` Commander Masters (if whitelist were widened): 4 decks (1067 cards)

Scryfall does not expose deck-membership metadata. The product line "X Commander Decks" maps to one Scryfall set; the four decks within it are WotC product SKUs that have no machine-readable representation in the Scryfall API. This is a fundamental data-model gap, not a code bug.

fix: **Tiered fix recommendation — see Scope Assessment below.** No single-line fix exists. The smallest change (widen the set_type whitelist) addresses Cause 1 only and may make Cause 2 worse (more 1000-card "decklists" appearing). The proper fix requires a deck-disambiguation layer that does not exist in Scryfall.

verification: (pending — fix not yet applied; this is a scope-assessment investigation per the user's request)

files_changed: []

---

## Scope Assessment

This is **NOT a 1-hour bugfix.** This is a tiered set of decisions, each with different scope.

### Tier A: Minimal whitelist widening (LOW risk, HIGH value, ~30 min)

**What:** Add `'masters'` to `PRECON_SET_TYPES` in `src/services/precons.js:23`. Optionally add `'arsenal'` and `'premium_deck'` (3 + 3 sets — small additions of well-known reprint Commander products).

**Adds these tiles:** Commander Masters, Innistrad Remastered, all Masters reprint sets (32 sets), Commander's Arsenal, Commander Collection Green/Black, Premium Deck Series.

**Caveats:**
- Adds non-Commander Masters sets too (`mb2` Mystery Booster 2, `2x2` Double Masters 2022, `dmr` Dominaria Remastered, etc.) — these are draft products, not precons. The browser would now mix in ~28 sets of "reprint draft sets that aren't precons."
- `cmm` itself, while desirable as a tile, has a 1067-card decklist — clicking it triggers Cause 2.

**Better minimal fix:** Add an explicit allowlist of set CODES (not set_types) for these reprint Commander products. Code-level allowlist is ~10 entries, surgically targets the user's likely intent.

**Files:** `src/services/precons.js` (5-line change), `tests/precons.test.js` (extend assertion), `tests/fixtures/scryfall-precons.js` (add fixture rows).

**Risk:** Low — purely additive filter logic.

### Tier B: Whitelist + decklist-size guard (MEDIUM scope, ~2-3 hours)

**What:** Tier A + add a card-count cap on the decklist preview/add-all path. If `cached.decklist.length > 200`, render a "This product contains multiple decks. Open in Scryfall to pick a specific deck." message instead of the giant decklist; disable ADD ALL.

**Adds these tiles:** Same as Tier A.

**Improves UX for:** Doctor Who, Fallout, Warhammer 40K, Tales of Middle-earth, Final Fantasy, all modern 4-deck bundles, Commander Masters — these tiles render and inform the user instead of dumping 400+ cards.

**Caveats:**
- Honest UX (good!) but explicitly tells the user "we can't help you with this one" — may feel like a regression for users who want to add SOMETHING from these products.
- Picking the cap is arbitrary — 200 catches 4-deck bundles cleanly but excludes legitimate 250-card precons (e.g. older Commander 2013 has 356 cards because it includes 5 different Commander 2013 decks).

**Files:** `src/services/precons.js` (whitelist + add bundle-detection), `src/components/precon-browser.js` (multi-deck warning state), `src/stores/collection.js` (block addAllFromPrecon when bundle), tests for all three.

**Risk:** Medium — touches the core add path. Need a clean way to surface "this product has N decks" without false positives.

### Tier C: Proper fix — curated deck-membership map (LARGER scope, ~6-10 hours, warrants its own plan or phase)

**What:** Maintain a curated `src/data/precon-decks.js` mapping each multi-deck Scryfall set to its constituent decks, e.g.:
```js
export const PRECON_DECKS = {
  who: [
    { name: 'Blast from the Past', commander: 'scryfall-id-of-the-doctor', cards: [...100 ids] },
    { name: 'Timey-Wimey', commander: 'scryfall-id-of-...', cards: [...] },
    { name: 'Paradox Power', commander: '...', cards: [...] },
    { name: 'Masters of Evil', commander: '...', cards: [...] },
  ],
  // ... cmm, clb, cmr, m3c, dsc, blc, otc, ...
};
```

**Adds tiles:** Anything we curate. Could ship Tier A whitelist + curated decks for the top 20 multi-deck products.

**Improves UX:** User can pick "Doctor Who → Blast from the Past" and add exactly 100 cards.

**Caveats:**
- Requires data sourcing — must hand-curate from WotC product pages, EDHREC deck databases, or community spreadsheets. Per RESEARCH.md §5: "Best (v1.2+): maintain a curated `{ [code]: [commander_scryfall_id] }` map in `src/data/precon-commanders.js`. Out of scope for Phase 8 per D-10."
- This was already deferred to v1.2 in the research phase. The user is now hitting the v1.2 problem at v1.1 launch.
- Maintenance burden — every new Commander product release needs an update.

**Files:** New `src/data/precon-decks.js` (data file), `src/services/precons.js` (deck-disambiguation layer), `src/components/precon-browser.js` (per-deck tile or sub-tile after picking a multi-deck product), `src/stores/collection.js` (per-deck add-all), full test coverage.

**Risk:** Medium-high — net-new feature with its own data layer. Warrants its own plan.

### Tier D: Out-of-scope alternatives (mention for completeness)

- **Scrape EDHREC / Archidekt** for deck-membership data — CORS issues in production, ToS concerns, data freshness problems.
- **Wait for Scryfall to add deck-membership metadata** — community-requested for years; no timeline. Not an option.

---

## Recommendation for the orchestrator

**Land Tier A as a quick fix in Phase 8.1 polish pass** (alongside follow-up items 1-3), gated by:
- Use a code-level allowlist `PRECON_EXTRA_CODES = ['cmm', 'clb', 'cmr', 'cm1', 'cc1', 'cc2', 'pd3', 'pd2', 'h09', 'pca', 'pc2', 'hop', 'arc', 'e01', 'pltc', 'gnt', 'gn2', 'gn3']` rather than widening set_type — surgical, no false positives.
- Add a decklist-size guard (Tier B's UX message) at threshold `decklist.length > 200` — explicit "multi-deck bundle" warning for these tiles AND any whitelisted-but-multi-deck products like `who`, `pip`, `40k`, `ltc`, `m3c`, `dsc`, `blc`, etc.

This combination addresses ~80% of the user's pain in 2-3 hours of work and is a clean increment to Phase 8.

**Defer Tier C to a dedicated phase** (suggested `Phase 8.2 — Precon Deck Curation` or fold into a future Treasure Cruise polish phase). Tier C requires a data-curation effort that should not block the immediate UX fix.

**Do NOT land Tier A alone without Tier B** — widening the whitelist makes the multi-deck UX problem MORE visible (more 1000-card "decklists" appear), so the size guard must ship alongside.

### Files of interest for whoever picks up the fix

- `src/services/precons.js` — whitelist + decklist fetch (Tier A + bundle detection)
- `src/components/precon-browser.js` — UI for multi-deck warning (Tier B)
- `src/stores/collection.js` — `addAllFromPrecon` add-blocking when bundle detected (Tier B)
- `src/data/precon-decks.js` — NEW (Tier C only) curated deck-membership map
- `tests/precons.test.js` — extend with new fixture rows and bundle-guard assertions
- `tests/fixtures/scryfall-precons.js` — add `masters`/`draft_innovation`/`planechase`/`archenemy` fixture rows; add a >200-card mock to exercise the size guard
- `.planning/phases/08-treasure-cruise-rapid-entry/follow-ups.md` item 4 — update with this scope assessment so the planner has it
