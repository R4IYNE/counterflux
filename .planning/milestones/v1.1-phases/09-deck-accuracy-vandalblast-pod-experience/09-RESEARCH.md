# Phase 09: Deck Accuracy + Vandalblast Pod Experience — Research

**Researched:** 2026-04-16
**Domain:** Deck analytics correctness + game-tracker pod-play UX (Alpine.js + Dexie + EDHREC API)
**Confidence:** HIGH for codebase + EDHREC contract; HIGH for Material Symbols glyphs (npm package ships full Outlined variable font); MEDIUM for RAG thresholds (community-derived not peer-reviewed)

## Summary

Phase 9 has been extensively de-risked by `09-CONTEXT.md` (19 locked decisions) and the Phase 7 schema chain (turn_laps already on the games table). This research resolves the seven explicit deferrals and surfaces one **root-cause salt-score finding** that overrides the original D-04/D-06 framing.

**Headline discoveries:**

1. **DECK-04 root cause is wrong, not just buggy.** `src/services/edhrec.js:107-134` (`getCardSalt`) queries `data.container?.json_dict?.card?.salt` against `/pages/cards/{slug}.json` — but EDHREC's card-page JSON has NO `card.salt` at that path. Salt for individual cards is exposed only on commander pages (`container.json_dict.card.salt` for the commander itself) and inside `similar[].salt` arrays of OTHER cards' pages. The Top-100-Saltiest endpoint (`/pages/top/salt.json`) returns the canonical card-name → salt map in a SINGLE request. Plan 1 must rewrite the salt fetch path.
2. **GAME-09 is half-implemented.** `turn_laps` has a schema column (Phase 7 v6) but `nextTurn()` in `src/stores/game.js:217-225` does NOT push to it, and `saveGame()` does NOT persist it. Plan 3 adds both writes.
3. **GAME-10 is structurally broken.** `startTimer()` uses `setInterval(..., 1000)` (Pitfall: background-tab throttling). Wall-clock anchor refactor is mandatory.
4. **GAME-05 is mislabelled.** The "fullscreen toggle" is a STORE BOOLEAN (`$store.app.gameFullscreen`) that no CSS/DOM consumes — the bug is that the toggle does nothing visible AND there's nothing implementing the actual Fullscreen API. Plan 2 must wire `Element.requestFullscreen()` against the `<main>` element AND a CSS pass that responds to `:fullscreen`.
5. **Material Symbols Outlined ships as a single variable woff2** (npm `material-symbols@0.44.0`, imported in `src/main.js:5`). Every name in the Google Material Symbols catalog renders via the `liga` feature — no per-icon CSS rule, no glyph manifest to consult. Glyph picks are validated by writing the icon name as text content.
6. **`tests/router.test.js > vandalblast`** failure is an Alpine init shim issue: the screen calls `Alpine.data('postGameOverlay', postGameOverlay)` synchronously at mount, but `tests/router.test.js` doesn't import & start Alpine before mounting (the `@vitest-environment jsdom` is set, but Alpine itself is undefined at line 17). Plan 2 fixes by either guarding the call (`Alpine?.data?.(...)`) or having the test boot Alpine first.

**Primary recommendation:** Plan 1 fixes salt at the SOURCE (rewrite `getCardSalt` to consume `/pages/top/salt.json` once, cache the whole map in Dexie v10 `salt_cache`, look up by name on demand). Plan 2 ships layout/visual fixes + the `:fullscreen` CSS contract + the router-test shim. Plan 3 ships turn-lap mechanics + post-game pacing + slot-machine spinner.

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 19 D-NN decisions in `09-CONTEXT.md <decisions>` are LOCKED. Researcher has exercised discretion only on the items the CONTEXT explicitly delegated (D-12 glyph picks, D-15 spinner curve, D-10 active-rotation choice, D-05 cache schema). The researcher must not contradict any locked D-NN. Summary of plan-shape locks:

- **D-00:** ONE phase, 3 plans (DECK accuracy / Vandalblast layout / Vandalblast mechanics). Single VERIFICATION + HUMAN-UAT covering all 15 requirements.
- **D-01..D-08:** DECK-01..05 — fixture-based analytics validation, per-category dynamic RAG thresholds, EDHREC live salt API, intelligence.js calc fix, Commander as own type category, back button QA.
- **D-09..D-14:** GAME-01..06 — clipping fix, T-shape 3-player layout, life RAG colours (green > 20 / amber ≤ 20 / red ≤ 10), Material Symbols counter icons, fullscreen state preservation, in-card counter editing.
- **D-15..D-19:** GAME-07..10 — slot-machine first-player spinner, primary-blue active-player border-glow (mirroring Phase 8.1 cf-panel-reopen), turn-lap persistence, wall-clock turn-timer anchor, Turn Pacing post-game stats section.

### Claude's Discretion (delegated by CONTEXT.md, resolved below)

1. Material Symbols glyph picks — D-12 (poison, tax, commander damage)
2. Slot-machine spinner timing curve — D-15
3. Salt-score cache table name + schema — D-05 / specifics §4
4. Active player auto-rotates to top slot in 3-player layout — D-10 / specifics §5
5. Test infrastructure for game-tracker (RAF + fake-timers extensions to `tests/setup.js`) — D-19 closing note

### Deferred Ideas (OUT OF SCOPE — do not address)

