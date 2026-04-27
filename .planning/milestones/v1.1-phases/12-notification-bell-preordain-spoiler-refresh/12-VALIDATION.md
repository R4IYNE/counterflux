---
phase: 12
slug: notification-bell-preordain-spoiler-refresh
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + jsdom 29.0.1 |
| **Config file** | `vitest.config.js` (existing) + `tests/setup.js` (global stubs for MutationObserver, CustomEvent, Alpine mock) |
| **Quick run command** | `npm test -- <pattern>` (e.g. `npm test -- notification-bell`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <pattern>` matching the file(s) changed
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-W0-01 | Wave 0 | 0 | SYNC-08 | unit | `npm test -- notification-bell-popover` | ❌ W0 | ⬜ pending |
| 12-W0-02 | Wave 0 | 0 | MARKET-01 | unit | `npm test -- spoiler-set-filter` | ❌ W0 | ⬜ pending |
| 12-W0-03 | Wave 0 | 0 | SYNC-08 + MARKET-02 | unit | `npm test -- market-store` | ✅ existing | ⬜ pending |
| 12-W0-04 | Wave 0 | 0 | MARKET-02 + MARKET-03 | unit | `npm test -- spoiler-gallery` | ✅ existing | ⬜ pending |
| 12-01 | 01 | 1 | SYNC-08 | unit | `npm test -- market-store` | ✅ existing | ⬜ pending |
| 12-02 | 01 | 1 | SYNC-08 | unit | `npm test -- notification-bell-popover` | ❌ W0 | ⬜ pending |
| 12-03 | 02 | 1 | MARKET-01 | unit | `npm test -- spoiler-set-filter` | ❌ W0 | ⬜ pending |
| 12-04 | 03 | 2 | MARKET-02 | unit | `npm test -- market-store` | ✅ existing | ⬜ pending |
| 12-05 | 03 | 2 | MARKET-02 | unit | `npm test -- spoiler-gallery` | ✅ existing | ⬜ pending |
| 12-06 | 03 | 2 | MARKET-03 | unit | `npm test -- spoiler-gallery` | ✅ existing | ⬜ pending |
| 12-07 | 04 | 3 | SYNC-08 | unit | `npm test` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notification-bell-popover.test.js` — 7 SYNC-08 popover behaviour cases (sign-out reset, openSyncErrorsModal routing, watchlist navigation, empty state, Escape close, click-outside close, unified badge count)
- [ ] `tests/spoiler-set-filter.test.js` — 3 MARKET-01 custom dropdown cases (keyrune icon render, set selection calls loadSpoilers, name + count display)
- [ ] Extend `tests/market-store.test.js` — add `unifiedBadgeCount` getter, `groupedSpoilerCards` getter (including null/undefined `released_at` handling), `syncErrorCount` polling + sign-out reset cases
- [ ] Extend `tests/spoiler-gallery.test.js` (or `tests/spoiler-filter.test.js`) — add day-header `MMM DD, YYYY • N CARDS` format, hover preview DFC image binding, hover preview flipLeft threshold, bookmark add/remove, icon state toggle, no-toast assertion (8 cases)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bell popover positions below-right of bell, within topbar bounds | SYNC-08 (D-01) | CSS positioning not testable in jsdom | Open app → click bell → verify popover appears below bell aligned to right edge |
| Hover preview flips left when tile near right viewport edge | MARKET-02 (D-08) | Requires real viewport geometry | Resize browser to ~1280px → hover rightmost column tile → verify preview appears on left side |
| Keyrune icons render correctly for all set options | MARKET-01 | Font rendering requires real browser | Open Preordain → open set filter → verify icons appear for known sets (e.g. `dsk`, `blb`, `mh3`) |
| `.cf-spoiler-bookmark` hover-reveal transition is smooth | MARKET-03 | CSS transitions not in jsdom | Hover spoiler tile → verify bookmark fades in smoothly (150ms) |
| `prefers-reduced-motion` suppresses all Phase 12 transitions | All | Media query not in jsdom | Simulate `prefers-reduced-motion: reduce` in DevTools → verify no animations on bell, preview, bookmark |
| Bell popover Escape does not close `sync-errors-modal` | SYNC-08 (Pitfall 4) | Event ordering requires real DOM | Open sync-errors modal → press Escape → verify only modal closes, bell popover (if open) also closes but doesn't interfere |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
