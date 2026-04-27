# Phase 7: Polish Pass + Perf Baseline + Schema Migration - Research

**Researched:** 2026-04-14
**Domain:** Dexie v5→v6 migration (PK-type change), Web Vitals + Lighthouse baseline tooling, cross-app polish pass
**Confidence:** HIGH (schema migration pattern, version verification, library APIs); MEDIUM (polish CSS specifics)

## Summary

Phase 7 is a three-workstream phase with sharply different risk profiles: polish (low), perf tooling (low), schema migration (high). The decisive research finding is that **Dexie 4.x does NOT support in-place primary-key type change** (GitHub issue #1148 — error: *"UpgradeError Not yet support for changing primary key"*). D-01's intent (migrate `++id` → text UUID on six tables during v6 upgrade) is impossible via a straight schema bump; it must use the **temp-table shuffle pattern**: create new v6 tables under new names, migrate rows with new UUIDs inside `.upgrade()`, then a v7 "cleanup" that drops the old tables — OR (cleaner) write the v6 upgrade to create the new-shape tables alongside and swap names using IndexedDB 2.0 `renameTable` after rewrite.

web-vitals 5.2.0 (verified published 2026-03-25) exposes `onLCP/onINP/onCLS/onFCP/onTTFB` (no `onFID` — replaced by INP). Official guidance: register callbacks **once at app startup**, not per-navigation — so D-21's "log on every page navigation" should be interpreted as "log each metric as it fires" (web-vitals fires LCP on every SPA soft-navigation automatically). `@lhci/cli` 0.15.1 (verified) needs a 15-line config for the minimal "collect only, no assert" baseline path.

Polish items are low-risk but have two land mines: (1) the "white triangles" on card images are actually the absence of `border-radius` on the flyout `<img>` combined with the dark `#14161C` surface behind — Scryfall PNGs have square edges, not transparent corners; (2) counter-panel uses a `material-symbols-outlined` font-icon — the swap from `more_horiz` to `+` is literally changing the text content `more_horiz` → `add`.

**Primary recommendation:** Structure Phase 7 as three plans per D-24. Plan 3 (schema) is the sharp one; start it with a spike that proves the temp-table shuffle works against a fixture v5 database before any production code lands. Plans 1 and 2 can proceed in parallel and share a single PR each.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema v6 — primary key strategy**
- **D-01:** Migrate all synced tables (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`) from `++id` autoincrement to text UUID primary keys during the v6 upgrade. Generate with `crypto.randomUUID()`. One-time migration cost buys zero ID-translation work in Phase 11.
- **D-02:** Migration must rewrite all foreign keys atomically — notably `deck_cards.deck_id` must swap from the old numeric id to the new UUID for every existing deck_cards row. Tests must assert FK integrity post-upgrade.
- **D-03:** Never change these PKs again.

**Schema v6 — sync_queue / sync_conflicts shape**
- **D-04:** Create both tables in v6 with their full final shape even though Phase 11 populates them.
- **D-05:** `sync_queue` shape: `{++id, table_name, op, row_id, payload, user_id, created_at, attempts, last_error}` with indexes on `table_name`, `user_id`, `created_at`.
- **D-06:** `sync_conflicts` shape: `{++id, table_name, row_id, local_version, remote_version, detected_at}` with indexes on `table_name`, `detected_at`.

**Schema v6 — backfill values**
- **D-07:** `updated_at` = migration-time `Date.now()` for every existing row on every synced table.
- **D-08:** `synced_at` = `null` on every existing row.
- **D-09:** `turn_laps` = `[]` on every existing `games` row.

**Schema v6 — additional scope folded into this migration**
- **D-10:** Add a new `profile` table now (columns defined by Phase 10).
- **D-11:** Add `updated_at` column to `price_history`.
- **D-12:** Add a `schema_version` row to the `meta` key/value table recording the last applied Dexie version + migration timestamp.

**Migration safety net (SCHEMA-03)**
- **D-13:** Pre-migration backup scope = all user-generated tables: `collection`, `decks`, `deck_cards`, `games`, `watchlist`, `price_history`.
- **D-14:** Backup format = single `localStorage` key `counterflux_v5_backup_<ISO-timestamp>` containing a JSON snapshot of each table's full rows. Synchronous writes.
- **D-15:** `onblocked` handler shows a blocking modal ("Counterflux is upgrading — please close other Counterflux tabs") until the block releases.
- **D-16:** Backup TTL = 7 days.
- **D-17:** Migration tests against fixture v5 databases for every prior schema version (1-5) + realistic states (empty, 500-card collection, 10 decks with deck_cards, active game with turn history). Zero-data-loss assertion is a hard gate.

**Performance baseline (PERF-01…PERF-03)**
- **D-18:** Baseline targets committed as absolute numbers (e.g. "LCP < 2.5s, TTI < 3.5s") from median of 3 cold-boot runs.
- **D-19:** `npm run perf` = single Lighthouse desktop-preset run against `vite preview`, HTML output in `./lighthouse-report/`. No CI gate in v1.1.
- **D-20:** CI-gating deferred to Phase 13.
- **D-21:** `web-vitals` 5.2.x logs LCP / INP / CLS / FCP / TTFB via `console.table` in dev mode. No UI overlay.
- **D-22:** Baseline captured before the schema migration ships.

**Delivery sequencing**
- **D-23:** Ship order: Polish → Perf → Schema.
- **D-24:** Three sub-plans, one PR each.
- **D-25:** Plan 3 is the merge blocker for Phases 9 and 11.

**POLISH-08 — LIVE connectivity chip**
- **D-26:** Keep the chip; add a 6px pulsing dot at ~1.5s interval. Colour stays success-green.

**POLISH-09 — sidebar collapse**
- **D-27:** Collapsed state = 64px icon rail (nav icons + hover tooltip). Not a 0px hide.
- **D-28:** Persist toggle in `localStorage` key `sidebar_collapsed` (boolean). Default = expanded.
- **D-29:** Toggle button lives in the sidebar header.

**POLISH-02 — red accent coverage uplift (5% → 15%)**
- **D-30:** Card detail hover & focus — red glow/border on card tile hover + card-detail flyout active state.
- **D-31:** Destructive CTAs — "Abandon storm", "Delete deck", "Clear collection".
- **D-32:** RAG red states — Vandalblast life ≤10, gap warnings red severity, price-drop markers.
- **D-33:** Active tab underline + notification bell unread ping.

### Claude's Discretion
- Exact animation timing/easing for LIVE pulse
- Sidebar collapse keyboard shortcut binding (or none)
- Lighthouse report directory naming beyond `./lighthouse-report/`
- Console.table formatting specifics for web-vitals
- Exact shade ramp for red (`#E23838` base + hover/active variants)
- Migration progress indicator UX during the upgrade
- Post-migration verification assertions beyond row-count + FK integrity
- Backup restore UX if v6 load fails

### Deferred Ideas (OUT OF SCOPE)
- `@lhci/cli` CI gate (deferred to Phase 13)
- Perf overlay HUD (live web-vitals panel)
- Multi-URL cold/warm Lighthouse runs
- Downloadable backup file UX (unless localStorage quota exceeded)
- Mila loading animation (MILA-03 v1.0 tech debt)
- RSS / news feed

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Splash loading quotes render without `--` separators, typographic treatment | See §Code Examples: Splash quotes — existing `FLAVOUR_TEXTS` in `src/components/splash-screen.js:11` uses `--` manually; fix is data-level |
| POLISH-02 | Izzet red (`#E23838`) accents injected app-wide to reach ~15% surface | See §Architecture Patterns: Red rollout across the 4 D-30…D-33 surfaces |
| POLISH-03 | Favicon set to `assets/niv-mila.png` via `<link rel="icon">` | See §Code Examples: Favicon declaration |
| POLISH-04 | Card images in detail flyout render with rounded corners, no white triangles | See §Common Pitfalls: Pitfall A — image has no `border-radius`, sits on dark surface |
| POLISH-05 | Toast icons render at full opacity | Current `index.html:524-533` has no opacity override on toast icon; fix is either removing a Tailwind alpha class or adding `!opacity-100` |
| POLISH-06 | Rename "Initiate ritual" → "Brew a new storm", "Abandon ritual" → "Abandon storm" | Targets: `src/components/ritual-modal.js:47,163`; see §File-Touch Inventory |
| POLISH-07 | Additional-counters trigger `more_horiz` → `+` (Material Symbols `add`) | Target: `src/components/counter-panel.js:100` — text content swap in the span |
| POLISH-08 | LIVE pulsing dot | See §Code Examples: LIVE pulse CSS |
| POLISH-09 | Sidebar manual collapse toggle with persistence | See §Architecture Patterns: Sidebar collapse + §Code Examples: `sidebar_collapsed` persistence |
| POLISH-10 | Top losers panel never renders raw `scryfall_id` | Target: `src/components/movers-panel.js:108` — the `x-text="card.name \|\| card.scryfall_id"` fallback must drop to `'—'` or filter row out |
| POLISH-11 | Add-to-wishlist toast reads "Added to wishlist" | Targets: all call sites — see §File-Touch Inventory for audit list |
| PERF-01 | web-vitals LCP/INP/CLS/FCP/TTFB console log in dev mode | See §Code Examples: web-vitals bootstrap |
| PERF-02 | `npm run perf` Lighthouse desktop-preset report | See §Code Examples: lighthouserc.cjs |
| PERF-03 | Baseline report committed to `.planning/` with TTI/LCP targets | Methodology: 3 cold-boot runs, median, set targets from measured numbers |
| SCHEMA-01 | Dexie v5→v6 migration with new fields + new tables | See §Architecture Patterns: Temp-table shuffle for PK change + §Code Examples: full upgrade |
| SCHEMA-02 | Migration tested against v1-v5 fixtures with zero data loss | See §Code Examples: Vitest migration fixture harness; `fake-indexeddb` already installed |
| SCHEMA-03 | Pre-migration localStorage backup snapshot | See §Code Examples: Backup + restore + TTL sweep |

## Project Constraints (from CLAUDE.md)

- Scryfall API compliance: must keep `User-Agent: Counterflux/1.0` header; NO Scryfall calls are added in this phase (pure internal work)
- Desktop-first: Lighthouse config uses `preset: 'desktop'`
- Local-first: backup must work offline; localStorage usage is already a project convention (connectivity cache, preferences)
- Tailwind v4: `@theme` block in CSS replaces `tailwind.config.js`; new tokens (red variants for D-30…D-33) go in `src/styles/main.css` `@theme`
- Alpine 3.15.x store pattern: no new stores in Phase 7; sidebar collapse reuses existing `$store.app.sidebarCollapsed`
- Testing: Vitest with `fake-indexeddb/auto` (already in `tests/setup.js`) — migration tests follow existing `tests/schema.test.js` pattern

## Standard Stack

### New libraries to add (verified 2026-04-14 via `npm view`)

| Library | Version | Purpose | Why Standard | Publish |
|---------|---------|---------|--------------|---------|
| `web-vitals` | **5.2.0** | Runtime LCP/INP/CLS/FCP/TTFB measurement | Official Google Chrome team library; 2KB gzip; tree-shakes per metric | 2026-03-25 |
| `@lhci/cli` | **0.15.1** | Dev-only Lighthouse desktop-preset runs | Standard for reproducible Lighthouse measurement; wraps Lighthouse 12.6.x | Verified current |

### Already in project (no upgrade needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `dexie` | 4.4.2 | IndexedDB wrapper — current, no bump needed for v6 schema |
| `fake-indexeddb` | 6.2.5 | Already in devDependencies + wired in `tests/setup.js` for Vitest IDB |
| `alpinejs` | 3.15.11 | All polish items work within existing Alpine patterns |
| `material-symbols` | 0.44.0 | Icon font; `add` glyph is present (used elsewhere) |
| `tailwindcss` + `@tailwindcss/vite` | 4.2.2 | Red accent tokens go in existing `@theme` block |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Temp-table shuffle for PK migration | `dexie-observable` `$$id` plugin | Plugin changes the PK format prefix but still can't retrofit onto existing `++id` data without the same shuffle; adds bundle weight for a one-time problem. Skip. |
| `crypto.randomUUID()` for PKs | `nanoid` | Both produce collision-safe IDs; randomUUID is native, zero dependency. Use native. |
| Vitest `fake-indexeddb` for migration tests | Playwright with real IDB | Real IDB gives higher fidelity but Vitest is the existing test runner and fake-indexeddb already covers the v6 upgrade callback execution path. Use existing. |
| localStorage backup | IndexedDB `counterflux_backup` DB | localStorage is synchronous (D-14) — guaranteed flushed before `db.open(v6)` returns. IndexedDB backup would race the upgrade. localStorage wins for this specific contract. |
| `npm run perf` (single run) | `npm run perf:3x` (median-of-3) | Single run matches D-19; median-of-3 is the **baseline methodology** (D-18) but uses Chrome DevTools manually, not lhci scripting. Keep them separate concerns. |

**Installation:**
```bash
npm install web-vitals@5.2.0
npm install -D @lhci/cli@0.15.1
```

## Architecture Patterns

### Recommended File Additions

```
src/
├── services/
│   └── migration.js          # NEW — backup + v6 upgrade orchestration
├── db/
│   └── schema.js             # MODIFIED — append v6 block with temp-table shuffle upgrade
├── workers/
│   └── bulk-data.worker.js   # MODIFIED — mirror v6 declaration (worker accesses cards/meta only; minimal change)
├── services/
│   └── perf.js               # NEW — web-vitals bootstrap (dev-only)
├── main.js                   # MODIFIED — call migration.js before store init; import perf.js in dev
└── styles/
    └── main.css              # MODIFIED — LIVE pulse keyframe, red accent tokens

lighthouserc.cjs              # NEW at project root

tests/
├── migration-v5-to-v6.test.js              # NEW — fixture-driven migration tests
└── fixtures/
    └── v5-snapshots.js                     # NEW — v5 fixture generators

.planning/
└── perf-baseline-v1.0.md     # NEW — committed baseline report (PERF-03)
```

### Pattern 1: Dexie PK-type change via temp-table shuffle (CRITICAL)

**Context:** Dexie 4.x does not support in-place primary-key type change. Attempting to redeclare `collection: '++id, ...'` → `collection: 'id, ...'` throws `UpgradeError: Not yet support for changing primary key`. Verified: [Dexie #1148](https://github.com/dexie/Dexie.js/issues/1148), [Dexie #646](https://github.com/dexie/Dexie.js/issues/646).

**What:** Create v6 tables under new names (`collection_v6`, `decks_v6`, etc.), copy rows with newly-generated UUIDs inside `.upgrade()`, then at end of upgrade rename the new tables over the old ones using IndexedDB 2.0's `IDBDatabase.deleteObjectStore` + schema redeclaration on a follow-up version bump.

**When to use:** Any synced table in v6 (all six: `collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`).

**Important implementation note:** The cleanest Dexie-idiomatic approach is to do the entire swap inside the v6 `.upgrade()` callback by:
1. Declaring v6 stores that include BOTH the old table (kept for the transaction) AND the new-shape temporary table (`_v6` suffix)
2. Inside `.upgrade(tx => ...)`, read all rows from the old table, generate UUIDs, build an id-remap (old numeric id → new UUID), write to the new table, rewrite FKs using the remap
3. At the end of `.upgrade()`, clear the old table (Dexie supports `tx.oldTable.clear()`)
4. Declare v7 in the SAME file (part of the Phase 7 commit) that redeclares the store WITHOUT the `_v6` suffix — this is Dexie's rename idiom: you can't rename, so you declare the final name and the `.upgrade()` for v7 moves rows from `_v6` to the final name, then clears `_v6`.

**Simpler alternative (recommended):** Ship as v6 ONLY, keep the `_v6` suffix in table names **permanently** for this milestone, and plan a "cleanup rename" for a future milestone v1.2 schema bump. This avoids two-version complexity in a single PR but commits to the ugly table names for a while. **Planner should surface this tradeoff to the user** before choosing between the two-phase (v6+v7) and permanent-suffix approaches.

**Example (two-phase approach):**
```javascript
// Source: Dexie issue #646 pattern + Counterflux adaptation
db.version(6).stores({
  // Keep old tables in v6 declaration so .upgrade() can read from them
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  games: '++id, deck_id, started_at, ended_at',
  watchlist: '++id, &scryfall_id',
  // New-shape temporary tables
  collection_v6: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  decks_v6: 'id, name, format, user_id, updated_at, synced_at',
  deck_cards_v6: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
  games_v6: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
  watchlist_v6: 'id, &scryfall_id, user_id, updated_at, synced_at',
  profile: 'id, user_id, updated_at',
  // price_history gets updated_at added via a normal field addition (PK stays ++id — NOT synced, no UUID needed)
  price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
  // New sync tables (fresh — no migration)
  sync_queue: '++id, table_name, user_id, created_at',
  sync_conflicts: '++id, table_name, detected_at',
}).upgrade(async tx => {
  const now = Date.now();

  // --- collection ---
  const oldCollection = await tx.table('collection').toArray();
  const collectionRemap = new Map(); // oldId -> newUuid
  for (const row of oldCollection) {
    const newId = crypto.randomUUID();
    collectionRemap.set(row.id, newId);
    await tx.table('collection_v6').add({
      ...row,
      id: newId,
      user_id: null,           // backfill — Phase 10 sets on auth
      updated_at: now,         // D-07
      synced_at: null,         // D-08
    });
  }

  // --- decks (+ deck_cards FK rewrite, D-02) ---
  const oldDecks = await tx.table('decks').toArray();
  const deckRemap = new Map();
  for (const deck of oldDecks) {
    const newId = crypto.randomUUID();
    deckRemap.set(deck.id, newId);
    await tx.table('decks_v6').add({
      ...deck,
      id: newId,
      user_id: null,
      updated_at: deck.updated_at || now,  // preserve if present
      synced_at: null,
    });
  }

  const oldDeckCards = await tx.table('deck_cards').toArray();
  for (const dc of oldDeckCards) {
    const newDeckId = deckRemap.get(dc.deck_id);
    if (!newDeckId) {
      console.warn('[migration] orphan deck_card, skipping:', dc);
      continue; // orphan row — old deck_id no longer exists; skip rather than crash
    }
    await tx.table('deck_cards_v6').add({
      ...dc,
      id: crypto.randomUUID(),
      deck_id: newDeckId,      // FK rewrite (D-02)
      user_id: null,
      updated_at: now,
      synced_at: null,
    });
  }

  // --- games (+ turn_laps backfill, D-09) ---
  const oldGames = await tx.table('games').toArray();
  for (const game of oldGames) {
    const newId = crypto.randomUUID();
    // If a game referenced a deck, rewrite deck_id too
    const newDeckId = game.deck_id != null ? deckRemap.get(game.deck_id) : null;
    await tx.table('games_v6').add({
      ...game,
      id: newId,
      deck_id: newDeckId,
      user_id: null,
      turn_laps: game.turn_laps || [],  // D-09
      updated_at: now,
      synced_at: null,
    });
  }

  // --- watchlist ---
  const oldWatchlist = await tx.table('watchlist').toArray();
  for (const row of oldWatchlist) {
    await tx.table('watchlist_v6').add({
      ...row,
      id: crypto.randomUUID(),
      user_id: null,
      updated_at: now,
      synced_at: null,
    });
  }

  // --- price_history updated_at backfill (D-11, no PK change) ---
  await tx.table('price_history').toCollection().modify(row => {
    if (row.updated_at == null) row.updated_at = now;
  });

  // --- schema_version marker (D-12) ---
  await tx.table('meta').put({
    key: 'schema_version',
    version: 6,
    migrated_at: new Date().toISOString(),
  });

  // Clear old tables so the v7 rename is clean
  // NOTE: do NOT delete the old tables here — Dexie manages schema. Old tables
  // will be dropped in v7 below by simply not redeclaring them.
});

db.version(7).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  // Old autoincrement tables dropped by omission
  collection: null,
  decks: null,
  deck_cards: null,
  games: null,
  watchlist: null,
  // Final names — copy from *_v6
  collection_final: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  // ... same for decks, deck_cards, games, watchlist
  collection_v6: null, // will be dropped after .upgrade() below copies its rows
  // ...
}).upgrade(async tx => {
  // Copy _v6 → final, then implicit drop by next version
});
```

**Planner decision point:** The two-version approach (v6 shuffle → v7 rename) is the correct Dexie idiom but adds significant complexity. The **simpler single-version alternative** is:
- Name the final tables `collection`, `decks`, etc. from the start in v6
- Use the `.upgrade()` callback to read from the implicit "previous schema" (Dexie preserves the old schema inside the `.upgrade()` transaction even after the new schema is declared) and rewrite rows with `tx.table('collection').clear()` then `add(...)` — but Dexie only supports this when the PK TYPE hasn't changed, which is exactly what breaks here.

**Therefore:** The temp-table shuffle IS required. Planner should choose between (a) two-version v6+v7 within this PR (cleaner long-term), or (b) permanent `_v6` naming until a future milestone renames. Recommend (a) because Phases 9 and 11 consume these table names — saddling them with `_v6` suffix is ugly.

### Pattern 2: Dexie event handlers for upgrade UX (D-15)

```javascript
// Source: Dexie issues/docs pattern
db.on('blocked', (event) => {
  // Another tab is open on an older version and blocking our upgrade
  const modal = showBlockingModal({
    title: 'Counterflux is upgrading',
    body: 'Please close any other Counterflux tabs so we can finish updating your local data.',
    dismissible: false,
  });
  // Modal auto-dismisses when upgrade proceeds (db.open resolves)
  db.on('ready', () => modal.close());
});

db.on('versionchange', (event) => {
  // Another tab has requested an upgrade — we're the old version
  // Close our connection so the other tab can proceed
  db.close();
  showToast({
    type: 'warning',
    message: 'Counterflux was updated in another tab. Please reload this page.',
    persistent: true,
  });
});
```

### Pattern 3: Pre-migration backup with localStorage quota handling

```javascript
// src/services/migration.js
const BACKUP_KEY_PREFIX = 'counterflux_v5_backup_';
const BACKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // D-16
const USER_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'price_history'];

export async function backupBeforeMigration(db) {
  // Only run if on v5 about to upgrade — check schema_version in meta
  const currentVersion = db.verno; // 0 if fresh, else highest applied
  if (currentVersion === 0 || currentVersion >= 6) return; // fresh install OR already migrated

  const snapshot = {};
  for (const table of USER_TABLES) {
    try {
      snapshot[table] = await db.table(table).toArray();
    } catch (e) {
      // Table may not exist on older versions (e.g., watchlist added in v5)
      snapshot[table] = [];
    }
  }

  const key = `${BACKUP_KEY_PREFIX}${new Date().toISOString()}`;
  const json = JSON.stringify(snapshot);

  try {
    localStorage.setItem(key, json);
    console.info(`[migration] backup saved (${(json.length / 1024).toFixed(1)}KB) at key=${key}`);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Fallback: offer download
      downloadBackupFile(json);
      throw new MigrationBackupFailedError('localStorage quota exceeded — backup downloaded as file');
    }
    throw e;
  }
}

export function sweepOldBackups() {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(BACKUP_KEY_PREFIX)) continue;
    const isoTs = key.substring(BACKUP_KEY_PREFIX.length);
    const age = now - new Date(isoTs).getTime();
    if (age > BACKUP_TTL_MS) {
      localStorage.removeItem(key);
    }
  }
}
```

### Pattern 4: web-vitals v5 dev bootstrap

```javascript
// src/services/perf.js
// Registered ONCE at app start — SPA handles rest via soft-nav detection
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

export function bootPerfMetrics() {
  if (!import.meta.env.DEV) return; // D-21: dev-only

  const metrics = {};
  const render = () => console.table(metrics);

  const track = (metric) => {
    metrics[metric.name] = {
      value: +metric.value.toFixed(2),
      rating: metric.rating,
      delta: +metric.delta.toFixed(2),
      id: metric.id.slice(0, 12),
    };
    render();
  };

  onLCP(track);
  onINP(track);
  onCLS(track);
  onFCP(track);
  onTTFB(track);
}
```

### Pattern 5: Sidebar collapse with persistence (D-27/D-28/D-29)

Existing `$store.app.sidebarCollapsed` is already wired in `index.html` (lines 93, 174, 292). Phase 7 additions:
1. **Header toggle button** — add to `<aside>` brand section; icon flips between `chevron_left` and `chevron_right`
2. **Persistence** — hydrate `sidebarCollapsed` from `localStorage.getItem('sidebar_collapsed') === 'true'` on store init; `$watch('sidebarCollapsed', v => localStorage.setItem('sidebar_collapsed', String(v)))`
3. **Tooltip on collapsed nav items** — `title` attribute on each nav `<a>` in collapsed mode, showing `screen.label`

### Anti-Patterns to Avoid

- **Single-version PK change:** Attempting `db.version(6).stores({ collection: 'id, ...' })` over a v5 with `++id` throws `UpgradeError` at upgrade time. Must use temp-table shuffle.
- **Logging web-vitals per navigation:** The library auto-fires on soft navigations. Registering handlers per route would double-register.
- **localStorage writes inside Dexie `.upgrade()`:** `.upgrade()` runs inside an IDB transaction; localStorage writes outside the transaction are safe but should happen BEFORE `db.open()` — inside the upgrade is too late (old rows already being rewritten).
- **Assuming `crypto.randomUUID` is available everywhere:** It is in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+) and Node 19+. Counterflux is desktop-first → safe. Fallback not required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random-string function | `crypto.randomUUID()` | Native, collision-safe, no dependency |
| Web Vitals measurement | Manual `PerformanceObserver` wiring | `web-vitals` 5.2.0 | The official library handles every edge case (hidden-tab LCP, INP thresholds, CLS session windows) |
| Lighthouse automation | Puppeteer + lighthouse npm | `@lhci/cli` 0.15.1 | `lhci collect` handles server start, Chrome launch, and report output in one command |
| IndexedDB test stub | Mock `indexedDB` with jest mocks | `fake-indexeddb/auto` | Already installed and wired; behaviour matches real IDB for upgrade semantics |
| Migration test fixtures | Invent a fixture DSL | Generator functions that open Dexie at exact prior version | Dexie's version chain is already a declarative schema — reuse via targeted `.version(N).stores()` in a test helper |
| Dexie PK change | Attempt in-place `++id`→`id` with raw `.upgrade()` | Temp-table shuffle (see Pattern 1) | Dexie throws `UpgradeError: Not yet support for changing primary key` — confirmed in upstream issues #1148 and #646 |

**Key insight:** Phase 7's only original code is the migration orchestration in `src/services/migration.js`, Alpine-facing polish wiring, and `perf.js`. Everything else is library-driven or config. Stay disciplined — resist the urge to write custom utilities for things the stack already solves.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | IndexedDB `counterflux` DB with six synced user-data tables (collection, decks, deck_cards, games, watchlist, price_history). All rows use numeric `++id` PKs that WILL change on migration — downstream references (if any exist in localStorage, session storage, or URL hashes) break. | Data migration IS the entire Plan 3. Audit for any localStorage or sessionStorage keys that cache a numeric `deck_id` or `game_id` and invalidate them during boot. |
| Live service config | None — Counterflux has no external services except Scryfall (read-only, stateless). No Supabase yet (Phase 10). No CI currently. | None. |
| OS-registered state | None — Counterflux is a pure-browser SPA. No Windows Task Scheduler / launchd / systemd / pm2 registration. | None. |
| Secrets/env vars | None new. `VITE_SUPABASE_*` env vars not needed until Phase 10. Lighthouse CI runs locally, no token. | None. |
| Build artifacts / installed packages | `dist/` is generated per build. Adding `web-vitals` and `@lhci/cli` to package.json requires `npm install` after merge. First `lhci autorun` downloads Chromium (~150MB cached in `~/.cache/lhci`). | Document in Plan 2 task: first-run Chromium download is a one-time cost; not a regression. |

**Critical:** Downstream code that persists or caches a numeric deck_id (e.g., "last opened deck" in localStorage, URL route params like `#deck/42`) will point at nothing after migration. Plan 3 must audit:
- `localStorage` keys in `src/stores/*.js` for any numeric ID persistence
- `router.js` routes that take `:deckId` — are these currently integers?
- Alpine store initializers that read a "last active" ID from storage

Grep patterns: `localStorage\.(set|get)Item.*id`, `route.*deck.*\$id`, `last.*deck`.

## Common Pitfalls

### Pitfall A: Card image "white triangles" is a flyout CSS omission, not an asset issue

**What goes wrong:** POLISH-04 is often misread as "the Scryfall images have white corners." They do not. The issue is that `index.html:343-349` renders `<img :src="$store.search.selectedCard._image" class="w-full object-contain">` with NO `border-radius`. The Scryfall PNG is a square-cornered rectangle. The dark `#14161C` flyout background shows around the corners — visually, the eye reads those dark triangles as white-missing-from-the-image.

**Why it happens:** Real MTG cards have physical rounded corners; Scryfall crops to the card frame, not the rounded-corner physical envelope.

**How to avoid:** Add `border-radius: 4.75%` (approximates the 3mm physical corner radius on a standard MTG card — ≈4.75% of the 63mm card width) directly to the `<img>` on flyout AND any other large card image (add-card-modal preview, card-tile in Collection grid). Community standard is 4.75% or ~19px on a 400px-wide image.

**Warning signs:** User complaints about "white triangles", "weird corners on card images" — actually the surface showing through.

### Pitfall B: Dexie `.upgrade()` can throw `UpgradeError: Not yet support for changing primary key`

**What goes wrong:** Redeclaring a store from `'++id, ...'` to `'id, ...'` in v6 fails at `db.open()` time with this error. No rows are migrated. User is stuck on v5 forever. This is the single highest-risk failure mode in Phase 7.

**Why it happens:** Dexie 4.x does not support in-place PK type change — see §Architecture Patterns Pattern 1.

**How to avoid:** Temp-table shuffle (see Pattern 1). Spike this BEFORE any production code lands — write a one-off test that confirms the shuffle works against a fixture v5 DB. Do not trust that the pattern "just works"; measure it.

**Warning signs:** Error in console at boot. `db.verno === 5` after supposedly opening v6.

### Pitfall C: Foreign key orphans after PK remap (D-02)

**What goes wrong:** A v5 `deck_cards` row references `deck_id: 42`. During v6 migration, the deck with old id 42 is assigned UUID `abc-123`. If the FK rewrite uses the remap table but the remap Map is not populated correctly (e.g., the `decks` loop runs AFTER the `deck_cards` loop), every `deck_cards` row gets `deck_id: undefined`. Post-migration the user sees decks with 0 cards.

**Why it happens:** Parallel `Promise.all` inside `.upgrade()` — the remap Maps must be fully populated before FK-dependent tables migrate.

**How to avoid:** Strict sequential ordering inside `.upgrade()`. Migrate `decks` FULLY before touching `deck_cards`. Build the `deckRemap` Map, assert `deckRemap.size === oldDecks.length`, THEN iterate `deck_cards`.

**Warning signs:** Migration test shows deck count preserved but card count per deck = 0. `deck_cards_v6` has null `deck_id` values.

### Pitfall D: localStorage quota exceeded on large collections (D-14)

**What goes wrong:** A user with 5000-card collection + 30 decks + 200 games has a JSON snapshot ~2-3MB. Most browsers cap localStorage at 5-10MB per origin. `setItem` throws `QuotaExceededError`. D-14 says "synchronous writes so it's guaranteed done before Dexie opens v6" — if the set throws, the upgrade runs WITHOUT a backup.

**Why it happens:** localStorage is not sized for this use case. User assumed typical sizes would fit; power users won't.

**How to avoid:** Wrap the `setItem` in try/catch. On `QuotaExceededError`, trigger a downloadable `.json` file via `Blob + URL.createObjectURL + <a download>` synthetic click, and only then proceed with the upgrade. Surface this via toast: "Large collection detected — backup saved to Downloads." This is already noted in CONTEXT.md Deferred Ideas but with quota guard should be in-scope for safety.

**Warning signs:** Browser console shows `DOMException: QuotaExceededError` on boot.

### Pitfall E: web-vitals instrumentation regresses boot time (from PITFALLS.md §11)

**What goes wrong:** Eager `import 'web-vitals'` at top of `main.js` competes with the critical path it's measuring. LCP gets worse because the library evaluates synchronously.

**How to avoid:** Lazy-import inside a `requestIdleCallback` (fall back to `setTimeout(fn, 1)` in Safari): `requestIdleCallback(() => import('./services/perf.js').then(m => m.bootPerfMetrics()))`. This runs web-vitals AFTER first paint — perfectly fine because web-vitals registers handlers that wait for the relevant timing entries.

**Warning signs:** Baseline LCP worse WITH instrumentation than WITHOUT. Measure both before committing the baseline number.

### Pitfall F: `onblocked` fires silently because no handler registered

**What goes wrong:** User has two Counterflux tabs open. Tab A upgrades to v6. Tab B holds an open v5 connection. Tab A's `db.open()` promise never resolves. Without an `onblocked` handler, Tab A just shows the splash forever.

**How to avoid:** Wire `db.on('blocked', ...)` BEFORE calling `db.open()`. The handler must show UI (not just `console.warn`) so the user knows to close the other tab.

**Warning signs:** User reports "app hangs on load" after publishing v1.1. Production logs show no error — `onblocked` is an event, not an exception.

### Pitfall G: POLISH-07 icon swap breaks screen-reader announcement

**What goes wrong:** `<span class="material-symbols-outlined">more_horiz</span>` reads aloud as "more horiz" to screen readers. Swapping to `add` reads "add". That's fine. BUT some templates wrap the icon in a `<button aria-label="...">`; `counter-panel.js:100` currently has `aria-label="Counters"` which is correct. Check that no surrounding template uses the icon text as the accessible name — if so, the swap leaks the raw glyph name.

**How to avoid:** Confirm `aria-label="Counters"` stays on the button. Screen-reader announcement unchanged.

### Pitfall H: Tailwind v4 `@theme` tokens don't auto-generate `border-*` utilities

**What goes wrong:** Adding `--color-secondary-hover: #FF5555` to `@theme` does NOT automatically produce `border-secondary-hover` utility class in v4. Depending on build chain, custom color tokens may need explicit utility references to be emitted.

**How to avoid:** Reference new red-variant tokens in HTML as `style="..."` or via `@apply` in component CSS rather than expecting `border-secondary-hover` to just work. Test the Tailwind build after adding tokens.

## Code Examples

### Favicon declaration (POLISH-03)

```html
<!-- index.html <head> -->
<link rel="icon" type="image/png" href="/assets/niv-mila.png">
<!-- Optional sizes for sharper display on high-DPI -->
<link rel="icon" type="image/png" sizes="32x32" href="/assets/niv-mila.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/niv-mila.png">
<link rel="apple-touch-icon" href="/assets/niv-mila.png">
```
`niv-mila.png` is currently untracked in git (see `git status`); first task in Plan 1 is `git add assets/niv-mila.png`.

### LIVE chip pulsing dot (POLISH-08, D-26)

```css
/* src/styles/main.css */
@keyframes cf-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.3); }
}
.cf-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #2ECC71);
  animation: cf-pulse 1.5s ease-in-out infinite;
}
```

```html
<!-- index.html — replace existing .w-2.h-2 span at lines 259-266 -->
<span
  class="w-1.5 h-1.5 rounded-full"
  :class="{
    'cf-live-dot': color === 'success',
    'bg-warning': color === 'warning',
    'bg-secondary': color === 'secondary'
  }"
></span>
```

Only pulse in `live` state (per D-26). `warning` and `secondary` states keep the static dot — pulsing a warning is too noisy.

### Splash quotes typographic treatment (POLISH-01)

Current `FLAVOUR_TEXTS` in `src/components/splash-screen.js:11` uses inline `--` for attribution. Fix:

```javascript
// src/components/splash-screen.js
const FLAVOUR_TEXTS = [
  { quote: 'The Izzet are creative geniuses. Disregard the number of property-loss inquiries.', attribution: 'Razia, Boros Archangel' },
  { quote: 'Izzet-style problem solving: keep adding electricity until something works.', attribution: 'Ral Zarek' },
  { quote: 'Knowledge is the most dangerous weapon.', attribution: 'Niv-Mizzet, Parun' },
  { quote: 'Inspiration is just one satisfying explosion away.', attribution: 'Chandra Nalaar' },
  { quote: "There's no wrong way to wield a thunderbolt.", attribution: 'Ral Zarek' },
];
```

```html
<!-- index.html splash block — replace existing flavour <p> -->
<p x-show="$store.bulkdata.status !== 'error'"
   class="text-center leading-[1.5] max-w-[400px]"
   style="color: var(--color-text-muted, #7A8498); font-family: 'Space Grotesk', sans-serif; font-size: 14px;">
  <span style="display: block;">
    <span style="font-size: 24px; color: var(--color-text-dim);">&ldquo;</span>
    <span style="font-style: italic;" x-text="flavourText.quote"></span>
    <span style="font-size: 24px; color: var(--color-text-dim);">&rdquo;</span>
  </span>
  <span class="font-mono uppercase mt-xs"
        style="display: block; font-size: 11px; letter-spacing: 0.15em; color: var(--color-text-dim);"
        x-text="'— ' + flavourText.attribution"></span>
</p>
```

### lighthouserc.cjs for `npm run perf` (PERF-02)

```javascript
// lighthouserc.cjs (project root)
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:.*http://localhost:4173',
      startServerReadyTimeout: 15000,
      url: ['http://localhost:4173/'],
      numberOfRuns: 1, // D-19 single run
      settings: {
        preset: 'desktop',
        output: 'html',
        outputPath: './lighthouse-report/report.html',
      },
    },
  },
};
```

```json
// package.json scripts additions
"perf": "lhci collect --config=lighthouserc.cjs",
"perf:open": "lhci collect --config=lighthouserc.cjs && open ./lighthouse-report/report.html"
```

### Vitest migration fixture harness (SCHEMA-02)

```javascript
// tests/migration-v5-to-v6.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

const DB_NAME = 'counterflux_migration_test';

// Helper: open DB at exactly v5 with the v5 schema chain
async function openAtV5() {
  const db = new Dexie(DB_NAME);
  db.version(1).stores({ cards: 'id', meta: 'key' });
  db.version(2).stores({ cards: 'id', meta: 'key', collection: '++id, scryfall_id, category, foil' });
  db.version(3).stores({ collection: '++id, scryfall_id, category, foil', decks: '++id, name, format, updated_at', deck_cards: '++id, deck_id, scryfall_id' });
  db.version(4).stores({ edhrec_cache: 'commander', combo_cache: 'deck_id', card_salt_cache: 'sanitized' });
  db.version(5).stores({ watchlist: '++id, &scryfall_id', price_history: '++id, scryfall_id, date', games: '++id, deck_id, started_at, ended_at' });
  await db.open();
  return db;
}

// Helper: open DB at v6 by importing the real schema
async function reopenAtV6() {
  // Close any handles, reopen with Phase 7's schema module
  const { db } = await import('../src/db/schema.js?migration-test=1');
  await db.open();
  return db;
}

describe('Dexie v5 → v6 migration', () => {
  afterEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  it('preserves row counts across all user tables', async () => {
    const v5 = await openAtV5();
    await v5.table('collection').bulkAdd(generateCollectionFixture(500));
    await v5.table('decks').bulkAdd(generateDecksFixture(10));
    await v5.table('deck_cards').bulkAdd(generateDeckCardsFixture(10, 100));
    await v5.table('games').bulkAdd(generateGamesFixture(5));
    v5.close();

    const v6 = await reopenAtV6();
    expect(await v6.table('collection_v6').count()).toBe(500);
    expect(await v6.table('decks_v6').count()).toBe(10);
    expect(await v6.table('deck_cards_v6').count()).toBe(1000);
    expect(await v6.table('games_v6').count()).toBe(5);
  });

  it('rewrites deck_cards.deck_id to match new deck UUIDs (FK integrity, D-02)', async () => {
    // ... arrange, act
    const decks = await v6.table('decks_v6').toArray();
    const deckIds = new Set(decks.map(d => d.id));
    const deckCards = await v6.table('deck_cards_v6').toArray();
    for (const dc of deckCards) {
      expect(deckIds.has(dc.deck_id)).toBe(true); // no orphans
      expect(typeof dc.deck_id).toBe('string');   // UUID, not number
    }
  });

  it('backfills turn_laps=[] on every existing game (D-09)', async () => {
    // ... arrange with v5 games that have no turn_laps field
    const games = await v6.table('games_v6').toArray();
    expect(games.every(g => Array.isArray(g.turn_laps))).toBe(true);
  });

  it('backfills updated_at to migration-time Date.now (D-07)', async () => {
    const before = Date.now();
    // ... run migration
    const after = Date.now();
    const rows = await v6.table('collection_v6').toArray();
    expect(rows.every(r => r.updated_at >= before && r.updated_at <= after)).toBe(true);
  });

  it('creates sync_queue and sync_conflicts tables with expected indexes (D-05, D-06)', async () => {
    const v6 = await reopenAtV6();
    expect(v6.table('sync_queue')).toBeDefined();
    expect(v6.table('sync_conflicts')).toBeDefined();
  });

  it('writes schema_version row to meta (D-12)', async () => {
    const v6 = await reopenAtV6();
    const sv = await v6.table('meta').get('schema_version');
    expect(sv.version).toBe(6);
    expect(sv.migrated_at).toBeDefined();
  });

  it('handles empty v5 database without error', async () => { /* ... */ });
  it('handles v4 → v6 jump (user skipped v5)', async () => { /* ... */ });
  it('handles v1 → v6 (fresh v1.0 user never opened since upgrade)', async () => { /* ... */ });
});

// Fixture generators
function generateCollectionFixture(count) {
  return Array.from({ length: count }, (_, i) => ({
    scryfall_id: `fixture-card-${i}`,
    category: i % 10 === 0 ? 'wishlist' : 'owned',
    foil: i % 25 === 0,
    quantity: 1,
  }));
}
// ... etc
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `onFID` (First Input Delay) | `onINP` (Interaction to Next Paint) | web-vitals 3.x → 4.x (2024); still removed in 5.x | No `onFID` export in v5 — do not use |
| `PerformanceObserver` DIY perf measurement | `web-vitals` library | Long-standing (library stable since v1) | 2KB gzip beats writing the edge cases yourself |
| Lighthouse via Puppeteer scripts | `@lhci/cli` | 2020+ | `lhci collect` wraps the server-start + browser-launch in one command |
| Dexie schema string `++id` (autoincrement numeric) | Dexie schema string `id` (user-assigned) with `crypto.randomUUID()` | Required for cloud sync — numeric IDs collide across devices | Requires temp-table shuffle if migrating existing data |
| `import 'web-vitals'` eagerly at top of entry | Lazy via `requestIdleCallback` | Post-mortem guidance in PITFALLS §11 | Avoids measuring instrumentation's own cost |

**Deprecated/outdated:**
- `onFID`: replaced by `onINP` in web-vitals 4.x
- Dexie 3.x `Dexie.UUIDPrimaryKey` plugin: superseded by native `crypto.randomUUID()` + user-assigned IDs in schema string

## Open Questions

1. **Two-version migration (v6 shuffle + v7 rename) or permanent `_v6` suffix?**
   - What we know: Dexie cannot change PK in-place; both approaches work; two-version is cleaner long-term, permanent-suffix ships faster.
   - What's unclear: user's preference — CONTEXT.md D-01…D-03 locked the PK change but left the renaming strategy unspecified.
   - Recommendation: Planner should explicitly ask the user at plan-generation time. Default suggestion: two-version (v6+v7) within Plan 3's single PR. Phases 9/11 consume these table names and shouldn't inherit `_v6` clutter.

2. **Should migration show a progress indicator for power users with 5000+ card collections?**
   - CONTEXT.md "Claude's Discretion" says yes — but how noisy?
   - Recommendation: Simple splash-screen status update ("Migrating collection… 1,234 of 5,000 rows") using the existing splash infrastructure. Fire updates every 10% of row count to avoid thrash.

3. **Does the v5 backup need validation before proceeding to v6?**
   - Current plan (D-14) writes backup synchronously then opens v6. If backup is corrupted (JSON truncated), we'd discover that ONLY during a restore attempt.
   - Recommendation: After `setItem`, read it back and `JSON.parse()` to confirm round-trip. 20ms cost for safety; matches "blocking modal" posture of D-15.

4. **Baseline report: manual median-of-3 or scripted?**
   - D-18 specifies median of 3 cold-boot runs, but D-19 says `npm run perf` is a single run.
   - Recommendation: Plan 2 delivers two separate artefacts: (a) the committed baseline number in `.planning/perf-baseline-v1.0.md` from 3 manual runs (human in loop), (b) the reproducible `npm run perf` single-run tooling. They serve different purposes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, npm, lhci | Assumed ✓ | ≥22 (already required by Vite 8) | None needed |
| Chrome/Chromium | `lhci collect` | Auto-installed on first run | Lighthouse 12.6.x bundles Chromium | First-run downloads ~150MB to `~/.cache/lhci` — document in plan |
| `crypto.randomUUID` | UUID PK generation | ✓ | Chrome 92+, FF 95+, Safari 15.4+ | Not needed (desktop-first app) |
| `fake-indexeddb` | Vitest migration tests | ✓ (6.2.5) | Already in devDependencies | N/A |
| localStorage | Pre-migration backup | ✓ | 5MB quota typical | Downloadable `.json` file on `QuotaExceededError` |
| `vite preview` | Lighthouse target | ✓ | Already `npm run preview` exists | N/A |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none (localStorage's fallback is handled in-code per Pitfall D).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + fake-indexeddb 6.2.5 |
| Config file | `vitest.config.js` (root) + `tests/setup.js` imports `fake-indexeddb/auto` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (same — no split) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | Splash renders quote + attribution with typographic marks | component / snapshot | `npx vitest run tests/splash-screen.test.js` | ❌ Wave 0 |
| POLISH-02 | Red accents applied to D-30…D-33 surfaces | manual visual QA | — | manual-only (see below) |
| POLISH-03 | Favicon link present, file reachable | integration | `npx vitest run tests/favicon.test.js` | ❌ Wave 0 |
| POLISH-04 | Card image has rounded corners, no visible triangles | manual visual QA | — | manual-only |
| POLISH-05 | Toast icons render at full opacity | component | `npx vitest run tests/toast.test.js` (extend existing) | ✓ (extend) |
| POLISH-06 | Ritual modal shows "Brew a new storm" / "Abandon storm" | component | `npx vitest run tests/ritual-modal.test.js` | ❌ Wave 0 |
| POLISH-07 | Counter-panel trigger uses `add` glyph | component | `npx vitest run tests/counter-panel.test.js` | ❌ Wave 0 |
| POLISH-08 | LIVE chip has pulsing dot element | component + visual | `npx vitest run tests/connectivity-status.test.js` (extend) | ✓ (extend) |
| POLISH-09 | Sidebar collapse toggle persists to localStorage | integration | `npx vitest run tests/sidebar-collapse.test.js` | ❌ Wave 0 |
| POLISH-10 | Top losers panel never shows `scryfall_id` string | component | `npx vitest run tests/movers-panel.test.js` | ❌ Wave 0 |
| POLISH-11 | Wishlist add paths show "Added to wishlist" toast | integration | `npx vitest run tests/add-card-modal.test.js` + flyout test | ❌ Wave 0 |
| PERF-01 | web-vitals logs to console in dev; no overlay | smoke + visual | `npm run dev` → open DevTools → confirm `console.table` | manual-only |
| PERF-02 | `npm run perf` produces `./lighthouse-report/report.html` | smoke | `npm run perf && test -f ./lighthouse-report/report.html` | ❌ Wave 0 (shell-level, no Vitest) |
| PERF-03 | Baseline report committed with concrete targets | artefact review | grep for `TTI:` and `LCP:` in `.planning/perf-baseline-v1.0.md` | ❌ Wave 0 |
| SCHEMA-01 | v5→v6 adds fields + tables + correct indexes | integration | `npx vitest run tests/migration-v5-to-v6.test.js` — "creates sync_queue and sync_conflicts" | ❌ Wave 0 |
| SCHEMA-02 | Migration preserves rows & FK integrity across v1-v5 fixtures | integration | `npx vitest run tests/migration-v5-to-v6.test.js` — full suite | ❌ Wave 0 |
| SCHEMA-03 | Pre-migration backup writes to localStorage + sweeps old backups | integration | `npx vitest run tests/migration-backup.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (~5-15s for current suite; migration tests add ~2s)
- **Per wave merge:** `npm test` (same — suite is fast)
- **Phase gate:** `npm test` green AND `npm run perf` produces report AND manual QA checklist signed off

### Wave 0 Gaps

**Test files to create:**
- [ ] `tests/migration-v5-to-v6.test.js` — covers SCHEMA-01, SCHEMA-02 (largest gap; high-risk)
- [ ] `tests/migration-backup.test.js` — covers SCHEMA-03
- [ ] `tests/fixtures/v5-snapshots.js` — shared fixture generators for v5-shape data
- [ ] `tests/splash-screen.test.js` — covers POLISH-01
- [ ] `tests/favicon.test.js` — asserts `<link rel="icon">` present in built `index.html`
- [ ] `tests/ritual-modal.test.js` — covers POLISH-06 (renders new copy)
- [ ] `tests/counter-panel.test.js` — covers POLISH-07 (new `add` glyph)
- [ ] `tests/sidebar-collapse.test.js` — covers POLISH-09 (toggle + persistence)
- [ ] `tests/movers-panel.test.js` — covers POLISH-10 (fallback rendering)
- [ ] `tests/add-card-modal.test.js` or extend existing — covers POLISH-11 (wishlist wording)

**Existing tests to extend:**
- [ ] `tests/toast.test.js` — add POLISH-05 opacity assertion
- [ ] `tests/connectivity-status.test.js` — add POLISH-08 pulsing-dot element presence

**Manual-only (documented justification):**
- POLISH-02: visual 15%-coverage subjective judgment (no practical automated assertion)
- POLISH-04: visual absence of "white triangles" — screenshot comparison possible but overkill; easier to manually verify after POLISH-04's CSS fix lands
- PERF-01: confirming `console.table` output is live in dev mode (requires DevTools open, human-in-loop)

**Framework install:** None — Vitest + fake-indexeddb already in place.

## Sources

### Primary (HIGH confidence)
- `npm view web-vitals version` → **5.2.0** published 2026-03-25 (verified 2026-04-14)
- `npm view @lhci/cli version` → **0.15.1** (verified)
- `npm view dexie version` → **4.4.2** (confirmed current in project)
- [GoogleChrome/web-vitals README](https://github.com/GoogleChrome/web-vitals#readme) — v5 API: `onLCP/onINP/onCLS/onFCP/onTTFB`, no `onFID`, register once at startup
- [@lhci/cli configuration docs](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) — `startServerCommand` + `startServerReadyPattern` + `numberOfRuns` + `settings.preset: 'desktop'`
- `.planning/research/PITFALLS.md` §1, §11 — Dexie migration + web-vitals self-regression
- `.planning/research/STACK.md` §3 — library versions and integration patterns
- Project file `tests/setup.js` — confirms `fake-indexeddb/auto` is already loaded
- Project file `package.json` — confirms Vitest + fake-indexeddb already installed

### Secondary (MEDIUM confidence)
- [Dexie GitHub Issue #1148 "Not yet support for changing primary key"](https://github.com/dexie/Dexie.js/issues/1148) — confirms the exact error and resolution notes
- [Dexie GitHub Issue #646 "Is it possible to change primary key in db version upgrade?"](https://github.com/dexie/Dexie.js/issues/646) — maintainer-endorsed temp-table shuffle pattern
- [sabatino.dev — Using UUID Primary Keys in Dexie](https://www.sabatino.dev/using-uuid-primary-keys-in-dexie/) — `$$id` plugin pattern (rejected for this phase; temp-shuffle used instead)
- MTG card dimensions: physical corner radius ~3mm on 63mm card ≈ 4.75% border-radius — community standard on Scryfall wrapper UIs

### Tertiary (LOW confidence — flagged for validation)
- Exact behaviour of Dexie `tx.table('old_table').clear()` inside an `.upgrade()` that has already declared the new schema — verify empirically in the Plan 3 spike
- `crypto.randomUUID()` availability in the worker context (`src/workers/bulk-data.worker.js`) — likely supported (Chrome 92+) but worker scope is separate; verify before shipping if the worker ever needs to generate UUIDs (it doesn't currently)

## File-Touch Inventory

Which files each requirement touches (feeds planner's `files_modified` frontmatter):

| Req | Files |
|-----|-------|
| POLISH-01 | `src/components/splash-screen.js`, `index.html` (splash block lines 81-84) |
| POLISH-02 | `src/styles/main.css` (@theme red variants), `src/components/card-tile.js` (hover red), `src/components/deck-card-tile.js` (hover red), `index.html` (card-detail flyout, active nav tab, notification bell), destructive CTAs in `src/components/ritual-modal.js` (abandon), `src/components/deck-editor.js` (delete deck), `src/screens/*` (clear collection) |
| POLISH-03 | `index.html` (`<head>` `<link>`), `assets/niv-mila.png` (git add — currently untracked) |
| POLISH-04 | `index.html` (flyout img lines 343-349), optionally `src/components/card-tile.js`, `src/components/deck-card-tile.js`, `src/components/add-card-modal.js` |
| POLISH-05 | `index.html` (toast template lines 524-533) or Tailwind class audit in `src/components/toast.js` |
| POLISH-06 | `src/components/ritual-modal.js` (lines 47, 163) — no other call sites per grep |
| POLISH-07 | `src/components/counter-panel.js` (line 100) |
| POLISH-08 | `src/styles/main.css` (@keyframes), `index.html` (lines 258-266) |
| POLISH-09 | `index.html` (brand section lines 97-107 adds toggle button), `src/stores/app.js` (hydrate from localStorage), `src/components/sidebar.js` (`toggleSidebar` already exists line 56) |
| POLISH-10 | `src/components/movers-panel.js` (line 108 fallback) |
| POLISH-11 | `src/components/add-card-modal.js` (line 78 — wishlist branch), `index.html` (flyout wishlist branch line 457), plus audit: grep `added to collection` across `src/` |
| PERF-01 | `src/services/perf.js` (NEW), `src/main.js` (lazy import via `requestIdleCallback`) |
| PERF-02 | `lighthouserc.cjs` (NEW at root), `package.json` (scripts + devDep) |
| PERF-03 | `.planning/perf-baseline-v1.0.md` (NEW committed artefact) |
| SCHEMA-01 | `src/db/schema.js` (append v6, optionally v7), `src/workers/bulk-data.worker.js` (mirror v6 — worker only touches `cards` and `meta`, so this is a minimal update) |
| SCHEMA-02 | `tests/migration-v5-to-v6.test.js` (NEW), `tests/fixtures/v5-snapshots.js` (NEW) |
| SCHEMA-03 | `src/services/migration.js` (NEW), `src/main.js` (call `backupBeforeMigration()` before `db.open()`), `tests/migration-backup.test.js` (NEW) |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view` on research day
- Architecture (migration): HIGH for the pattern (Dexie maintainer-endorsed in #646, #1148), MEDIUM for the exact v6+v7 sequencing without spike (flagged in Open Questions #1)
- Architecture (polish): HIGH — all polish patterns are straightforward CSS/text/localStorage
- Pitfalls: HIGH — every pitfall above is verified in upstream issue trackers, project PITFALLS.md, or direct code inspection
- Validation: HIGH — existing Vitest + fake-indexeddb infrastructure already proven in `tests/schema.test.js`

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days — stack is stable; web-vitals and @lhci/cli rarely change API)