- Mobile-responsive Vandalblast polish — future phase
- Pareto curve, synergy heatmap, deck archetype tagging — out of Phase 9
- 2-player dramatic dueling-banner coin-flip presentation — Phase 9 ships generic spinner for all player counts
- Production CORS proxy for EDHREC — v1.1 carry-over from STATE.md blockers

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECK-01 | Deck editor back button verified | `src/components/deck-editor.js:34-37` — dispatches `deck-back-to-landing` CustomEvent. Plan 1 sanity-checks listener in `src/components/deck-landing.js`. |
| DECK-02 | Mana curve + colour distribution validated against 3 reference decks | Three commanders selected below (mono/dual/5C). Existing `tests/deck-analytics.test.js` already covers the math primitives — Plan 1 adds fixture-driven end-to-end tests. |
| DECK-03 | Gap warnings show RAG badge + "+N", no redundant category | Per-category thresholds derived below. Existing `src/utils/gap-detection.js` has DEFAULT_THRESHOLDS but only tests `count < threshold` — needs three-tier thresholds. UI fix in `src/components/deck-analytics-panel.js:600-629` (the gap-warning render block). |
| DECK-04 | Salt gauge non-zero for salty decks | **Root cause: wrong endpoint path.** Rewrite `getCardSalt` in `src/services/edhrec.js` to consume `/pages/top/salt.json` bulk endpoint. `src/stores/intelligence.js:74-82` reads `result.commanderSalt` — change to compute aggregate from card-list lookups using `aggregateDeckSalt` (already correct in `src/services/edhrec.js:152-159`). Salt gauge component (`src/components/salt-gauge.js`) UNCHANGED. |
| DECK-05 | Commander as own type category | Use `deck.commander_id` (Phase 7 schema field, present on `decks` table per v8 declaration). Render as new section in `src/components/deck-centre-panel.js:157` BEFORE the `for (const type of TYPE_ORDER)` loop. |
| GAME-01 | Player name no longer clips | `src/components/player-card.js:34` — `syne-header text-[20px]` with no `padding-bottom` on the card. Add `padding-bottom: 16px` + `text-overflow: ellipsis` + `overflow: hidden` to the name span. |
| GAME-02 | 3-player T-shape layout | `src/components/player-card.js:175` — `grid grid-cols-1 md:grid-cols-2`. Add 3-player branch via Alpine `:class` binding driven by `$store.game.players.length === 3`. |
| GAME-03 | RAG life colours | `src/components/player-card.js:217` — life span needs dynamic `:style` based on life value (>20/≤20/≤10). |
| GAME-04 | Material Symbols counter icons | npm `material-symbols@0.44.0` outlined.css already imported via `src/main.js:5`. Glyph picks resolved below. |
| GAME-05 | Fullscreen state preservation | **Bug is deeper than CONTEXT framing.** `gameFullscreen` is a store boolean nothing reads. Plan 2 wires `document.documentElement.requestFullscreen()` against the page (or `<main>`) and a `:fullscreen` CSS rule that hides chrome. State is preserved automatically because the DOM tree is unchanged — Alpine state lives on the same nodes. |
| GAME-06 | In-card counter editing | `src/components/counter-panel.js` already has the toggle/numeric mutation logic — Plan 2 adds a per-player inline +/- block to the player-card expanded section (`src/components/player-card.js:343-370` already has counter rendering, just needs +/- buttons that call `$store.game.adjustCounter` directly). |
| GAME-07 | First-player spinner | New component `src/components/first-player-spinner.js` invoked from `src/stores/game.js:142` (after `players` array constructed). Animation spec resolved below. Result persisted via new `first_player` field on `players[N].is_first` boolean (additive, no schema bump). |
| GAME-08 | Active-player highlight | New `activePlayerIndex` field on game store, advances on `nextTurn()`. CSS class `cf-player-active` in `main.css` mirrors `cf-panel-reopen` border-glow treatment. Selector added to existing `@media (prefers-reduced-motion: reduce)` block (Phase 8.1 coordination pattern, STATE.md line ~111). |
| GAME-09 | Turn-lap persistence + post-game stats | `nextTurn()` rewrites: snapshot `Date.now()` at turn start, push `Date.now() - turnStartedAt` onto `turn_laps` (already on schema). `saveGame()` includes `turn_laps`. New "TURN PACING" section in `src/components/post-game-overlay.js` per D-19 spec. |
| GAME-10 | Wall-clock anchor turn timer | Replace `setInterval` in `src/stores/game.js:229-235` with `Date.now()` snapshot + `requestAnimationFrame` display tick. Lap calculation = `Date.now() - turnStartedAt`. |

## CONTEXT.md Deferrals Resolved

### 1. DECK-02 Reference Deck Selection (resolves D-01 / Discretion #1)

Three commanders chosen to exercise mono / 2-colour / 5-colour code paths and a meaningful mana-curve / colour-distribution variance. EDHREC top-deck snapshots used as the canonical card list source. Hand-calculation produced the `expected.json` shape per D-02.

| Slot | Commander | Scryfall ID | Identity | EDHREC slug | Source URL |
|------|-----------|-------------|----------|------------|------------|
| Mono-R aggro | Krenko, Mob Boss | `9f5ee5cf-3b04-4ce0-8c4d-1d23c5b09b56` | `["R"]` | `krenko-mob-boss` | `https://json.edhrec.com/pages/commanders/krenko-mob-boss.json` |
| Dual-UR midrange | Niv-Mizzet, Parun | `3fe6dccd-19ac-4415-a48a-446b9b34ed13` | `["U","R"]` | `niv-mizzet-parun` | `https://json.edhrec.com/pages/commanders/niv-mizzet-parun.json` |
| 5C goodstuff | The Ur-Dragon | `5c01c48d-faec-4458-8ec0-1efe4f2b39be` | `["W","U","B","R","G"]` | `the-ur-dragon` | `https://json.edhrec.com/pages/commanders/the-ur-dragon.json` |

**Why these three:**
- Mono-R Krenko: tightest possible colour pie (R = 1.0 for all coloured spells), low average CMC (~2.8), tests the "single bucket dominates" code path.
- Dual-UR Niv-Mizzet: forces hybrid counting (some cards `{U}{R}`, some hybrid pip), tests fractional colour distribution.
- 5C Ur-Dragon: every colour bucket non-zero, most sweepers + multicolour, exercises the highest-CMC bucket (`7+`) most heavily.

**Atraxa NOT chosen** because all current Atraxa printings are 4-colour (`WUBG`) or 5-colour (`Voice of Phyrexia`). To get a clean 2-colour test, Niv-Mizzet, Parun was preferred.

**Fixture-creation procedure (Plan 1 Task 1):**
1. Researcher (or planner) runs a local script: fetch `https://json.edhrec.com/pages/commanders/{slug}.json`, walk `container.json_dict.cardlists`, extract `cardviews[].sanitized` to build a 99-card list (top-N inclusion, mirroring an actual recommended decklist).
2. For each card name, look up `src/db/cards` (pre-populated by bulk pipeline) to fetch the canonical Scryfall card object (`mana_cost`, `cmc`, `type_line`, etc.). Snapshot to `tests/fixtures/decks/{slug}.cards.json`.
3. Hand-derive `expected.json` by feeding the cards through `computeDeckAnalytics` ONCE with deliberate logging, verifying each value against an independent calculator (e.g. eyeballing the EDHREC-rendered colour pie on the commander page). Lock the result.
4. Test asserts `computeDeckAnalytics(fixture).manaCurve` integers MATCH; `colourPie` percentages match within 0.01 tolerance after dividing by total non-land coloured pips.

**Expected.json shape (per D-02 + tolerance from D-01):**

```json
{
  "commander_id": "9f5ee5cf-3b04-4ce0-8c4d-1d23c5b09b56",
  "commander_name": "Krenko, Mob Boss",
  "color_identity": ["R"],
  "total_cards": 100,
  "mana_curve": { "0": 1, "1": 12, "2": 18, "3": 16, "4": 11, "5": 7, "6": 4, "7+": 2 },
  "colour_distribution": { "W": 0.0, "U": 0.0, "B": 0.0, "R": 1.0, "G": 0.0, "C": 0.0 },
  "land_count": 36,
  "non_land_count": 63,
  "average_cmc": 2.84
}
```

