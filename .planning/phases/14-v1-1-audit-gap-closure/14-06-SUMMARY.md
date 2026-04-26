---
plan: 14-06
phase: 14
status: complete
completed: 2026-04-26
type: gap_closure
---

# Plan 14-06 Summary — Auth-wall stale static element fix

## What was built

6-line fast-path patch in `src/components/auth-wall.js` `closeAuthWall()` plus a regression test (13th test in `tests/auth-wall.test.js`).

When `wallEl` is null (auth rehydrated to `'authed'` before `openAuthWall()` ever ran), the function now also checks for and strips the paint-critical static `<div id="cf-auth-wall">` that `index.html` ships for LCP. Existing behaviour preserved when `wallEl` is set.

## How it surfaced

Plan 14-05's UAT (the column-parity migration retry) couldn't get past the boot screen — user saw bare `COUNTERFLUX` wordmark with no sidebar, no main, no interactive elements. Diagnostic in DevTools showed:
- Splash hidden (`display: none`, `offsetWidth: 0`)
- No reconciliation modal, no sync-pull splash
- Body had 62 KB of HTML, sidebar in `innerText`, main element 1047 px wide
- BUT a stale `<div id="cf-auth-wall">` from index.html was still covering the viewport at `z-index: 90`

`document.getElementById('cf-auth-wall')?.remove()` in DevTools unblocked the user immediately. After that one-liner, the Phase 11 `populated-populated` reconciliation modal correctly surfaced (1 deck on each side via shared household), MERGE EVERYTHING converged cleanly, sync chip cycled `SYNCING → SYNCED`, and the 14-01 UAT could close.

## The race

```
boot → migration → Alpine.start() → auth store created
                                        |
   (rehydrate auth from localStorage — fast path) → status = 'authed' immediately
                                        |
   Alpine.effect() runs syncAuthWall() ─── status === 'authed' → closeAuthWall()
                                        |
   closeAuthWall(): wallEl is null → early return (BUG) → static #cf-auth-wall left covering app
```

Phase 13 Plan 5 Task 6 added the static element for LCP without updating `closeAuthWall()` to handle the rehydrate-fast-path. This was latent until a user with cached auth tokens hit the boot path on a fresh session — which Plan 14-05's UAT was the first run to do.

## Status

**Complete.** Single task, single commit. 13/13 auth-wall tests passing.

## Files touched

- `src/components/auth-wall.js` — `closeAuthWall()` adds the stale-static-strip branch (6 lines plus comment)
- `tests/auth-wall.test.js` — appended regression test under existing `describe('auth-wall — closeAuthWall', …)` block

## Self-Check

- [x] Existing 12 auth-wall tests still passing (no regression)
- [x] New 13th test seeds the static element WITHOUT calling openAuthWall and asserts close-strips it
- [x] Live verified via the unblock one-liner during 14-05 UAT
- [x] Fix is purely additive (no behaviour change when `wallEl` is set)
- [x] No need to touch `index.html` or `src/main.js` — the race is contained inside `closeAuthWall()`'s contract

## Deviations

- **Plan 14 expanded again.** Phase 14 was scoped for 3 audit gaps. UAT exposed a 4th (schema drift → 14-05) and now a 5th (auth-wall stale static → 14-06). Both were "blocking v1.1 ship" by the same bar that promoted Issue A from latent to urgent. User's standing instruction "just fix as part of 14" applied here too. Final phase shape: 6 plans (14-01..14-06) instead of the original 4, all closing pre-existing v1.1 bugs that the audit and the audit's UAT surfaced.
