# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — The Aetheric Archive

**Shipped:** 2026-04-13
**Phases:** 6 | **Plans:** 31 | **Timeline:** 8 days (2026-04-03 to 2026-04-11)

### What Was Built
- Complete MTG command centre with 6 interconnected modules (Dashboard, Collection, Deck Builder, Intelligence, Market, Game Tracker)
- Local-first architecture: Scryfall bulk data pipeline (Web Worker stream-parsing), Dexie.js IndexedDB persistence through 5 schema versions
- Intelligence layer integrating EDHREC synergies, Commander Spellbook combos, salt scoring, and category gap detection
- Full game lifecycle tracking with life/damage/counters, dice/coin tools, post-game charts, and game history stats
- Keyboard shortcuts, undo system with 10s deferred commit, connectivity status chip

### What Worked
- **Parallel worktree execution**: Plans ran in isolated git worktrees, enabling concurrent development without conflicts
- **Alpine.js + Dexie.js stack choice**: Lightweight reactivity with IndexedDB abstraction delivered fast iteration — 104 source files in 8 days
- **Phase ordering**: Foundation → Collection → Deck → Intelligence → Market/Game → Dashboard gave each phase stable dependencies to build on
- **Scryfall bulk data strategy**: Stream-parsing in Web Worker avoided main thread blocking; daily refresh with 24h TTL worked reliably
- **Atomic plan commits**: Each plan task committed separately, making rollback easy and git history clear

### What Was Inefficient
- **Worktree merge artifacts**: Plan 02-02 SUMMARY.md was lost during worktree merge — need better merge verification
- **Traceability table drift**: REQUIREMENTS.md traceability wasn't updated during execution — 7 of 90 requirements showed as "Pending" when actually complete
- **EDHREC CORS workaround**: Vite dev proxy works but isn't a production solution — deferred as tech debt
- **Post-plan bugfix volume**: 15+ commits after formal plan execution ended — suggests verification checkpoints (Task 3 in plans) need tighter integration

### Patterns Established
- Screen module pattern: each screen exports `mount(container)` function for lazy loading
- Alpine stores as domain layer: one store per domain (collection, deck, game, search, market, intelligence)
- Context menu via custom DOM events for decoupled cross-component communication
- Optimistic UI removal with deferred DB commit for undo support
- Activity logging on successful mutations, not before
- Chart.js instance cleanup: `destroy()` on panel close to prevent memory leaks
- PapaParse unparse needs explicit `fields` array for empty data
- Format auto-detection regex cascade: Moxfield > Archidekt > Arena > plaintext

### Key Lessons
1. **Web Worker stream parsing is essential for large JSON** — 300MB Scryfall bulk data would crash the tab with `JSON.parse`. This pattern will recur for any large dataset.
2. **Alpine.js reactivity is good enough for complex UIs** — the three-panel deck editor with live analytics, drag-and-drop, and context menus all work within Alpine's model. No need for React/Vue.
3. **Vite dev proxy hides production CORS issues** — EDHREC and Spellbook APIs work in dev but will need a proxy in production. Flag API CORS requirements earlier.
4. **Verification checkpoints should be integrated, not separate** — human-verify tasks at plan end tend to get deferred. Build verification into automated tasks instead.
5. **GBP currency conversion should happen at the data layer** — converting EUR→GBP at display time led to inconsistencies. Phase 3 fix (converting at storage time) was the right pattern.

### Cost Observations
- Model mix: primarily opus for plan execution, sonnet for research/planning
- Sessions: ~15-20 across 8 days
- Notable: parallel worktree execution saved significant wall-clock time on independent plans

---

## Milestone: v1.1 — Second Sunrise

**Shipped:** 2026-04-27
**Phases:** 8 | **Plans:** 47 | **Timeline:** 14 days (2026-04-14 to 2026-04-27)

### What Was Built
- Cloud sync: Supabase Postgres + Realtime, Dexie hook outbox, batched upsert, last-write-wins conflict resolution at field level, reconciliation modal for first sign-in (4-state lockdown), 4-state topbar chip, offline queue surviving reload + reconnect
- Supabase auth: email magic-link + Google OAuth via PKCE, lazy-loaded client (anonymous boot has zero Supabase chunk), auth-aware profile store, RLS-enforced isolation on every synced table
- Schema migration: Dexie v5 → v6+v7+v8 chain with UUID-PK temp-table shuffle, `sync_queue` outbox + `sync_conflicts` + `profile` tables, blocking modal for cross-tab upgrade conflicts, localStorage backup with 7-day TTL sweep
- Performance: LCP 6.1s → 2.49s (−59%), all Web Vitals `Good`, Lighthouse perf 86. Static paint-critical `<h1>` in initial HTML was the actual win (auth-wall now decorates rather than creates)
- 11 cross-app polish fixes (POLISH-01..11), Treasure Cruise rapid entry (LHS panel + printing picker + Commander precon browser), Vandalblast pod-play polish (RAG colours, T-shape 3-player layout, slot-machine spinner, persisted turn_laps with wall-clock anchor immune to background-tab throttling)
- MTGJSON-sourced precon deck memberships (45 bundles, 168 decks, exactly 100 cards each, lazy-loaded, weekly GitHub Action sync)

