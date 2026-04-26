---
plan: 14-07c
phase: 14
status: complete
completed: 2026-04-26
type: gap_closure
---

# Plan 14-07c Summary — Per-user reconcile guard + bundle splitter

## What was built

### 1. Per-user reconciliation guard (`sync_reconciled_at:<userId>`)

`src/services/sync-reconciliation.js`:
- `RECONCILED_META_KEY_PREFIX = 'sync_reconciled_at:'`
- `_markReconciled(userId)` / `_isReconciled(userId)` — accept user id, write/read `prefix + userId`. Bail when userId falsy.
- `reconcile()` reads `userId = _currentUserId()` once at top, threads through all stamp sites.
- Removed the duplicate `_currentUserId` declaration introduced in 14-07b — file already had one at line 314 (single source of truth restored).

`src/stores/auth.js` `signOut()`:
- Removed the `db.meta.delete('sync_reconciled_at')` block from 14-07b. Per-user keying segregates naturally — same account re-login keeps the flag, new account on the same device gets a fresh prompt.

The 14-07b implementation was wrong on the same-account-relogin path: it stored a single device-wide flag and cleared it on signOut, so every login re-prompted. 14-07c keys by user id to fix that.

### 2. Multi-deck bundle splitter (Doctor Who / Final Fantasy / etc.)

`src/services/precons.js`:
- `fetchPreconDecklist()` now captures `name`, `color_identity`, `type_line` per card so the splitter has data to work with.
- New `splitPreconIntoDecks(precon)` heuristic:
  1. Group commanders by colorless-stable color identity signature.
  2. For each commander group, gather non-commander cards whose color_identity is a subset of the group's identity.
  3. Cap at 99 supporters (Commander format = 100 total per deck including commander).
  4. Sort groups alphabetically for stable rendering.
  5. Returns `[]` when cache predates this metadata so callers fall back to the legacy gate cleanly.

`src/components/precon-browser.js`:
- Imports + window-exposes `splitPreconIntoDecks` alongside `isMultiDeckBundle`.
- VIEW B's x-data scope grew `selectedVirtualDeckKey` state + 6 getters/methods (`virtualDecks`, `virtualDecksAvailable`, `selectedVirtualDeck`, `effectiveDecklist`, `effectiveTitle`, `effectiveAddAllEnabled`, `addAllEffective`).
- New tile-grid template renders one tile per virtual deck (commander name + identity badge + card count) when bundle is splittable and no virtual deck is yet selected.
- Drill-in flow: click a tile → state.selectedVirtualDeckKey → decklist preview filters to that deck → ADD ALL adds only that deck via `collection.addCardsFromIds(ids, { label })`.
- Legacy MULTI-DECK PRODUCT gate now only fires when cache predates 14-07c; copy points users at the REFRESH button as the unlock path.

`src/stores/collection.js`:
- New `addCardsFromIds(scryfallIds, { label })` — atomic transaction-shaped bulk-add for an arbitrary card-id list, mirroring `addAllFromPrecon`'s undo + activity log + toast pattern. Used by the virtual-deck add path so a Doctor Who tile dumps only that deck's ~100 cards into the collection, not the full 1178-card bundle.

## Status

**Complete.** 2 tasks, 8 new regression tests, all green.

## Files touched

- `src/services/sync-reconciliation.js` — per-user keying + dedupe `_currentUserId`
- `src/stores/auth.js` — drop the 14-07b clear-on-signOut block
- `src/services/precons.js` — extend decklist metadata + new `splitPreconIntoDecks` (~80 lines)
- `src/components/precon-browser.js` — virtual-deck tile grid + drill-in state (~80 lines)
- `src/stores/collection.js` — new `addCardsFromIds` (~95 lines)
- `tests/sync-reconciliation.test.js` — replaced 14-07b's 2 tests with 14-07c's 3 per-user tests (net +1)
- `tests/precons.test.js` — 5 new bundle-splitter regressions

## Self-Check

- [x] Same-account re-login no longer re-fires the modal (per-user key persists)
- [x] Different-account-on-same-device gets a fresh prompt (per-user key absent)
- [x] Bundle splitter returns `[]` when cache lacks metadata so legacy gate still works
- [x] Bundle splitter caps each virtual deck at 100 cards (Commander format)
- [x] Partner commanders sharing identity bundle into one deck (Will/Rowan Kenrith case)
- [x] Virtual deck add path uses `addCardsFromIds` so only that deck lands in collection
- [x] 74/74 plan-targeted Phase 14 tests passing across 7 test files

## Deviations

- **Heuristic-correctness UAT deferred.** The splitter's output for real WotC products (Doctor Who 1178 cards across 4 decks, Fallout 1068 across 4, etc.) hasn't been compared against published deck lists. Cards that fit multiple commanders' color identities get assigned to the first matching group — this works for products where decks have distinct color identities (most Commander precons) but produces approximate results for products with overlapping identities. Visible to the user; trivial to undo.
- **Existing precon caches won't auto-benefit.** New metadata only captured on next fetch. REFRESH button (already in the precon browser header) re-fetches. Legacy MULTI-DECK gate copy now mentions REFRESH as the unlock.
- **No new test for sign-out removing the clear logic.** The change is pure deletion of 14-07b's clear block; per-user key tests cover the desired behaviour.