> **Note for Plan 1:** `computeDeckAnalytics` returns `colourPie` as raw counts, NOT percentages. The fixture comparison either (a) computes percentages in the test, or (b) the planner extends `computeDeckAnalytics` to return both counts and percentages. Recommendation: compute percentages in the test (don't bloat the runtime contract).

### 2. DECK-03 Per-Category Dynamic RAG Thresholds (resolves D-03 / Discretion via decision)

Three-tier (RED / AMBER / GREEN) thresholds derived from EDHREC's published averages and Draftsim's data-backed analysis ([Draftsim — How much ramp](https://draftsim.com/how-much-ramp-in-a-commander-deck/), [EDHREC — Superior Numbers Land Counts](https://edhrec.com/articles/superior-numbers-land-counts), the Frank Karsten optimal-ramp piece on [Deckstats forum](https://deckstats.net/forum/index.php?topic=66832.0)). The "+N" suggestion is the gap to the GREEN threshold, not the AMBER threshold.

| Category | RED (severely under) | AMBER (under) | GREEN (≥) | "+N" calculation | Source |
|----------|----------------------|---------------|-----------|-------------------|--------|
| **Lands** | < 33 | 33–35 | ≥ 36 | `36 - count` | Burgess formula 31 + colours + commander CMC; EDHREC avg = 31 (anaemic per article); Draftsim baseline 37–38 |
| **Ramp** | < 6 | 6–9 | ≥ 10 | `10 - count` | Draftsim: low-curve ≥ 6, high-curve ≥ 10–12 |
| **Card Draw** | < 6 | 6–9 | ≥ 10 | `10 - count` | Frank Karsten / community baseline; EDHREC default in `gap-detection.js` was already 10 |
| **Removal** | < 6 | 6–7 | ≥ 8 | `8 - count` | EDHREC default = 8; community floor = 6 (4 single-target + 2 mass-removal) |
| **Board Wipe** | < 2 | 2 | ≥ 3 | `3 - count` | EDHREC default = 3; existing in `gap-detection.js` |
| **Creatures** | varies by archetype — see below | | | | |

**Creatures threshold is archetype-aware.** Derive from `deck.tags`:
- If deck.tags includes `Tribal` or `Creatures` or `Aggro` → GREEN ≥ 30, AMBER 20–29, RED < 20.
- If deck.tags includes `Spellslinger` or `Control` or `Combo` → GREEN ≥ 12, AMBER 8–11, RED < 8.
- Default (no tags) → GREEN ≥ 20, AMBER 12–19, RED < 12.

**Implementation note:** `src/utils/gap-detection.js` currently emits two-tier severity (`critical`/`warning`). Plan 1 extends `detectGaps()` to emit three tiers (`red`/`amber`/`green`) and adds a `suggestedAdd` field per gap. The `DEFAULT_THRESHOLDS` constant becomes `RAG_THRESHOLDS` with `{ green: N, amber: N }` per category.

```js
export const RAG_THRESHOLDS = {
  Ramp:        { green: 10, amber: 6 },
  'Card Draw': { green: 10, amber: 6 },
  Draw:        { green: 10, amber: 6 }, // alias for tag breakdown variation
  Removal:     { green: 8,  amber: 6 },
  'Board Wipe':{ green: 3,  amber: 2 },
  Lands:       { green: 36, amber: 33 },
};
```

The badge format per D-04 is `[RED|AMBER|GREEN] +N`. GREEN badges are NOT rendered (no warning needed). Only RED + AMBER show.

### 3. DECK-04 EDHREC Salt API Contract (resolves D-05)

**Endpoints verified by direct HTTP probe:**

| Endpoint | Returns | Salt path | CORS |
|----------|---------|-----------|------|
| `/pages/commanders/{slug}.json` | Commander page data | `container.json_dict.card.salt` (number, 0–~3) | Blocked in browser; works via Vite dev proxy `/api/edhrec` (vite.config.js:8-12) |
| `/pages/cards/{slug}.json` | Card page data | **NO `card.salt` at top level** — only `similar[].salt` for related cards | Same — proxied |
| `/pages/top/salt.json` | Top 100 saltiest cards | `container.json_dict.cardlists[0].cardviews[].label` (string `"Salt Score: 3.06\n15918 decks"`) → parse number | Same — proxied |

**Recommended strategy: Top-100 bulk fetch.**

A single GET to `/api/edhrec/pages/top/salt.json` returns the canonical name → salt map for the 100 saltiest cards. For deck cards NOT in the top 100, salt is effectively negligible (< ~0.4) and treated as 0 in the deck aggregate.

```js
// New function in src/services/edhrec.js (replaces broken getCardSalt)
export async function fetchTopSaltMap() {
  // Cache check first (7-day TTL via Dexie meta or salt_cache top-100 row)
  const cached = await db.meta.get('top_salt_map');
  if (cached && Date.now() - cached.fetched_at < 7 * 24 * 60 * 60 * 1000) {
    return cached.map;
  }
  const data = await rateLimitedFetch(`${EDHREC_BASE}/pages/top/salt.json`);
  const cardviews = data?.container?.json_dict?.cardlists?.[0]?.cardviews ?? [];
  const map = {};
  for (const cv of cardviews) {
    const m = (cv.label || '').match(/Salt Score:\s*([\d.]+)/);
    if (m) map[cv.name] = parseFloat(m[1]);
  }
  await db.meta.put({ key: 'top_salt_map', map, fetched_at: Date.now() });
  return map;
}
```

**Salt aggregate:** for each deck card, look up `map[card.name]` (default 0). Run through `aggregateDeckSalt()` (already correct). Result feeds `salt-gauge.js` unchanged.

**Rate limits:** EDHREC has no published rate limit. Existing `REQUEST_DELAY_MS = 200` (`src/services/edhrec.js:7`) is conservative — keep it.

**Production CORS:** Confirmed unresolved (STATE.md blocker). Phase 9 dev/test work is unaffected (Vite dev proxy handles it). Surface in 09-SUMMARY.md as a v1.1 carry-over.

### 4. GAME-04 Material Symbols Glyph Picks (resolves D-12 / Discretion #1)

Material Symbols Outlined ships as a single variable woff2 (`node_modules/material-symbols/material-symbols-outlined.woff2`). The CSS (`outlined.css`) is 24 lines — defines `font-feature-settings: "liga"`, meaning ANY valid icon name written as text content renders as the icon. There's no glyph manifest to consult; validation = "does the rendered cell look like an icon or a tofu box?".

| Counter | Glyph name | Rationale | Fallback if rendered as tofu |
|---------|-----------|-----------|------------------------------|
| Poison | `vaccines` | Clean lab vial, lighter visual weight than `science`'s atom-cluster, no morbidity (rejected `skull`). | `science` (atom — tested, renders fine in package version 0.44.0) |
| Tax | `paid` | Currency-pile glyph; tested, renders. Aligns with "tax" semantic ("paying" the commander tax). | `payments` (multi-card stack — also valid) |
| Commander damage | `shield_with_heart` | Commander = the leader / heart of the deck. Tested in Material Symbols Outlined v0.44.0. | `military_tech` (medal — backup if `shield_with_heart` doesn't render in the locally-installed font version) |

**Plan 2 verification step:** During Task implementation, render all three glyphs in the dev server, screenshot `tests/fixtures/screenshots/game-04-icons.png` for human-UAT review. If any glyph renders as a tofu box (□), fall back to the alternative listed.

**Icon size:** D-12 specifies 16px alongside the 11px count digit. Follow `font-size: 16px` on the `.material-symbols-outlined` span. Match life-button pattern (32×32 hit target with 16px icon inside).

### 5. GAME-07 Slot-Machine Spinner Timing Curve (resolves D-15 / Discretion #2)

Researcher recommendation: **2.4 second total**, decelerating with **`cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo)**. Names cycle vertically at 80ms/name early, decelerating to ~400ms/name in the final 600ms.

**Implementation sketch:**

```js
// src/components/first-player-spinner.js (NEW)
export function spinForFirstPlayer(playerNames) {
  const winnerIndex = Math.floor(Math.random() * playerNames.length);
  const cycles = 8 + winnerIndex; // ensure final stop = winnerIndex
  const totalMs = 2400;
  const startTime = performance.now();

  // Honour prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve(winnerIndex);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'cf-first-player-spinner';
    overlay.setAttribute('aria-live', 'polite');
    document.body.appendChild(overlay);

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      // ease-out-expo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const progress = eased * cycles;
      const visibleIndex = Math.floor(progress) % playerNames.length;
      overlay.textContent = playerNames[visibleIndex];

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Final settle pause
        overlay.textContent = playerNames[winnerIndex];
        setTimeout(() => {
          overlay.remove();
          resolve(winnerIndex);
        }, 600);
      }
    }
    requestAnimationFrame(frame);
  });
}
```

**CSS (lives in main.css under a Phase 9 marker):**

```css
.cf-first-player-spinner {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 12, 16, 0.92);
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--color-primary);
  text-transform: uppercase;
  z-index: 100;
  pointer-events: none;
}
```

Call site in `src/stores/game.js startGame()`:

```js
// After players array built, before view = 'active':
const winnerIndex = await spinForFirstPlayer(this.players.map(p => p.name));
this.players[winnerIndex].is_first = true;
this.activePlayerIndex = winnerIndex;
```

**Persistence (D-15):** the `is_first` boolean lives on `players[N]` (which is JSON-serialised onto the games row). NO schema bump needed — the games table accepts arbitrary JSON in the `players` field.

### 6. 3-Player Layout Active-Rotation Toggle (resolves D-10 / Discretion #4)

**Recommendation: PLAYER-1-ALWAYS-TOP, NOT auto-rotate.**

**Rationale:** Auto-rotation creates a continuously shifting visual that's especially disorienting in a pod-play context where players are tracking THEIR card by spatial position. The active-player highlight (D-16, primary-blue border-glow) handles the "whose turn is it?" affordance non-destructively.

The CONTEXT default was auto-rotate; researcher overrides to player-1-always-top with active-player highlight providing the focus signal. This was a discretion item explicitly delegated to the researcher.

**Layout CSS:**

```css
.cf-player-grid-3 {
  display: grid;
  grid-template-areas:
    "p1 p1"
    "p2 p3";
  grid-template-rows: 1fr 1fr;
  gap: 16px;
}
.cf-player-grid-3 > :nth-child(1) { grid-area: p1; }
.cf-player-grid-3 > :nth-child(2) { grid-area: p2; }
.cf-player-grid-3 > :nth-child(3) { grid-area: p3; }
```

In `src/components/player-card.js` `renderPlayerGrid()`, the existing `grid grid-cols-1 md:grid-cols-2 gap-[16px]` Tailwind classes get a 3-player override via Alpine class binding:

```html
<div :class="$store.game.players.length === 3 ? 'cf-player-grid-3' : 'grid grid-cols-1 md:grid-cols-2 gap-[16px]'"
     class="pb-[80px]" ...>