### What Worked
- **`/gsd:plan-checker` gating before execution**: Goal-backward plan analysis caught structural bugs before they hit code. Phase 11's reconciliation orchestrator was rewritten between draft and final plan because the checker flagged an unhandled "remote populated, local empty, but user signed in mid-session" branch
- **Front-loaded spike tests**: `tests/schema-rename-spike.test.js` proved Dexie 4.x can recreate a previously-nulled name in a later version BEFORE planning the v6+v7+v8 chain. Saved a multi-day rabbit-hole if the assumption had been wrong
- **Cross-phase audit closure as a phase**: Phase 14 (`v1.1 Audit Gap Closure`) was the right shape — pulled together 3 audit issues + 2 latent bugs surfaced during UAT + 4 quality items into a single accountable phase rather than letting them spread across v1.1 → v1.2 boundary
- **Live UAT against real Supabase before tagging**: Plan 14-01's live huxley UAT (sign in → add Lightning Bolt → confirm row in `counterflux.collection`, chip cycles SYNCING → SYNCED, `db.sync_conflicts.count() === 0`) caught the user_id-null bug AND surfaced a second latent bug (16-column schema drift) that fixture tests had missed
- **Anonymous-first as a load-bearing test gate**: `tests/auth-bundle.test.js` (Plan 10-02) confirms zero Supabase chunk when not signed in. Without this gate, regressing the lazy-load promise would have been invisible
- **Suppression of Realtime echo via `withHooksSuppressed`**: Pitfall §11-B (Dexie `.update()` is async read-modify-write) was identified during research, baked into the API design, and never bit us in production
- **MTGJSON over Scryfall heuristics for precons**: Phase 14-07j replaced a "guess the deck split from card name patterns" heuristic with MTGJSON's authoritative deck membership data. Removed an entire class of bugs

### What Was Inefficient
- **Phase 11 schema drift was caught too late**: 16 columns were missing from `counterflux.*` Supabase tables — only surfaced when Plan 14-01's UAT exposed PGRST204 errors after the user_id fix unmasked them. The Phase 11 → Phase 14 gap meant the bug rode along unnoticed for ~2 weeks. Need a Plan-1 schema-parity check that grep's Dexie store writes against Postgres column lists
- **Reconcile-already-ran flag cross-contaminated users**: Plan 14-07c retrofit a per-user keying. Should have been multi-user-aware from the start
- **Performance work needed multiple plans of measurement before fixing**: Phase 13 originally planned for Branch A (no regression) but Plan 1 re-measurement found LCP 6.1s, forcing pivot to Branch B (5 plans of optimization). Better to ship instrumentation in Phase 7 baseline AND a "measure-now" gate in Phase 13 Plan 0 to detect this earlier
- **`/gsd:audit-milestone` ran on stale data initially**: First audit captured `gaps_found` against Phase 7's missing VERIFICATION.md, but Phase 7 had shipped — just hadn't been documented retrospectively. Audit needs a "verify file exists OR work is provably elsewhere" pass
- **Phase 14 expanded from 3 plans to 12**: User direction "just fix as part of 14" is correct (avoids cross-milestone churn) but means the original phase scope wasn't predictive. Plan-checker should flag "this phase has known unscoped follow-ups" upfront

