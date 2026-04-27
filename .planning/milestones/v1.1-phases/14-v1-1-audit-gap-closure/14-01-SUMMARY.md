---
plan: 14-01
phase: 14
status: complete
completed: 2026-04-26
type: gap_closure
---

# Plan 14-01 Summary — Sync push user_id stamp (audit Issue A)

## What was built

Single-line spread-and-stamp fix at `src/services/sync-engine.js:421` plus a 4-case Vitest regression suite that locks down the contract.

```js
// Before — Issue A: payloads reached Supabase with user_id null
const rows = Array.from(latestByRow.values()).map(e => e.payload);
// After — spread first, then stamp; client is authoritative on user_id at push time
const rows = Array.from(latestByRow.values()).map(e => ({ ...e.payload, user_id: currentUserId }));
```

`tests/sync-push-userid.test.js` (215 lines, 4 cases) asserts `payload.user_id === currentUserId` on every upsert and exercises:
1. Fresh push — payload arrives with `user_id` populated
2. Stale payload — any pre-existing `user_id` value is overwritten by current
3. Cross-user safety — payloads carrying a different user's id are corrected
4. Anonymous block — `flushQueue` short-circuits when `currentUserId` is null

## Live UAT outcome

UAT was attempted on 2026-04-22. The 14-01 fix was working — `user_id` reached the server cleanly. The UAT exposed a **second** latent Phase 11 bug: schema drift between the local Dexie store payloads and the Supabase `counterflux.*` tables. PGRST204 fired on `deck_cards.sort_order` (and would have fired on 13 other columns once that one was patched). 848 dead-letter `sync_conflicts` entries from the pre-fix era confirmed the scale.

That second bug was scoped into Plan 14-05 (Supabase column-parity migration). After the migration landed and the auth-wall stale-static bug (14-06) was patched, the live UAT was retried on 2026-04-26 and went green:

- Sync chip cycled `SYNCING…` → `SYNCED` (no `SYNC ERROR`)
- Lightning Bolt row landed in `counterflux.collection` with `user_id` matching `auth.uid()`
- `db.sync_conflicts.count()` stayed at 0
- Phase 11 reconciliation modal correctly surfaced `populated-populated` (1 deck on each side via shared household); MERGE EVERYTHING converged cleanly

`11-HUMAN-UAT.md` Non-Visual Live-Supabase Gate flipped from `result: [pending]` → `result: passed (verified 2026-04-26 via Phase 14)`. UAT frontmatter `status: pending` → `status: partial` (1 of 8 anchors passed; 7 visual anchors remain for a future UAT pass — out of Phase 14 scope).

## Status

**Complete.** All 3 tasks landed:
1. RED test ✓ (commit `62d1f5a`)
2. GREEN fix ✓ (commit `3e57df1`)
3. Live UAT + Phase 11 HUMAN-UAT annotation ✓ (this commit)

## Files touched

- `src/services/sync-engine.js` — line 421 (spread-and-stamp)
- `tests/sync-push-userid.test.js` — new, 215 lines, 4 cases
- `.planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md` — frontmatter `status` flipped + Live-Supabase Gate `result: passed` + summary counts updated

## Self-Check

- [x] RED → GREEN → CHECKPOINT progression honoured
- [x] All 4 test cases passing (`npx vitest run tests/sync-push-userid.test.js` exits 0)
- [x] No regression in `tests/sync-engine-*.test.js` suite (25/25 passing post-fix)
- [x] Full `npm test` green (1019/1019 passing pre-UAT)
- [x] Live UAT verified end-to-end (sync chip + Supabase row + 0 sync_conflicts)
- [x] HUMAN-UAT.md flipped with dated retroactive annotation referencing 14-05 (the parallel migration that unblocked the actual UAT)

## Deviations

- **UAT delay.** The 14-01 code fix was ready on 2026-04-22 but the live UAT couldn't pass until 14-05 (schema drift) and 14-06 (auth-wall stale element) were also fixed. UAT closed on 2026-04-26 instead.
- **`updated:` timestamp jumped 8 days.** Phase 11 HUMAN-UAT frontmatter `updated:` field bumped from 2026-04-18 to 2026-04-26 to match the actual flip date — that's fine, the Phase 11 UAT was paused awaiting external work.
