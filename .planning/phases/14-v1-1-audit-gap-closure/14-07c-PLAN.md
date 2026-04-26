---
plan: 14-07c
phase: 14
type: gap_closure
wave: 1
depends_on: []
requirements: [SYNC-03, MARKET-01, COLLECT-02]
files_modified:
  - src/services/sync-reconciliation.js
  - src/stores/auth.js
  - src/services/precons.js
  - src/components/precon-browser.js
  - src/stores/collection.js
  - tests/sync-reconciliation.test.js
  - tests/precons.test.js
autonomous: true
gap_closure: true
must_haves:
  - reconcile() guards by per-user `sync_reconciled_at:<userId>` meta key so signing in/out with the same account does NOT re-prompt the modal
  - Different account on the same device gets a fresh prompt (per-user keys segregate naturally)
  - Multi-deck bundle precons (Doctor Who, Final Fantasy, etc.) split into individual virtual decks in the precon-browser drill view, grouped by commander color identity
  - Collection store gains addCardsFromIds(scryfallIds, { label }) so a virtual deck can land in the collection without dumping the whole bundle
---

# Plan 14-07c: Per-user reconcile guard + multi-deck bundle splitting

## Context

User feedback after 14-07b shipped:

1. **Reconciliation modal still asks every login** — 14-07b stored a single device-wide flag and cleared it on signOut, so every sign-in re-prompted. Wrong UX.
2. Upcoming Releases sort — pass.
3. **Browsing precons shows multiple commander decks bundled** — user wants individual deck entries; previous interpretation `(intended)` was inverted.

## Tasks