### Patterns Established
- **Lazy 3rd-party SDK loading** with bundle-inspection test as the regression gate. Pattern: dynamic `import()` inside auth handler + Vitest test that asserts no chunk in default bundle. Will reuse for any future heavy SDK
- **Reconciliation lockdown modal** for any destructive cross-source sync: no Escape, no backdrop close, no X. Force the user to make the choice. D-12 pattern
- **Field-level LWW with atomic-merge for joins**: `updated_at` per-row with `deck_cards` collapsing to a whole-card atomic merge. Generalizes to any join table where row-level conflict makes no semantic sense
- **`withHooksSuppressed` API** for Realtime/sync-pull writes that must NOT re-enter the outbox. Reference-count semantics handle nested suppression
- **Per-user state keying** for any one-shot flag (reconcile-already-ran, first-sign-in-prompt-shown). Single global keys are a multi-user footgun
- **Wall-clock anchor for any duration tracking** (`Date.now()` + delta, not `setInterval` count). Chrome throttles backgrounded interval timers to ~1s. Test with `vi.spyOn(Date, 'now')` jump
- **Static paint-critical DOM in initial HTML** for LCP wins. Runtime DOM creation costs ~3.6s of LCP. Pre-render the LCP element, decorate at runtime
- **MTGJSON as catalog reference** for any structured MTG data Scryfall doesn't expose cleanly (deck memberships, tokens, historical prices). Pattern: weekly GitHub Action syncs to a small JSON manifest committed to the repo
- **Audit gap closure as its own phase**: when /gsd:audit-milestone surfaces issues, dedicate a numbered phase to closing them with the same plan/verify/UAT discipline. Don't let them disperse

### Key Lessons
1. **Lazy-loading is not a single decision — it's a continuous test gate.** Bundle-inspection tests prevent the most common regression (someone imports the module statically "for convenience")
2. **Live environment UAT catches what fixtures can't.** Phase 11 had 1009 passing tests. Plan 14-01's live UAT against huxley caught two production-blocking bugs in 30 minutes. Live UAT before tagging is non-negotiable
3. **Cross-phase audits prove that phase boundaries aren't airtight.** Issues A/C/D in v1.1 were all "the previous phase claimed completion but the cross-phase wiring was wrong." Periodic milestone audits with goal-backward analysis catch what phase-local verification misses
4. **Schema migrations want spike tests BEFORE planning.** The v6+v7+v8 chain only worked because we proved the rename pattern in a 50-line spike before committing to a 36KB plan. The cost of the spike was 30 minutes; the cost of being wrong would have been a multi-day rewrite
5. **Reconciliation > silent merge.** Every sync engine wants to "just resolve it." Counterflux's reconciliation lockdown modal is friction by design — better one annoying modal than a quietly-destroyed collection
6. **Performance work needs measurement before AND after, with a documented baseline.** Phase 7's `PERF-BASELINE.md` made Phase 13's branch decision (optimize vs sign off) trivial. Without it, we'd have argued about whether perf was "fine"
7. **MTGJSON earned a permanent dependency in v1.1.** Phase 14's precon split was the trojan horse — backlog 999.1, 999.2, and SEED-001 all ride on the same dependency. Cumulative cost: one weekly GitHub Action

### Cost Observations
- Model mix: heavy opus on Phases 7, 11, 13 (the architecturally hardest); sonnet for execution-heavy phases (8, 8.1, 12); fast-mode opus for Phase 14's surgical fixes
- Sessions: ~25-30 across 14 days. Higher than v1.0's 15-20 because cloud sync required more discussion phases and more UAT cycles
- Notable: `/gsd:fast` for Phase 14's small fixes (Issue C docs, Issue D 20-line fix) saved meaningful overhead vs full plan-checker route
- Notable: `/gsd:autonomous` was NOT used — every phase had a human discuss + plan + verify checkpoint. The two latent bugs that surfaced in Phase 14 would have shipped silently under autonomous mode

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0 | 8 days | 6 | 31 | Initial build — established all patterns |
| v1.1 | 14 days | 8 | 47 | Cloud sync GA, lazy 3rd-party SDKs, audit-as-a-phase, live-UAT-before-tag |

### Cumulative Quality

| Milestone | Tests | Source Files | Source LOC | Test LOC | Commits |
|-----------|-------|-------------|-----------|----------|---------|
| v1.0 | 45 files | 104 files | 15,367 | — | 222 |
| v1.1 | 119 files | 127 files | 24,296 | 18,075 | 541 |

### Top Lessons (Verified Across Milestones)

1. Lightweight stack (Alpine.js + Dexie.js) scales to complex UIs without framework overhead — held through cloud sync addition (Supabase JS lazy-loaded keeps anonymous bundle untouched)
2. Local-first architecture with bulk data caching delivers excellent offline experience — extended in v1.1 to "local-first when anonymous, cloud-synced when signed in" without compromising either mode
3. Spike tests for risky architectural questions pay back 100×. v1.0 didn't use this pattern; v1.1's schema rename spike (`schema-rename-spike.test.js`) is the prototype to repeat
4. Verification checkpoints must integrate with execution, not bolt on after. v1.0 noted this as inefficient; v1.1's plan-checker + live UAT before tag is the codified response
5. Web Worker stream parsing for large JSON is non-negotiable. Pattern recurs anywhere we touch >10MB structured data — already a candidate again for SEED-001's wa-sqlite catalog
