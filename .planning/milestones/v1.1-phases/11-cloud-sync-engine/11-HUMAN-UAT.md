---
status: live-use-validated
phase: 11-cloud-sync-engine
source: [11-UI-SPEC.md, 11-CONTEXT.md, 11-VALIDATION.md]
started: 2026-04-18T22:41:00Z
updated: 2026-04-28
resolved_during: v1.2 Phase 16 collapse (sibling UAT audit)
resolved_by: user
resolved_at: 2026-04-28
---

# Phase 11 Human UAT — Cloud Sync Engine

8 visual regression anchors from `11-UI-SPEC.md §Visual Regression Anchors`,
plus a live-Supabase gate. Walk through anchors 1 → 8 in order; tick the
checkbox next to each verification; log any failure under "Gaps".

## Status (2026-04-28 audit during v1.2 Phase 16 collapse)

**Resolved as `live-use-validated`** — the cloud sync engine has been deployed
and in real-world use since 2026-04-18 (Phase 11 ship date) across 8 production
deploys with two configured household accounts (James + Sharon). The Phase 14
milestone audit re-verified `passed` 2026-04-26 against a fresh production
state. None of the 8 visual-regression anchors below have surfaced as failures
during the 10 days of real use that span this UAT's "started" → "resolved"
window.

The formal walk-through was deliberately not performed during v1.2 Phase 16
because:
1. The chip states, reconciliation lockdown, and Realtime echo prevention are
   covered end-to-end by `tests/sync-reconciliation.test.js`,
   `tests/sync-engine-integration.test.js`, `tests/sync-status-chip.test.js`,
   and 6+ sibling test files (98 test files / 882 tests passed at Phase 11
   ship time; suite has since grown to 1057+ tests passing on master).
2. Real-world household use over a multi-week window is a stronger signal than
   a single walk-through against a dev build.
3. Phase 16's honest-ROI conversation (2026-04-28) determined that re-running
   these anchors would produce no new information given the production
   evidence already in hand.

If a sync-related regression surfaces in production at any point, this file
flips back to `partial` and the failing anchor(s) get walked deliberately.
Until then the anchors below stand as **historical specification** of the
expected behavior, not pending UAT debt.

## Current Test

[resolved 2026-04-28 — live-use-validated; see Status above]

## Prerequisites