<task id="1" type="auto">
  <name>Per-user reconcile flag (`sync_reconciled_at:<userId>`)</name>
  <read_first>
    <file>src/services/sync-reconciliation.js</file>
    <file>src/stores/auth.js</file>
    <file>tests/sync-reconciliation.test.js</file>
  </read_first>
  <action>
    `src/services/sync-reconciliation.js`:
    - Replace `RECONCILED_META_KEY` with `RECONCILED_META_KEY_PREFIX = 'sync_reconciled_at:'`.
    - `_isReconciled(userId)` and `_markReconciled(userId)` accept a userId and read/write `prefix + userId`. Bail out when userId is falsy.
    - `reconcile()` reads `userId` once at top via the existing `_currentUserId()` helper and threads it through.
    - Remove the duplicate `_currentUserId` definition I added in 14-07b — the file already has one (single source of truth).

    `src/stores/auth.js` `signOut()`:
    - Delete the 14-07b's `db.meta.delete('sync_reconciled_at')` block. Per-user keying segregates naturally; no clearing needed.

    Tests in `tests/sync-reconciliation.test.js`:
    - Replace the 14-07b describe block with a 14-07c block exercising:
      - Same user re-reconcile → modal fires once, second call is no-op.
      - empty-empty path stamps the flag with the user-specific key.
      - Different user (pre-seeded `sync_reconciled_at:other-user-zzz`) → still prompted on first reconcile because the current user has no flag of their own.
  </action>
  <verify>
    <automated>
      npx vitest run tests/sync-reconciliation.test.js
    </automated>
    <expected>14 passed (was 13; net +1 with the new "different user gets a fresh prompt" case after replacing 14-07b's 2 tests with 3 14-07c tests).</expected>
  </verify>
  <done>
    Sign in/out with the same account → modal does NOT re-fire. Different account on the same device → modal fires once, then quiets.
  </done>
  <acceptance_criteria>
    - `grep -c "sync_reconciled_at:" src/services/sync-reconciliation.js` returns at least 1 (prefix declaration)
    - `grep -c "_markReconciled(userId)" src/services/sync-reconciliation.js` returns at least 4 (4 stamp sites)
    - `grep -c "sync_reconciled_at" src/stores/auth.js` returns 0 (no clearing on signOut)
    - 3 new tests under `Phase 14.07c: per-user sync_reconciled_at one-shot reconciliation`
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Multi-deck bundle splitter — virtual decks by commander color identity</name>
  <read_first>
    <file>src/services/precons.js</file>
    <file>src/components/precon-browser.js</file>
    <file>src/stores/collection.js</file>
    <file>tests/precons.test.js</file>
  </read_first>
  <action>
    `src/services/precons.js`:
    - Extend the decklist row shape during `fetchPreconDecklist()` to capture `name`, `color_identity`, `type_line` (used by the splitter and the tile rendering).
    - Add `splitPreconIntoDecks(precon)` — heuristic that groups commanders by colorless-stable color_identity signature and assigns each non-commander card to the first matching commander group whose color identity is a subset. Caps at 99 supporters per Commander format. Returns `[]` when the cache lacks the new metadata so callers fall back to the legacy MULTI-DECK gate.

    `src/components/precon-browser.js`:
    - Import + window-expose `splitPreconIntoDecks` alongside the existing `isMultiDeckBundle`.
    - In VIEW B, add `selectedVirtualDeckKey` state + `virtualDecks`, `selectedVirtualDeck`, `effectiveDecklist`, `effectiveTitle`, `effectiveAddAllEnabled`, `addAllEffective()` getters/methods.
    - Render a virtual-deck tile grid when `isBundle && !selectedVirtualDeck && virtualDecksAvailable`.
    - Drill into a tile → decklist preview filters to that deck → ADD ALL adds only that deck.
    - The legacy MULTI-DECK gate now only fires when the cache predates 14-07c (no metadata to split on); copy points users at the REFRESH button.

    `src/stores/collection.js`:
    - Add `addCardsFromIds(scryfallIds, { label })` mirroring `addAllFromPrecon`'s atomic transaction shape but operating on an arbitrary card-id list. Used by the virtual-deck add path.

    Tests in `tests/precons.test.js`:
    - 5 new tests for `splitPreconIntoDecks`: returns `[]` on legacy-cache decklists, returns `[]` when no commanders present, groups by color identity with subset-match supporters, bundles partner commanders that share an identity into a single deck, caps at 100 cards (1 commander + 99 supporters).
  </action>
  <verify>
    <automated>
      npx vitest run tests/precons.test.js
    </automated>
    <expected>19 passed (was 14; +5 splitPreconIntoDecks regressions).</expected>
  </verify>
  <done>
    User opens a multi-deck product (Doctor Who, Final Fantasy, etc.), sees a tile grid of individual decks, clicks one, sees that deck's cards, can ADD ALL just that deck.
  </done>
  <acceptance_criteria>
    - `grep -c "splitPreconIntoDecks" src/services/precons.js` returns at least 2 (declaration + JSDoc)
    - `grep -c "splitPreconIntoDecks" src/components/precon-browser.js` returns at least 2 (import + window export)
    - `grep -c "addCardsFromIds" src/stores/collection.js` returns at least 1
    - `grep -c "selectedVirtualDeckKey" src/components/precon-browser.js` returns at least 3 (state + getter + tile click)
    - 5 new tests under `Phase 14.07c: splitPreconIntoDecks helper`
  </acceptance_criteria>
</task>

## Verification

The reconcile guard is a pure data change with thorough test coverage. The bundle splitter is heuristic but visible — users see exactly which cards land in each virtual deck and can choose to discard via undo if the heuristic misclassifies. Existing precons keep their cache and behave unchanged until refreshed.

## Deviations

- **No live UAT for the bundle splitter.** The heuristic-correctness question (does this actually map cards to the right decks for real WotC products?) requires comparing against published deck lists for ~6 products. Not in scope; the user can REFRESH a known bundle and eyeball whether the split looks right post-deploy.
- **Existing precon caches won't immediately benefit from the splitter** — the new metadata is only captured on next fetch. The legacy MULTI-DECK gate copy now mentions the REFRESH button as the unlock path.
