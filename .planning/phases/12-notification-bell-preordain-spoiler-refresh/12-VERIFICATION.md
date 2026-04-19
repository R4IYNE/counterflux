---
phase: 12-notification-bell-preordain-spoiler-refresh
verified: 2026-04-19T00:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 12: Notification Bell + Preordain Spoiler Refresh — Verification Report

**Phase Goal:** Ship the notification bell badge + popover inbox, the spoiler gallery redesign (sectioned grid, day headers, NEW badges, hover preview), and the hover-reveal watchlist bookmark — turning Preordain into a first-class spoiler command centre.
**Verified:** 2026-04-19
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                 | Status     | Evidence                                                                                     |
|----|---------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------|
| 1  | `market.unifiedBadgeCount` returns `syncErrorCount + alertBadgeCount`                | VERIFIED   | Getter at `src/stores/market.js:32`; 2 unit tests pass in `describe('phase 12 additions')`  |
| 2  | `market.groupedSpoilerCards` groups cards by `released_at` descending, `unknown` last | VERIFIED   | Getter at `src/stores/market.js:40`; 3 tests cover empty/grouping/unknown bucket            |
| 3  | `market._pollSyncErrors` polls `db.sync_conflicts.count()` every 2s when authed       | VERIFIED   | Method at `market.js:82`; polled from `init()` at line 67; 3 tests cover auth-gate + error  |
| 4  | Bell badge reads from `market.unifiedBadgeCount` (not legacy `alertBadgeCount`)       | VERIFIED   | `notification-bell-popover.js:34-35` — `x-show` + `x-text` bind to `unifiedBadgeCount`      |
| 5  | Bell click opens a 320px popover dismissible via click-outside and Escape             | VERIFIED   | `notification-bell-popover.js:42-47` — `x-cloak`, `x-transition`, `@click.outside`, `@keydown.escape.window` with open-guard |
| 6  | Popover SYNC ERRORS section calls `window.openSyncErrorsModal()`                      | VERIFIED   | `notification-bell-popover.js:54,69` — gated on `syncErrorCount > 0`; click handler present |
| 7  | Popover PRICE ALERTS section navigates to `/preordain` + sets watchlist tab           | VERIFIED   | `notification-bell-popover.js:77,103` — `navigate('/preordain')` + `setTab('watchlist')`   |
| 8  | Popover shows "All clear" empty state when `unifiedBadgeCount === 0`                  | VERIFIED   | `notification-bell-popover.js:112,118` — `x-show="...=== 0"` with literal `All clear`      |
| 9  | Dead `handleNotifications()` removed from `topbar.js`                                 | VERIFIED   | `grep "handleNotifications" src/components/topbar.js` exits 1 — no matches                  |
| 10 | Spoiler gallery renders cards in `released_at` sections with day headers              | VERIFIED   | `spoiler-gallery.js:138-148` — `x-for="group in $store.market.groupedSpoilerCards"` + `formatReleaseDate(group.date) + ' • ' + group.cards.length + ' CARDS'` |
| 11 | Grid uses fixed `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (D-06 enforced)          | VERIFIED   | `spoiler-gallery.js:128,153` — confirmed; `2xl:grid-cols-6` absent (grep exits 1)           |
| 12 | Each tile has hover-reveal bookmark button with `is-watching` persistent state        | VERIFIED   | `spoiler-gallery.js:176-182` — `.cf-spoiler-bookmark`, `:class="{'is-watching': isWatching}"`, glyph swap `bookmark_add` / `bookmark` |
| 13 | Hover preview shows `card.image_uris.normal` at 250px, flips left near right edge    | VERIFIED   | `spoiler-gallery.js:221-226` — `cf-hover-preview`, `flipLeft`, `window.innerWidth`, `270`; DFC fallback `card.card_faces?.[0]?.image_uris?.normal` |
| 14 | Set-filter dropdown uses `renderSpoilerSetFilter()` with Keyrune icons                | VERIFIED   | `spoiler-gallery.js:21,51` — import + `${renderSpoilerSetFilter()}` interpolation           |
| 15 | No toast dispatched on bookmark click (D-10)                                          | VERIFIED   | `grep "toast" src/components/spoiler-gallery.js` exits 1 — no matches                       |
| 16 | NEW badge (48h window) preserved on spoiler tiles                                     | VERIFIED   | `spoiler-gallery.js:197-198` — `isNew(card.released_at)` + `badge-new`                     |
| 17 | Bell mount wired in `index.html` + `main.js` injects before `Alpine.start()`         | VERIFIED   | `index.html:346` — mount div present; `main.js:26,93-95` — import + pre-start injection    |
| 18 | CSS new classes in reduced-motion block                                               | VERIFIED   | `main.css:198-199` — `.cf-spoiler-bookmark` and `.cf-hover-preview` inside merged `@media (prefers-reduced-motion: reduce)` block; `.cf-bell-popover` also present at line 200 |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact                                          | Expected                                              | Status     | Details                                                              |
|---------------------------------------------------|-------------------------------------------------------|------------|----------------------------------------------------------------------|
| `src/stores/market.js`                            | `unifiedBadgeCount`, `groupedSpoilerCards`, `syncErrorCount`, polling methods | VERIFIED | All 5 identifiers present (lines 25, 32, 40, 67, 82, 98, 252)     |
| `tests/market-store.test.js`                      | 8 new tests in `describe('phase 12 additions')`       | VERIFIED   | `describe('phase 12 additions'` + all 8 `it(...)` identifiers found  |
| `src/components/spoiler-set-filter.js`            | `renderSpoilerSetFilter()` with Keyrune dropdown      | VERIFIED   | Exports function; all 8 structural assertions satisfied in test file |
| `tests/spoiler-set-filter.test.js`                | 8 tests for the custom dropdown                       | VERIFIED   | 8 `it()` blocks confirmed                                            |
| `src/components/notification-bell-popover.js`     | `renderNotificationBellPopover()` returning popover   | VERIFIED   | Export present; all 10 structural strings verified via grep         |
| `tests/notification-bell-popover.test.js`         | 10 tests for popover                                  | VERIFIED   | 10 `it()` blocks confirmed                                           |
| `src/components/topbar.js`                        | `handleNotifications` removed; only `handleSearch` remains | VERIFIED | grep exits 1 on `handleNotifications`; `handleSearch` present at line 17 |
| `index.html`                                      | Mount point `id="cf-notification-bell-mount"`         | VERIFIED   | Present at line 346                                                  |
| `src/main.js`                                     | Import + pre-start injection of `renderNotificationBellPopover` | VERIFIED | Lines 26, 93-95                                                  |
| `src/styles/main.css`                             | `.cf-bell-popover`, `.cf-spoiler-bookmark`, `.cf-hover-preview` — including in reduced-motion block | VERIFIED | All three classes present in both standalone definition and reduced-motion selector list |
| `src/components/spoiler-gallery.js`               | Rewritten with sectioned grid, bookmark, hover preview, set-filter import | VERIFIED | 52 → 187 lines; all required identifiers present                  |
| `tests/spoiler-gallery.test.js`                   | 11 tests for gallery rewrite                          | VERIFIED   | 11 `it()` blocks confirmed                                           |

---

### Key Link Verification

| From                                    | To                                   | Via                                              | Status   | Details                                                                 |
|-----------------------------------------|--------------------------------------|--------------------------------------------------|----------|-------------------------------------------------------------------------|
| `src/stores/market.js`                  | `db.sync_conflicts`                  | `db.sync_conflicts.count()` in `_pollSyncErrors` | WIRED    | Lines 91, 261 — both interval body and `__tickSyncErrorPoll` helper     |
| `src/stores/market.js`                  | `Alpine.store('auth')`               | Auth gate resets `syncErrorCount` to 0 on sign-out | WIRED  | Line 23 comment + inline auth check in polling body at lines 86-88     |
| `src/components/spoiler-set-filter.js`  | `$store.market.sets`                 | `x-for="set in $store.market.sets"` loop         | WIRED    | Lines 59, 63 — iteration + `loadSpoilers` call                          |
| `src/components/spoiler-set-filter.js`  | `$store.market.loadSpoilers`         | `@click` on each option button                   | WIRED    | Line 63 — `$store.market.loadSpoilers(set.code); open = false`         |
| `src/components/notification-bell-popover.js` | `$store.market.unifiedBadgeCount` | `x-show` + `x-text` badge binding              | WIRED    | Lines 34-35 and 112 — badge + empty-state both reference getter        |
| `src/components/notification-bell-popover.js` | `window.openSyncErrorsModal`     | VIEW SYNC ERRORS click handler                   | WIRED    | Line 69                                                                 |
| `src/components/notification-bell-popover.js` | `$store.market.setTab`           | GO TO WATCHLIST click handler                    | WIRED    | Line 103                                                                |
| `index.html`                            | `src/main.js` → `notification-bell-popover.js` | Mount div + pre-start injection        | WIRED    | `index.html:346`, `main.js:26,93-95`                                   |
| `src/components/spoiler-gallery.js`     | `src/components/spoiler-set-filter.js` | `import { renderSpoilerSetFilter }` + interpolation | WIRED | Lines 21, 51                                                       |
| `src/components/spoiler-gallery.js`     | `$store.market.groupedSpoilerCards`  | `x-for="group in $store.market.groupedSpoilerCards"` | WIRED | Lines 138, 140                                                    |
| `src/components/spoiler-gallery.js`     | `$store.market.addToWatchlist / removeFromWatchlist` | Bookmark `@click.stop` handler    | WIRED    | Line 180                                                                |
| `src/components/spoiler-gallery.js`     | `$store.market.watchlist`            | `isWatching` getter via `.some()`                | WIRED    | Lines 160-162                                                           |

---

### Data-Flow Trace (Level 4)

| Artifact                                | Data Variable           | Source                                        | Produces Real Data | Status    |
|-----------------------------------------|-------------------------|-----------------------------------------------|--------------------|-----------|
| `notification-bell-popover.js`          | `unifiedBadgeCount`     | `market.js` getter sums `syncErrorCount` (polled from `db.sync_conflicts`) + `alertBadgeCount` (from `checkAlerts()`) | Yes — Dexie count() + DB alerts | FLOWING |
| `notification-bell-popover.js`          | `pendingAlerts`         | `market.checkAlerts()` populates from watchlist DB + Scryfall prices | Yes                | FLOWING   |
| `spoiler-gallery.js`                    | `groupedSpoilerCards`   | `market.js` getter derives from `spoilerCards` which is loaded by `loadSpoilers(setCode)` via Scryfall API | Yes — API + Alpine reactivity | FLOWING |
| `spoiler-gallery.js`                    | `watchlist`             | `market.addToWatchlist()` / `removeFromWatchlist()` read/write `db.watchlist` Dexie table | Yes                | FLOWING   |

---

### Behavioral Spot-Checks

Step 7b SKIPPED — Phase 12 is a pure UI composition phase (Alpine templates + CSS + store getters). No runnable CLI entry points or API routes to spot-check; all assertions covered by the TDD unit test suites. Manual UAT checklist is provided under Human Verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                               | Status    | Evidence                                                                 |
|-------------|-------------|-------------------------------------------------------------------------------------------|-----------|--------------------------------------------------------------------------|
| SYNC-08     | 12-01, 12-03 | Notification bell surfaces sync errors alongside price alerts; badge unifies sources     | SATISFIED | `market.unifiedBadgeCount` getter (Plan 01) + popover with SYNC ERRORS section (Plan 03); REQUIREMENTS.md line 92 marked `[x]` |
| MARKET-01   | 12-02, 12-04 | Set filter dropdown renders each option with Keyrune set icon, name, and card count      | SATISFIED | `renderSpoilerSetFilter()` ships Keyrune `<i class="ss ss-fallback">` per option; wired into `spoiler-gallery.js:51`. NOTE: REQUIREMENTS.md line 57 shows `- [ ]` (unchecked) — documentation lag, not a code gap. The component is fully implemented and wired. |
| MARKET-02   | 12-01, 12-04 | Spoiler browser redesigned with larger tiles, day/section headers, NEW badges, hover preview | SATISFIED | `spoiler-gallery.js` iterates `groupedSpoilerCards`; day headers format `MMM DD, YYYY • N CARDS`; 250px hover overlay; `badge-new` preserved; fixed `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. REQUIREMENTS.md line 58 marked `[x]` |
| MARKET-03   | 12-04        | Spoiler tiles surface a quick-add watch button calling `addToWatchlist()` without toast  | SATISFIED | `.cf-spoiler-bookmark` hover-reveal button with `addToWatchlist`/`removeFromWatchlist` handlers; no toast reference in file. REQUIREMENTS.md line 59 marked `[x]` |

**Orphaned requirements:** None. All four Phase 12 requirement IDs appear in plan frontmatter and are accounted for above.

**REQUIREMENTS.md documentation note:** MARKET-01 checkbox is `- [ ]` (line 57) while MARKET-02 and MARKET-03 are `- [x]`. This is a documentation lag — MARKET-01's implementation in `spoiler-set-filter.js` and its wiring in `spoiler-gallery.js` are fully verified in code. The checkbox should be ticked.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODO/FIXME/placeholder/stub patterns found across phase 12 modified files | — | — |

Scanned files: `src/stores/market.js`, `src/components/spoiler-set-filter.js`, `src/components/notification-bell-popover.js`, `src/components/spoiler-gallery.js`, `src/styles/main.css`, `src/components/topbar.js`, `src/main.js`.

All data bindings in the new templates source from real Alpine store getters or card fields. No hardcoded empty arrays or placeholder text found. The Plan 04 summary explicitly documents a "Known Stubs: None" scan result.

---

### Human Verification Required

These items cannot be verified programmatically and require loading the app in a browser:

**1. Notification Bell Popover — open/close UX**
- **Test:** Click the bell icon in the topbar.
- **Expected:** A 320px popover appears below-right. Click anywhere outside — popover closes. Press Escape — popover closes.
- **Why human:** Alpine `x-show` + click-outside + keyboard dismiss require a live DOM environment.

**2. Notification Bell — SYNC ERRORS section visible when errors exist**
- **Test:** Trigger a sync conflict (or manually set `Alpine.store('market').syncErrorCount = 3` in devtools). Open bell.
- **Expected:** "SYNC ERRORS — 3 operations failed" section appears. Click "VIEW SYNC ERRORS →" — Phase 11 sync errors modal opens.
- **Why human:** Requires live Alpine reactivity + Phase 11 modal integration.

**3. Notification Bell — PRICE ALERTS section and navigation**
- **Test:** With a watchlist card whose price has dropped below threshold, open bell. Click "GO TO WATCHLIST →".
- **Expected:** Browser navigates to `/preordain` and the Preordain screen opens on the Watchlist tab.
- **Why human:** Navigo routing + tab switch requires live browser navigation.

**4. Spoiler Gallery — sectioned layout with day headers**
- **Test:** Open Preordain, select a set from the keyrune dropdown.
- **Expected:** Cards appear in reverse-chronological sections. Each section has a ghost-border divider above a mono-font header in format `APR 18, 2026 • 12 CARDS`.
- **Why human:** Visual rendering of section layout and font/colour tokens requires browser.

**5. Spoiler Gallery — hover preview and viewport-edge flip**
- **Test:** Hover a card tile near the right edge of the viewport.
- **Expected:** A 250px card image preview appears to the LEFT of the tile (not the right), because `flipLeft` triggers when `window.innerWidth - rect.right < 270`.
- **Why human:** Requires actual viewport geometry computation.

**6. Spoiler Gallery — bookmark hover-reveal and watchlist toggle**
- **Test:** Hover a tile not on watchlist — bookmark icon appears top-left (opacity 0 → 1). Click it — icon switches to filled `bookmark`, stays visible after mouse leaves. Click again — returns to `bookmark_add` and fades out.
- **Why human:** CSS transition + Alpine reactivity + Dexie write requires live app.

**7. Keyrune set-filter dropdown — icon rendering**
- **Test:** Open the set-filter dropdown in Preordain.
- **Expected:** Each option shows a Keyrune glyph (set icon) alongside the set name and card count `(N)`. Unknown set codes fall back to the planeswalker glyph (ss-fallback).
- **Why human:** Keyrune CSS font must be loaded; browser required to render glyphs.

**8. MARKET-01 checkbox in REQUIREMENTS.md**
- **Action:** Tick `- [x]` for MARKET-01 at line 57 of `.planning/REQUIREMENTS.md` — the implementation is verified in code.
- **Why human:** REQUIREMENTS.md is a tracked planning artifact; updating it is a deliberate authoring step.

---

### Gaps Summary

No gaps found. All 18 observable truths are verified. All 12 artifacts exist, are substantive, and are wired. All 4 requirement IDs have confirmed implementation evidence. No blocker anti-patterns detected.

The only open item is a documentation lag: MARKET-01's checkbox in `REQUIREMENTS.md` is unchecked (`- [ ]`) despite the implementation being fully delivered and wired. This is a planning-document update, not a code gap.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