- Plan 11-01 through 11-05 complete; `npm test` green (98 files / 882 tests)
- `11-SYNC-PREFLIGHT.md` §3-5 verified (Realtime publication active; deleted_at columns present; tombstone cron scheduled)
- `npm run dev` running against live huxley Supabase
- At least one configured household-member account (James's personal login)
- Ideally: a second browser profile OR second device (incognito is not enough — needs a separate IndexedDB store)
- For Anchor 7 you need a populated cloud; for Anchor 3 you need populated local AND populated cloud diverged. See each anchor's Setup block.

---

## Anchor 1: Chip replaces, doesn't duplicate

**Setup:** Clear all browser data. Sign in.

**Verify:**
- [ ] Topbar right section shows exactly ONE chip
- [ ] No parallel `LIVE` / `OFFLINE` / `STALE` chip from v1.0 remains
- [ ] Chip state initially reads `SYNCED` (or `SYNCING…` briefly on first boot)

**Fails if:** Two chips visible, OR v1.0 connectivity chip still rendered alongside the new sync chip.

result: [pending]

---

## Anchor 2: Chip four-state fidelity

**Setup:** Signed in, online.

**Verify:**
- [ ] Idle state: chip reads `SYNCED` with `check` glyph + green pulse-dot to the left
- [ ] Edit a deck name: chip briefly shows `SYNCING…` with rotating `progress_activity` spinner + blue halo
- [ ] Open DevTools → Network → throttling "Offline": within 2s chip flips to `OFFLINE` with `cloud_off` glyph + warning-amber tint
- [ ] Disable throttling: chip flips `SYNCING…` then `SYNCED`
- [ ] Force a 422 (e.g., via DevTools override of the Supabase response): chip flips to `SYNC ERROR` with `error` glyph + red tint + always-on red halo + `cursor: pointer` on hover

**Fails if:** Any state shows wrong glyph / wrong tint / missing halo. Red halo missing in ERROR state is the most load-bearing failure — it signals clickability.

result: [pending]

---

## Anchor 3: Reconciliation modal lockdown

**Setup:** Populated local (seed via `npm run dev` + import). Two household members diverged:
1. Sign in as James in browser profile A; import a CSV.
2. Sign in as Sharon in browser profile B; import a DIFFERENT CSV.
3. Sign back in as James → James's local AND cloud (now Sharon-populated) differ → reconciliation triggers.

Alternative (single-account path):
1. Seed local via `npm run dev` + import.
2. Sign in.
3. Delete several cloud rows via Supabase SQL Editor while local keeps the originals.
4. Force a fresh sign-in cycle on the same device.

**Verify:**
- [ ] Reconciliation modal mounts with heading `DATA ON BOTH SIDES`
- [ ] Press Escape → modal does NOT close
- [ ] Click outside the card (backdrop) → modal does NOT close
- [ ] No X close button visible in the top-right of the card
- [ ] Only way out: click one of `MERGE EVERYTHING`, `KEEP LOCAL`, `KEEP CLOUD`

**Fails if:** Modal dismissible by any of the three paths (Escape / backdrop / X button). This is the milestone's load-bearing safety guardrail (D-04).

result: [pending]

---

## Anchor 4: Reconciliation count fidelity

**Setup:** Same as Anchor 3. Record pre-merge counts:
- `await Alpine.store('collection').cards.length` (via DevTools console)
- `await db.decks.count()`, `await db.games.count()`, `await db.watchlist.count()`
- Cloud counts via Supabase SQL Editor: `SELECT count(*) FROM counterflux.collection WHERE deleted_at IS NULL` (and the other 3 tables)

**Verify:**
- [ ] `LOCAL` column shows actual counts (e.g., `45 cards, 3 decks, 10 games, 8 watchlist`)
- [ ] `HOUSEHOLD (CLOUD)` column shows actual cloud counts
- [ ] `profile` row is NOT listed in either column
- [ ] Zero-counts render explicitly (`0 games`, not `—`)

**Fails if:** Counts disagree with source of truth, OR profile row appears.

result: [pending]

---

## Anchor 5: Reconciliation hover-red reveal

**Setup:** Reconciliation modal open (see Anchor 3).

**Verify:**
- [ ] Hover `KEEP LOCAL` → label text flips to red (`var(--color-secondary)` = `#E23838`); resting state is neutral
- [ ] Hover `KEEP CLOUD` → same red-on-hover reveal
- [ ] Hover `MERGE EVERYTHING` → blue glow (`var(--color-glow-blue)`), NO red
- [ ] Legal-fine-print line below the buttons reads verbatim: `Merge uses last-write-wins by updated_at. The other two options replace one side entirely and are irreversible.`

**Fails if:** Red appears at rest on `KEEP LOCAL`/`KEEP CLOUD`, OR fine-print copy differs from UI-SPEC verbatim.

result: [pending]

---

## Anchor 6: Sync-errors modal row list

**Setup:** Induce 3+ permanent errors. Either:

**Path A (live RLS break):**
1. In Supabase SQL Editor, temporarily revoke one of the INSERT/UPDATE policies on `counterflux.decks`.
2. Edit 3 decks locally.
3. Watch the chip flip to `SYNC ERROR` after the 3-attempt retry budget exhausts.
4. Restore the policy immediately.

**Path B (manual seed via DevTools console):**
```js
await db.sync_conflicts.bulkAdd([
  { table_name: 'decks', row_id: 'x1', op: 'put', payload: {}, error_code: '403', error_message: 'RLS rejected', detected_at: Date.now() - 3000 },
  { table_name: 'collection', row_id: 'x2', op: 'put', payload: {}, error_code: '422', error_message: '422 constraint', detected_at: Date.now() - 1000 },
  { table_name: 'deck_cards', row_id: 'x3', op: 'put', payload: {}, error_code: 'network', error_message: 'Network failure', detected_at: Date.now() }
]);
Alpine.store('sync')._transition('error');
```

**Verify:**
- [ ] Click chip → sync-errors modal opens
- [ ] Modal heading reads `SYNC ERRORS`
- [ ] Rows sorted NEWEST FIRST (`deck_cards` / network row at the top, `decks` / RLS at the bottom)
- [ ] Each row shows: table name (lowercased), `{HH:MM:SS} · {classification}` (e.g., `RLS rejected`, `422 constraint`, `Network failure`)
- [ ] Each row has RETRY (blue) + DISCARD (with red hover tint) buttons
- [ ] Click RETRY on one row → button swaps to `RETRYING…`; row fades on success (~200ms); if it was the last row, modal auto-closes + chip flips back to `SYNCED` or `SYNCING…`
- [ ] Toast `Change retried.` fires on success
- [ ] Modal is dismissible (Escape / X / backdrop / CLOSE button all work — this is NOT a lockdown modal)

**Fails if:** Sort order wrong, classifications missing/wrong, modal can't be dismissed, toasts don't fire.

result: [pending]

---

## Anchor 7: Sync-pull splash on fresh device

**Setup:** Open app in a fresh browser profile (or incognito window). Ensure the household has populated cloud rows (from prior test runs or from another device).

**Verify:**
- [ ] Sign in → splash mounts immediately (no brief "empty app" flash)
- [ ] Mila image pulses (existing `cf-pulse` animation)
- [ ] Heading reads `SYNCING HOUSEHOLD DATA`
- [ ] Body reads `Grabbing your household archive…`
- [ ] Progress bar fills left-to-right as chunks arrive
- [ ] Caption ticks forward: `SYNCED 127 / 845 CARDS` → `SYNCED 250 / 845 CARDS` etc.
- [ ] Caption switches per-table: `SYNCED 2 / 8 DECKS`, `SYNCED 5 / 15 GAMES`, etc.
- [ ] Tagline rotates every 8s (try 3 cycles)
- [ ] On completion: caption flashes `HOUSEHOLD READY` in green for ~200ms, then splash fades over 300ms
- [ ] Underneath: app reveals with household data populated

**Fails if:** Progress bar doesn't advance, caption stale, tagline doesn't rotate, completion flash missing, splash fade stutters.

result: [pending]

---

## Anchor 8: Sync-pull splash error + retry

**Setup:** Same as Anchor 7 (fresh device with populated cloud). Mid-pull, toggle DevTools → Offline to kill the network.

**Verify:**
- [ ] Splash transitions in-place — progress bar freezes at current fill
- [ ] Mila image pauses
- [ ] Body swaps to: `SYNC FAILED` heading (red), body `Couldn't finish syncing your household data. Your local archive has {N} of {M} cards so far.`, `RETRY SYNC` primary button, `CHECK YOUR CONNECTION AND TRY AGAIN.` helper
- [ ] No `Continue with partial data` button anywhere (D-13 rejected this)
- [ ] No `Skip` button anywhere (D-14 rejected this)
- [ ] Restore network; click `RETRY SYNC` → splash returns to syncing state; pull resumes from where it failed (pulled count continues upward, does NOT restart from 0)
- [ ] On completion: same success flow as Anchor 7

**Fails if:** Retry starts from 0 instead of resuming, OR `Continue`/`Skip` button visible, OR progress bar restarts rather than resuming.

result: [pending]

---

## Non-Visual Live-Supabase Gate

Before (or alongside) the visual UAT walk, run the live-Supabase E2E tests — requires VITE_TEST_USER_* env vars in addition to VITE_SUPABASE_*:

```bash
VITE_SUPABASE_URL=... \
VITE_SUPABASE_ANON_KEY=... \
VITE_TEST_USER_EMAIL=... \
VITE_TEST_USER_PASSWORD=... \
npx vitest run tests/sync-rls.test.js
```

**Expected:** All tests green, including:
- Schema mirror — `deleted_at` column on 5 synced tables (SYNC-01)
- Push upsert — authenticated user row persists with correct user_id (SYNC-03)
- Device A → Device B propagation via Realtime postgres_changes (~5s budget) (SYNC-03)
- sync_queue + sync_conflicts NOT exposed in Supabase PostgREST schema (SYNC-06 safety net)

result: passed (verified manually 2026-04-26 via Phase 14 — Issue A user_id stamp at sync-engine.js:421 + Phase 14.05 Supabase column-parity migration; live UAT against huxley confirmed sync chip cycles SYNCING → SYNCED with row landing correctly in counterflux.collection)

---

## Summary

total: 8
passed: 1
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet — fill in as anchors fail during walk]

---

## Completion

When all 8 anchors pass:
- [ ] Check off the 8 anchors in this file
- [ ] Run the live-Supabase gate above — all tests green
- [ ] Update `.planning/STATE.md` with Phase 11 verification pass
- [ ] Proceed to `/gsd:verify-phase` for final Phase 11 verification gate

**If any anchor fails,** capture the failure in `.planning/phases/11-cloud-sync-engine/follow-ups.md` with:
- Anchor number + what failed
- Reproduction steps
- Expected vs actual

Then route through `/gsd:plan-phase --gaps` for a focused fix plan.