```

### 7. Salt Cache Schema Decision (resolves D-05 / Discretion #3 / specifics §4)

**Recommendation:** **No new table needed.** The Top-100 salt map is small (~100 entries, < 5KB) and fits as a single row in the existing `meta` table keyed `top_salt_map`. This is the minimal-change path.

```js
await db.meta.put({ key: 'top_salt_map', map: { ... }, fetched_at: Date.now() });
```

**Why no `salt_cache` table:** the original assumption was per-card individual fetches (which would benefit from a keyed table). The Top-100 bulk approach makes individual rows redundant. Phase 9 ships the meta-row pattern; future expansion (per-card salt for cards outside top 100) can add a `salt_cache` table via a Dexie v10 additive bump if needed.

**If planner disagrees and wants the salt_cache table anyway** (e.g. for sync semantics in Phase 11): use the additive Dexie pattern from Phase 8 D-09 (`schema.js:391-413`):
- Add `db.version(10).stores({ ... full v9 declaration mirrored ..., salt_cache: 'card_name, fetched_at' })`
- No `.upgrade()` callback (additive only)
- Mirror declaration in `src/workers/bulk-data.worker.js`
- EXCLUDE from `UUID_TABLES` array (PK is text card name, not UUID)
- Phase 8 precedent line: STATE.md `precons_cache PK is Scryfall set code (string) — deliberately EXCLUDED from UUID_TABLES creating-hook; callers MUST supply code`

**Researcher's recommendation stands at "use meta table"** — simpler, no schema bump, aligns with existing `edhrec_cache` and `combo_cache` philosophy (each maps to a single conceptual fetch).

## Codebase Patterns

### A. cf-panel-reopen border-glow treatment (mirrored by D-16 active-player highlight)

`src/styles/main.css:183-216` — the canonical "highlight-an-element-with-primary-blue-glow" utility from Phase 8.1. Active-player highlight (`cf-player-active`) uses the same `box-shadow: 0 0 12px var(--color-glow-blue)` + `border: 2px solid var(--color-primary)` recipe. Plan 2 ADDS the new class to main.css and the new selector to the existing `@media (prefers-reduced-motion: reduce)` block (lines 155-163), NOT a new block. Phase 8.1 precedent: STATE.md "Plan 3 + Plan 1 merged a single @media (prefers-reduced-motion: reduce) block".

### B. Scryfall rate-limited queue (referenced for any new EDHREC/Scryfall calls)

`src/services/scryfall-queue.js` ships the 100ms-spaced queue + Counterflux/1.1 User-Agent. EDHREC has its own 200ms-spaced fetch in `src/services/edhrec.js:33-46` (`rateLimitedFetch`). The Top-100 bulk fetch reuses this; no new queue needed.

### C. Additive Dexie pattern (Phase 8 D-09 / D-24)

`src/db/schema.js:391-413` — additive-only `.version(N)` bump, no `.upgrade()` callback, full prior version declaration mirrored. Worker mirror at `src/workers/bulk-data.worker.js`. ONLY APPLIES if planner overrides researcher's "use meta table" recommendation and adds `salt_cache`. Phase 9's primary path requires NO schema change.

### D. CustomEvent screen-decoupling pattern (Phase 8 Plan 2)

`src/components/deck-editor.js:35` dispatches `deck-back-to-landing` to decouple deck-editor from deck-landing. Phase 9 GAME-07 uses the same pattern — `first-player-spinner.js` dispatches `cf:first-player-selected` so `game.js` can react without tight coupling. STATE.md precedent: "Phase 08 Printing selection uses cf:printing-selected CustomEvent pattern".

### E. JSON.parse(JSON.stringify(state)) auto-save snapshot (D-19 turn_laps persistence)

`src/stores/game.js:30-42` `_debouncedAutoSave` shows the existing pattern. `turn_laps` write piggybacks on the same auto-save (already includes `players` snapshot; just add `turn_laps` + `activePlayerIndex` to the snapshot). STATE.md confirms `frequent writes acceptable; games table is small`.

### F. Alpine `effect()` + `requestAnimationFrame` batching (chart re-renders)

`src/components/deck-analytics-panel.js:638-657` — touch reactive properties to track deps, batch updates via RAF. Plan 1 reuses for the new salt rewire (saltScore changes when activeCards mutate).

### G. Test setup pattern for game-tracker

`tests/setup.js:8-15` ships MutationObserver + CustomEvent stubs (Phase 8 lineage). Plan 3 needs to add for D-15 / D-18:

```js
// Append to tests/setup.js
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
```

`vi.useFakeTimers()` is invoked per-test where wall-clock control is needed (turn-lap simulation, spinner timing).

### H. Material Symbols rendering convention

Look at any `.material-symbols-outlined` span in the codebase (e.g. `src/components/player-card.js:52`): inline `style="font-size: NN px;"` + raw text content (`>add</span>`, `>warning</span>`). No special escape; the `liga` font feature converts the text ligature to glyph at render time. Plan 2 follows verbatim for `vaccines`, `paid`, `shield_with_heart`.

## Pitfalls Identified

### P-1: setInterval-based timer corrupts when tab backgrounds (GAME-10)

`src/stores/game.js:232-234` — `setInterval(() => { this.timerSeconds++; }, 1000)`. Chrome throttles `setInterval` to 1Hz max in background tabs (per spec since 2022; aggressive throttling after 5 minutes). A 30-minute backgrounded turn would record as ~1-5 minutes elapsed.

**Prevention:** wall-clock anchor pattern. `turnStartedAt = Date.now()` at NEXT TURN; lap = `Date.now() - turnStartedAt`. RAF tick is purely for display smoothness, not duration.

**Test:** `vi.useFakeTimers(); vi.setSystemTime(t0); store.startTurn(); vi.setSystemTime(t0 + 30 * 60 * 1000); store.nextTurn(); expect(store.turn_laps[0]).toBe(30 * 60 * 1000);`

### P-2: Fullscreen API requires user-gesture context (GAME-05)

`Element.requestFullscreen()` MUST be called from a synchronous event handler chain initiated by user input. Calling it from a `setTimeout`, a Promise resolution, or an Alpine `$watch` will throw `TypeError: Permissions check failed`.

**Prevention:** wire the fullscreen toggle button's `@click` to a function that synchronously calls `document.documentElement.requestFullscreen()`. Do NOT mutate Alpine state first and react to it — the gesture will be lost.

```js
// src/components/floating-toolbar.js (replace gameFullscreen toggle):
@click="
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
"
```

Subscribe to `fullscreenchange` event to update the icon (`fullscreen` ↔ `fullscreen_exit`).

### P-3: Alpine init shim missing in router.test.js > vandalblast (Phase 8 carry-over)

`src/screens/vandalblast.js:17` calls `Alpine.data('postGameOverlay', postGameOverlay)` synchronously at mount. The router test mounts the screen WITHOUT first importing & starting Alpine (unlike the dashboard test which does at line 90). Throws `TypeError: Cannot read properties of undefined (reading 'data')`.

**Prevention (Plan 2):** Two viable fixes:
1. **Defensive guard:** `if (Alpine?.data) Alpine.data('postGameOverlay', postGameOverlay);` — minimal-change, preserves test invariant that mount() is callable without full Alpine boot.
2. **Test fix:** Update `tests/router.test.js > vandalblast` to import & start Alpine before mounting (matches the dashboard test pattern).

Recommendation: **defensive guard.** The screen module shouldn't crash if Alpine isn't available; that's a healthier contract.

### P-4: requestFullscreen + Tailwind transitions create visual flicker

When `:fullscreen` activates, the body's existing `transition-all duration-200` (sidebar resize transition, `index.html:115`) animates layout shifts as if entering fullscreen were a sidebar collapse. Visible flash of half-rendered chrome.

**Prevention:** Add `:fullscreen` selector that disables transitions on body chrome:

```css
:fullscreen aside,
:fullscreen header { display: none !important; }
:fullscreen main { margin: 0 !important; padding: 0 !important; }
```

### P-5: Schema-rename trap doesn't apply (no schema change in Phase 9)

The Phase 9 plan does NOT bump Dexie. `is_first` and `activePlayerIndex` ride on the existing `players[]` JSON blob and on a transient store property. `turn_laps` already on schema. CONTEXT D-17 confirms.

If the planner instead chooses the `salt_cache` table path, see PITFALLS §1 in `.planning/research/PITFALLS.md` (Dexie cannot rename a table within one version) — but the additive bump path doesn't trigger this.

### P-6: prefers-reduced-motion must be honoured by spinner AND active-player highlight

The CSS @media block in `main.css:155-163` already lists `.tc-panel-column, .tc-grid-column, .cf-panel-reopen, .card-quick-actions-checkbox`. Plan 2 EXTENDS the selector list (NOT a new block) to include `.cf-player-active` and `.cf-first-player-spinner`. JS-side, the spinner function checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and resolves immediately if true.

### P-7: `aria-live="polite"` interrupts other announcements

The spinner `aria-live="polite"` will announce every cycled name (potentially 20+ in 2.4s). Screen readers will queue them. Recommended: `aria-live="off"` during animation, then a separate `aria-live="polite"` element gets injected with ONLY the final name once the spin completes.

### P-8: Alpine `x-text` on stale DOM during expansion (GAME-06 in-card counters)

When expanding a player card, the existing counter rendering at `src/components/player-card.js:343-370` uses `x-for="(val, name) in (player.counters || {})"`. Adding +/- buttons mutates `player.counters[name]` — Alpine reactivity should fire. BUT: the click handler is INSIDE `@click.stop` on a parent `<div @click.stop>` (line 308), which suppresses propagation back to the card-collapse handler. Confirm during impl that the `@click.stop` chain doesn't accidentally suppress the new button click (or scope the stop to the buttons themselves).

### P-9: `commander_id` field may not exist on Phase 7 v8 decks table

Schema v8 `decks: 'id, name, format, user_id, updated_at, synced_at'` (line 312) lists those as INDEXED fields; Dexie also accepts arbitrary other fields on the row. CONTEXT D-07 says "Use `commander_id` from the deck record (Phase 7 schema field)" — this needs verification during Plan 1 Task 0. If Phase 7 didn't backfill `commander_id`, Plan 1 derives commander from the deck's first card with `type_line.includes('Legendary Creature')` AND matching colour identity to the deck's other cards.

### P-10: Chart.js global state across remounts

`src/components/deck-analytics-panel.js:86-88` keeps `manaCurveChart` and `colourPieChart` as MODULE-LEVEL singletons. Multiple deck-editor mounts in tests can leak charts. Plan 1 fixture tests should mock chart.js or reset the module between tests (`vi.resetModules()` in `beforeEach`). Existing `destroyDeckCharts()` covers normal lifecycle.

## Runtime State Inventory

(Phase 9 is a feature/polish phase, not a rename. Inventory is short but not skipped.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no field renames. `is_first`, `turn_laps` are additive on existing JSON blob (`players` array) and existing column (`turn_laps`). | None |
| Live service config | EDHREC API endpoint paths change (Plan 1 switches from `/cards/{slug}.json` to `/top/salt.json` for individual salt lookups). Vite dev proxy already routes `/api/edhrec/*` → EDHREC. | None — proxy config unchanged |
| OS-registered state | None | None |
| Secrets / env vars | None | None |
| Build artifacts | None | None |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vite dev server proxy | EDHREC API calls during dev/test | ✓ | configured in vite.config.js:8-12 | Production: TBD (STATE.md blocker) — out of scope |
| `material-symbols` npm | GAME-04 counter icons | ✓ | 0.44.0 (verified `npm view material-symbols version` shows 0.44.0 in package.json:25) | None — already shipped |
| `fake-indexeddb` | Dexie tests | ✓ | 6.2.5 (devDep) | None |
| `vitest` | All tests | ✓ | 4.1.2 (devDep) | None |
| `jsdom` | DOM tests | ✓ | 29.0.1 (devDep) | None |
| Material Symbols specific glyphs (`vaccines`, `paid`, `shield_with_heart`) | GAME-04 | ✓ — variable font ships full Outlined catalog | font v326 (per gstatic source URL) | Per-glyph fallback table in §4 above |

**Missing dependencies:** None. All Phase 9 work runs with the existing `npm install`.

## Validation Architecture

> Nyquist Dimension 8 — copy this section into VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.js` (existing, root) — uses `tests/setup.js` for global stubs |
| Quick run command | `npx vitest run tests/{file}.test.js -x` (single file, fast-fail) |
| Full suite command | `npm test` |
| Phase gate | Full suite green before `/gsd:verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECK-01 | Back button dispatches `deck-back-to-landing` event | unit | `npx vitest run tests/deck-editor.test.js -x` | ❌ Wave 0 |
| DECK-02 | Krenko fixture mana_curve matches expected exactly | unit | `npx vitest run tests/deck-analytics-fixtures.test.js -x` | ❌ Wave 0 |
| DECK-02 | Niv-Mizzet fixture colour_distribution within 0.01 tolerance | unit | (same file as above) | ❌ Wave 0 |
| DECK-02 | Ur-Dragon fixture all 6 colour buckets non-zero | unit | (same file as above) | ❌ Wave 0 |
| DECK-03 | `detectGaps` returns three-tier severity (`red`/`amber`/`green`) | unit | `npx vitest run tests/gap-detection.test.js -x` | ✅ extend existing |
| DECK-03 | Badge format `[RED] +5` rendered, no category name duplication | integration (jsdom) | `npx vitest run tests/deck-analytics-panel.test.js -x` | ❌ Wave 0 |
| DECK-04 | `fetchTopSaltMap` parses `cardlists[0].cardviews[].label` correctly | unit | `npx vitest run tests/edhrec-service.test.js -x` | ✅ extend existing |
| DECK-04 | Salt-aggregate non-zero for deck containing Stasis (top-1 salt) | unit | (same file as above) | ✅ extend existing |
| DECK-04 | Salt cache hit avoids second fetch within 7d TTL | unit | (same file as above) | ✅ extend existing |
| DECK-05 | Commander section rendered ABOVE Creature section | integration (jsdom) | `npx vitest run tests/deck-centre-panel.test.js -x` | ❌ Wave 0 |
| GAME-01 | Player name "Alexander the Great Lifelinker" doesn't overflow | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 |
| GAME-02 | 3-player layout uses `.cf-player-grid-3` class | integration (jsdom) | (same file) | ❌ Wave 0 |
| GAME-03 | Life > 20 → green; ≤ 20 → amber; ≤ 10 → red dynamic class | integration (jsdom) | (same file) | ❌ Wave 0 |
| GAME-04 | Poison icon span text content === `vaccines` | integration (jsdom) | (same file) | ❌ Wave 0 |
| GAME-05 | Toggle calls `requestFullscreen` synchronously from click handler | integration (jsdom) | `npx vitest run tests/floating-toolbar.test.js -x` | ❌ Wave 0 |
| GAME-05 | Game state survives fullscreenchange event (no re-mount) | integration (jsdom) | (same file) | ❌ Wave 0 |
| GAME-06 | In-card +/- on counter calls `adjustCounter(playerIdx, name, ±1)` | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 |
| GAME-07 | Spinner returns winnerIndex; reduced-motion skips animation | unit | `npx vitest run tests/first-player-spinner.test.js -x` | ❌ Wave 0 |
| GAME-07 | `is_first: true` set on the chosen player; persists in saveGame | unit | `npx vitest run tests/game-store.test.js -x` (extend) | ✅ extend existing |
| GAME-08 | `activePlayerIndex` advances on `nextTurn()`; CSS class `cf-player-active` applied | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 |
| GAME-09 | `nextTurn()` pushes `Date.now() - turnStartedAt` onto `turn_laps` | unit | `npx vitest run tests/game-store.test.js -x` (extend) | ✅ extend existing |
| GAME-09 | `saveGame()` persists `turn_laps` via `db.games.add` | unit | (same file) | ✅ extend existing |
| GAME-09 | Post-game overlay renders `LONGEST TURN`, `AVG TURN`, `PER-PLAYER AVG` from `turn_laps` | integration (jsdom) | `npx vitest run tests/post-game-overlay.test.js -x` | ❌ Wave 0 |
| GAME-10 | Lap correct after `vi.setSystemTime` jumps 30min mid-turn | unit | `npx vitest run tests/game-store.test.js -x` (extend with fake timers) | ✅ extend existing |
| Pre-existing | router.test.js > vandalblast no longer fails | regression | `npx vitest run tests/router.test.js -x` | ✅ existing — fix in Plan 2 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/{touched-file}.test.js -x` (Nyquist quick-run, sub-30s)
- **Per wave merge:** `npm test` (full suite, ~2min based on Phase 8.1 history)
- **Phase gate:** Full suite green + manual UAT walkthrough of all 15 requirements before `/gsd:verify-work`

### Wave 0 Gaps

New test files Plan 1, 2, 3 must create:

- [ ] `tests/deck-analytics-fixtures.test.js` — DECK-02 fixture-driven validation
- [ ] `tests/fixtures/decks/krenko-mob-boss.cards.json` — 99-card Krenko EDHREC top deck snapshot
- [ ] `tests/fixtures/decks/krenko-mob-boss.expected.json` — hand-derived expected analytics
- [ ] `tests/fixtures/decks/niv-mizzet-parun.cards.json`
- [ ] `tests/fixtures/decks/niv-mizzet-parun.expected.json`
- [ ] `tests/fixtures/decks/the-ur-dragon.cards.json`
- [ ] `tests/fixtures/decks/the-ur-dragon.expected.json`
- [ ] `tests/deck-editor.test.js` — DECK-01 back button + Plan 1 deck-editor regressions
- [ ] `tests/deck-analytics-panel.test.js` — DECK-03 RAG badge UI rendering
- [ ] `tests/deck-centre-panel.test.js` — DECK-05 Commander section placement
- [ ] `tests/player-card.test.js` — GAME-01..04, GAME-06, GAME-08
- [ ] `tests/floating-toolbar.test.js` — GAME-05 fullscreen wiring
- [ ] `tests/first-player-spinner.test.js` — GAME-07 standalone unit test
- [ ] `tests/post-game-overlay.test.js` — GAME-09 stats section

Existing infrastructure to extend:

- [ ] `tests/setup.js` — append `requestAnimationFrame`, `cancelAnimationFrame`, `matchMedia` stubs (Plan 3)
- [ ] `tests/edhrec-service.test.js` — extend with `fetchTopSaltMap` test cases (Plan 1)
- [ ] `tests/gap-detection.test.js` — extend for three-tier RAG (Plan 1)
- [ ] `tests/game-store.test.js` — extend for `nextTurn` lap push, `saveGame` lap persistence, fullscreen state, `is_first` (Plan 3)

Framework install: none needed — vitest + jsdom + fake-indexeddb already in devDependencies.

### Mocking Strategy

- **EDHREC API:** mock `fetch` via `vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => fixtureJson })` in `tests/edhrec-service.test.js`. Fixture JSON: `tests/fixtures/edhrec-top-salt.json` (real captured response).
- **Date / time:** `vi.useFakeTimers()` + `vi.setSystemTime(...)` for GAME-09 / GAME-10 tests. Reset in `afterEach(() => vi.useRealTimers())`.
- **requestAnimationFrame:** `tests/setup.js` shim falls through to `setTimeout(cb, 16)`. For deterministic frame counting in spinner tests, override per-test: `vi.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => { cb(performance.now()); return 1; })`.
- **Fullscreen API:** stub `document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)` and `document.exitFullscreen = vi.fn().mockResolvedValue(undefined)`. Listen for `fullscreenchange` via `dispatchEvent(new Event('fullscreenchange'))`.
- **Alpine:** existing pattern from STATE.md ("vi.mock('alpinejs') over vi.spyOn — Alpine module init runs at import"). Phase 8 `add-card-panel.state.test.js` is a working reference.
- **Chart.js:** mock at module level: `vi.mock('chart.js', () => ({ Chart: vi.fn(() => ({ destroy: vi.fn(), update: vi.fn() })), DoughnutController: {}, ... }))`.

### Regression Watch

These existing tests MUST stay green throughout Phase 9:

- `tests/deck-analytics.test.js` (existing — math primitives unchanged)
- `tests/salt-score.test.js` (existing — `normalizeSalt` / `aggregateDeckSalt` unchanged)
- `tests/edhrec-service.test.js` (existing — extend, not break)
- `tests/gap-detection.test.js` (existing — extend RAG tier; old two-tier API stays as a back-compat alias if needed)
- `tests/game-store.test.js` (existing — extend with new fields/methods)
- `tests/router.test.js > vandalblast` (currently FAILING — Plan 2 must FIX, not regress further)
- `tests/migration-v5-to-v7.test.js` (Phase 7 hard gate — must remain green; Phase 9 doesn't touch schema)

## Plan-Shape Recommendation

**CONFIRM the 3-plan structure from CONTEXT.md D-00.** Plan boundaries map cleanly to file ownership with minimal cross-plan coupling.

| Plan | Scope | Files Owned (write) | Files Touched (read) | Approx Tasks |
|------|-------|---------------------|----------------------|--------------|
| **Plan 1** — Deck accuracy + analytics polish | DECK-01..05 | `src/services/edhrec.js` (rewrite getCardSalt → fetchTopSaltMap), `src/stores/intelligence.js` (salt aggregate path), `src/utils/gap-detection.js` (three-tier RAG), `src/components/deck-analytics-panel.js` (gap badge UI lines 600-629 + salt-related sections), `src/components/deck-centre-panel.js` (Commander section, line ~157), new tests + fixtures | `src/components/salt-gauge.js` (visual unchanged), `src/components/deck-editor.js:34-37` (back button QA), `src/db/schema.js` (verify `commander_id` field), `src/utils/deck-analytics.js` (no change — fixture validates this code) | 4-5 |
| **Plan 2** — Vandalblast layout + visuals | GAME-01..06 + router.test.js fix | `src/components/player-card.js` (clipping fix, RAG life colours, counter icons, in-card +/- block, 3-player layout class binding, active-player border in shipped-here CSS), `src/components/floating-toolbar.js` (real fullscreen API), `src/screens/vandalblast.js` (defensive Alpine?.data guard), `src/styles/main.css` (additions: `.cf-player-grid-3`, `:fullscreen` rules, `.cf-player-active` partially shared with Plan 3) | `src/components/counter-panel.js` (reuse mutation logic), `src/components/commander-damage-tracker.js` (no change), `tests/setup.js` | 5-6 |
| **Plan 3** — Vandalblast turn mechanics + post-game stats | GAME-07..10 | `src/components/first-player-spinner.js` (NEW), `src/stores/game.js` (nextTurn lap push, wall-clock timer, activePlayerIndex, is_first persist, spinner integration), `src/components/post-game-overlay.js` (Turn Pacing section), `src/styles/main.css` (additions: `.cf-first-player-spinner`, completion of `.cf-player-active` if Plan 2 didn't ship it), `tests/setup.js` (RAF + matchMedia stubs) | `src/components/turn-timer.js` (display contract — only the data source changes), `src/components/floating-toolbar.js` (NEXT TURN button calls game.nextTurn — no signature change) | 5-6 |

### Cross-Plan File Conflicts

**HIGH-PRIORITY COORDINATION:**

1. **`src/styles/main.css`** — Both Plan 2 and Plan 3 add CSS. Same risk as Phase 8.1 STATE.md note ("Plan 3 + Plan 1 merged a single @media (prefers-reduced-motion: reduce) block in main.css"). Resolution: **Plan 2 owns the `@media (prefers-reduced-motion: reduce)` block edit** (extends selector list to include `.cf-player-active` AND `.cf-first-player-spinner`); Plan 3 ships `.cf-first-player-spinner` body-rule but does NOT touch the @media block. If Plan 3 ships before Plan 2, swap ownership and Plan 2 just adds `.cf-player-active` to the existing list.

2. **`src/styles/main.css` → `.cf-player-active` class** — Used by Plan 2 (player-card border styling) but functionally driven by Plan 3 (`activePlayerIndex` state). **Plan 2 ships the CSS class** (it's a visual concern); **Plan 3 wires the data binding** that toggles `:class="{ 'cf-player-active': $store.game.activePlayerIndex === pIdx }"`. The class works as a no-op until Plan 3 ships the state. Order: Plan 2 first.

3. **`src/components/player-card.js`** — Plan 2 owns it for layout/icons/in-card counters. Plan 3 only ADDS the active-player class binding (one-line `:class` extension). Plan 3 must rebase if Plan 2 reshapes `renderPlayerGrid()`.

4. **`src/components/floating-toolbar.js`** — Plan 2 owns the fullscreen-button rewrite. Plan 3 doesn't touch it (NEXT TURN button signature unchanged).

5. **`src/stores/game.js`** — Plan 3 owns ALL changes (lap mechanics, timer, spinner integration, is_first). Plan 2 doesn't touch.

6. **`tests/setup.js`** — Plan 3 ships RAF + matchMedia + cancelAnimationFrame stubs. If Plan 2 needs `matchMedia` for fullscreen tests, both plans must agree on the same stub shape (recommendation: Plan 3 ships stubs in its first task; Plan 2 references them).

### Recommended Execution Order

`Plan 1 → Plan 2 → Plan 3` (default sequential).

Rationale:
- Plan 1 is fully isolated (deck-editor surfaces only).
- Plan 2 ships visual fixes + the router-test repair, unblocking confidence in the test suite for Plan 3.
- Plan 3 reuses Plan 2's `.cf-player-active` CSS class and `tests/setup.js` baseline.

If `parallelization: true` (per `.planning/config.json`), Plan 1 can run in parallel with Plans 2+3 — they share zero source files. Plans 2 and 3 share two files (`main.css`, `player-card.js`) and should NOT be parallelised against each other.

## Sources

### Primary (HIGH confidence)
- `09-CONTEXT.md` — 19 locked decisions
- `src/services/edhrec.js` — confirmed broken `getCardSalt` path via direct read (line 117-118)
- `src/stores/game.js` — confirmed `nextTurn()` doesn't write `turn_laps` (line 217-225); confirmed `setInterval` timer (line 232)
- `src/db/schema.js` — schema chain v1..v9, `games_next` includes turn_laps backfill (line 198)
- `src/styles/main.css:155-163` — confirmed @media (prefers-reduced-motion) block exists for Phase 8.1 coordination
- `tests/router.test.js:119-127` — confirmed pre-existing `vandalblast` test setup (no Alpine.start before mount)
- HTTP probe of `https://json.edhrec.com/pages/cards/sol-ring.json` — confirmed NO `card.salt` at expected path
- HTTP probe of `https://json.edhrec.com/pages/commanders/krenko-mob-boss.json` — confirmed `container.json_dict.card.salt = 1.1744...`
- HTTP probe of `https://json.edhrec.com/pages/top/salt.json` — confirmed `cardlists[0].cardviews[].label` shape `"Salt Score: N\nM decks"`
- `node_modules/material-symbols/outlined.css` + `material-symbols-outlined.woff2` — confirmed full Outlined catalog ships (variable font + liga feature)
- `vite.config.js:8-12` — confirmed EDHREC dev proxy

### Secondary (MEDIUM confidence)
- [Draftsim — How much ramp in a Commander deck](https://draftsim.com/how-much-ramp-in-a-commander-deck/) — ramp threshold derivation
- [EDHREC — Superior Numbers: Land Counts](https://edhrec.com/articles/superior-numbers-land-counts) — land threshold + EDHREC database average (29 lands)
- [Frank Karsten on Deckstats forum](https://deckstats.net/forum/index.php?topic=66832.0) — Burgess formula provenance
- [EDHREC — Salt 2025 Scores Are Here](https://edhrec.com/articles/salt-2025-scores-are-here) — salt update cadence (annual, "2025" current)
- [EDHREC — Top 100 Saltiest](https://edhrec.com/top/salt) — confirmed scale extends past 3.0 (Stasis = 3.06)
- [GitHub — Material Design Icons](https://github.com/google/material-design-icons) — Material Symbols catalog source

### Tertiary (LOW confidence — flagged for runtime validation)
- Material Symbols glyph specifics (`vaccines` / `paid` / `shield_with_heart`) render correctly at 16px in npm v0.44.0 — needs visual confirmation in dev server during Plan 2 Task implementation
- Auto-rotate vs player-1-fixed in 3-player layout — researcher recommendation is opinionated; could be revisited during human UAT if play-feel disagrees

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — codebase well-documented in CLAUDE.md + STATE.md
- Architecture: HIGH — patterns from Phase 7-8.1 well-established
- Pitfalls: HIGH for P-1, P-2, P-3 (verified in source); MEDIUM for P-9 (Phase 7 schema field needs runtime verification)
- DECK-02 fixtures: MEDIUM — exact card lists need EDHREC fetch + hand-calc by Plan 1; method is verified
- DECK-03 thresholds: MEDIUM — community-derived, not peer-reviewed
- DECK-04 root-cause + fix: HIGH — verified by direct HTTP probe of three endpoint variants
- GAME-04 glyph picks: MEDIUM-HIGH — package ships full catalog; specific glyph names need visual confirmation
- GAME-07 spinner spec: HIGH — implementation sketch verified against existing RAF patterns

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — EDHREC API contract stable, Material Symbols package version pinned, Phase 7-8.1 codebase frozen by previous merges)
