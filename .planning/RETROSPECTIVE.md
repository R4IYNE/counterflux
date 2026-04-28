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

## Milestone: v1.2 — Deploy the Gatewatch

**Shipped:** 2026-04-28
**Phases:** 1 shipped (15) + 1 collapsed inline (16) | **Plans:** 3 | **Timeline:** 24 hours (2026-04-27 21:26 → 2026-04-28 20:46) | **Commits:** 27

### What Was Built

EDHREC + Spellbook CORS proxies via two catch-all Vercel Functions (`api/edhrec/[...path].js` + `api/spellbook/[...path].js`). Server-side User-Agent injection, transparent passthrough, 502 mapping with `source: "edhrec"|"spellbook"`. **Zero client-side path changes** — `EDHREC_BASE` and `SPELLBOOK_BASE` constants in `src/services/*.js` stayed byte-identical thanks to catch-all alignment with the existing dev-proxy URL shapes. Production EDHREC + Spellbook synergy/combo features previously silently broken since v1.0 are now functional after the next deploy. Production Lighthouse confirms v1.1 perf budget holds with substantial headroom: Perf 99 / LCP 0.7s / CLS 0.048 (Vercel edge CDN crushes the v1.1 lab 2.49s LCP measurement).

### What Worked

1. **Honest-ROI scope resets caught two phases of theater.** Original v1.2 scope assumed Vercel deployment infrastructure was unbuilt — discovery confirmed Counterflux had been live on Vercel since 2025-04-05 with 8 production deploys. DEPLOY-01..06 + DECIDE-01..02 (8 of the original 16 requirements) collapsed to inline validation in ~30 minutes instead of becoming a phase. Then Phase 16 collapsed the same way: UAT-02 + UAT-03 inline closure, UAT-01 deferred via SEED-003 because Counterflux's no-SSR / no-edge-functions / no-per-request-divergence shape made the wiring marginal-ROI. Net: milestone shipped in 24 hours instead of 3-4 days
2. **Catch-all path alignment as a load-bearing decision.** Choosing `api/edhrec/[...path].js` instead of `api/edhrec-proxy.js` eliminated the entire client-side change scope (no `import.meta.env.PROD` switch, no client-side environment branching, no env-aware test paths). Plan 15-03 was effectively just a comment-cleanup + verification step
3. **Production Lighthouse outperformed lab measurement by 4×.** v1.1 lab LCP was 2.49s; production LCP is 0.7s. Lab numbers gate against bundle regressions; production numbers reflect what users actually experience. Both are valuable; neither is the whole truth. Capturing both in `.planning/PERF-PROD-2026-04-28.md` as an explicit addendum (not replacement) preserved the lab/production distinction
4. **"Live-use-validated" emerged as a legitimate UAT resolution status.** 11-HUMAN-UAT.md (cloud sync) had 7 pending visual-regression anchors against live Supabase. After 10 days of production household use without sync regression + sibling test coverage in `tests/sync-reconciliation.test.js` + 6 other test files, the formal walkthrough would produce no new information. Marking the UAT `live-use-validated` instead of `partial` codifies what was already true. New status added to GSD vocabulary
5. **Spellbook parity decided cheaply during discuss-phase.** EDHREC and Spellbook clients had identical broken-in-prod problems. Folding both into Phase 15 (one PR, one plan-pair, service-generic PROXY-* IDs) cost almost nothing extra and closed the silently-broken-in-prod gap completely instead of leaving Spellbook for v1.3
6. **Pre-existing test debt cleared inline rather than as a debug phase.** 8 failing tests in `tests/perf/remeasure-contract.test.js` (caused by v1.1 milestone archive shuffle moving the artifact path) were noticed during Phase 15 execution but properly stayed out of scope. Then fixed inline during Phase 16 collapse with a one-line constant update. Right call both times — execute-phase discipline preserved the plan; collapse-phase had budget for the cleanup

### What Was Inefficient

1. **Two scope-reset events in one milestone meant we wrote three different versions of the same artifacts.** First REQUIREMENTS.md (16 reqs), then second REQUIREMENTS.md (8 reqs after first reset), then third REQUIREMENTS.md (final state with UAT-01 deferred). Same for ROADMAP.md and PROJECT.md. Net rewrite cost: ~40-60 minutes of doc churn. Lesson: when starting a "cleanup" milestone, run `vercel list-deployments` (or equivalent reality check) BEFORE writing the milestone scope. v1.3 should add a pre-scope discovery step
2. **Initial Phase 15 discuss-phase + plan-phase happened against the wrong premise.** ~2 hours of work (CONTEXT.md, ROADMAP success criteria, requirements) all on the assumption Vercel infra needed to be stood up. The "this is already live on Vercel" comment from the user retroactively invalidated all of it. The artifacts had to be deleted and rewritten. Same lesson as #1 above
3. **GSD's `gsd-tools milestone complete` CLI auto-extracted weak accomplishments** ("Created:" + one long sentence about 15-03's TODO cleanup). Had to manually rewrite the MILESTONES.md entry with proper accomplishments. The CLI's `summary-extract` for one-liners only worked on 15-03 — 15-01 and 15-02 didn't have structured one-liner sections in their SUMMARY.md files. Worth ensuring v1.3+ phase plans include a frontmatter `one_liner:` field that the milestone CLI can pick up cleanly

### Patterns Established

1. **Honest-ROI scope reset as a workflow tool.** When a phase's "real engineering" component is < 30 min and the rest is documentation closure, bypass the phase mechanism entirely. v1.2 collapsed two phases this way — original "Phase 15 Vercel Foundation" and Phase 16 UAT Pass. Codified into PROJECT.md Key Decisions table as a recurring pattern, not a one-off
2. **Catch-all path-alignment for serverless proxies** when the client already uses `/api/<service>/*` style URLs via dev proxy. Zero client-side change is the load-bearing benefit — it lets the proxy ship behind a feature gate or get rolled back without touching client code. Pattern is reusable for any future API integration that follows the dev-proxy → prod-function route
3. **Symmetry-breaker tests for parallel-but-distinct service implementations.** When shipping two near-identical Functions (EDHREC + Spellbook), include explicit `grep -c '<other-service-name>' "<this-function-file>"` returning 0 as an acceptance criterion. Prevents copy-paste source leak
4. **Inline pre-existing-test-debt cleanup during scope-collapse moments.** Phase 16 collapse had ~2 hours of budget; the 8-failure path-resolution test fix took 5 minutes. Right time to absorb this kind of cleanup — not during execute-phase (where it would be scope creep), not as its own debug phase (where it would be ceremony for a one-line fix)
5. **PERF-PROD addendum pattern instead of PERF-BASELINE replacement.** When production measures meaningfully different than lab (here, 4× better LCP), don't overwrite the baseline — create a dated addendum. Preserves both data points for future regression analysis. Format: `PERF-PROD-YYYY-MM-DD.md` at `.planning/` root

### Key Lessons

1. **Run a reality check before scoping a "cleanup" milestone.** Half of v1.2's original scope was pre-cleaned. ~2 hours of wasted scope-writing could have been avoided by running `vercel list-deployments`, `curl -sI https://<prod>/`, and grepping for "deferred to v1.2" annotations BEFORE writing CONTEXT.md / REQUIREMENTS.md / ROADMAP.md. Add to `/gsd:new-milestone` workflow as a pre-scope discovery step
2. **The user's comment "this is already live" is the strongest signal in the planning workflow.** Honor it immediately. The v1.2 scope reset happened within ~5 minutes of the user's question "what does executing this phase achieve" — that question was the entire workflow signal needed
3. **Phase ceremony has a minimum-effective-dose.** Below ~30 min of real engineering, the discuss-phase + plan-phase + execute-phase + verify-phase chain costs more than it earns. The "collapse inline" decision branch is now a recognized fork in the workflow
4. **Sibling UAT audits surface "should have been done" status mismatches.** 11-HUMAN-UAT had been `partial` for 10 days while the underlying behavior was rock-solid in production. The audit pass during Phase 16 collapse caught it. v1.3 should make this audit part of `/gsd:complete-milestone` automatically — find sibling UATs from prior milestones still in `partial` and offer to flip them based on production track record
5. **Test path constants should live in a single source of truth, not hardcoded across multiple test files.** v1.1's milestone archive moved 13-REMEASURE.md but didn't update the test that references it. A `test-paths.js` shared module would have made the rename atomic. Worth lifting during v1.3 if the issue recurs

### Cost Observations

- Model mix: opus for Phase 15 plan-phase + verifier + Phase 16 collapse documentation; sonnet for plan-checker; opus for executor agents (3 of them across Wave 1+2)
- Sessions: ~3-4 across one calendar day. Substantially fewer than v1.0/v1.1 because the milestone was small AND because two phases collapsed to inline work
- Notable: the `--no-verify` parallel-agent commit pattern caught a parallel race where Plan 15-01's test file landed in Plan 15-02's commit. Process-level only, not functional. Documented in 15-01 SUMMARY Deviations §1. Acceptable trade-off for parallel speed; would only matter if commit attribution mattered for blame analysis
- Notable: production Lighthouse run via `npx lighthouse --headless` from the local machine produced clean numbers without needing CI infrastructure. For a single-shot "did the budget hold" check, the manual approach beats wiring up CI

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0 | 8 days | 6 | 31 | Initial build — established all patterns |
| v1.1 | 14 days | 8 | 47 | Cloud sync GA, lazy 3rd-party SDKs, audit-as-a-phase, live-UAT-before-tag |
| v1.2 | 1 day | 1 + 1 collapsed | 3 | Honest-ROI scope reset as workflow tool, catch-all proxy pattern, "live-use-validated" UAT status, PERF-PROD addendum pattern |

### Cumulative Quality

| Milestone | Tests | Source Files | Source LOC | Test LOC | Commits |
|-----------|-------|-------------|-----------|----------|---------|
| v1.0 | 45 files | 104 files | 15,367 | — | 222 |
| v1.1 | 119 files | 127 files | 24,296 | 18,075 | 541 |
| v1.2 | 134 files | 132 files | 24,470 (+ 174 LOC of api/) | ~24,433 | 568 |

### Top Lessons (Verified Across Milestones)

1. Lightweight stack (Alpine.js + Dexie.js) scales to complex UIs without framework overhead — held through cloud sync addition (Supabase JS lazy-loaded keeps anonymous bundle untouched). v1.2 added two server-side Vercel Functions without touching the client bundle at all (proxies live in `api/`, never imported from `src/`)
2. Local-first architecture with bulk data caching delivers excellent offline experience — extended in v1.1 to "local-first when anonymous, cloud-synced when signed in" without compromising either mode. v1.2 confirmed in production: Lighthouse Perf 99 with the static paint-critical `<h1>` + auth-wall-decorating-pre-existing-DOM pattern from Phase 13 actually pays off behind Vercel's edge CDN
3. Spike tests for risky architectural questions pay back 100×. v1.0 didn't use this pattern; v1.1's schema rename spike (`schema-rename-spike.test.js`) is the prototype to repeat. v1.2 didn't need a spike (proxies are well-trodden territory)
4. Verification checkpoints must integrate with execution, not bolt on after. v1.0 noted this as inefficient; v1.1's plan-checker + live UAT before tag is the codified response. v1.2 added: when verification reveals the work is already done, collapse the phase rather than going through ceremony
5. Web Worker stream parsing for large JSON is non-negotiable. Pattern recurs anywhere we touch >10MB structured data — already a candidate again for SEED-001's wa-sqlite catalog (eligible at v1.3 scoping; Phase 11 sync engine has now been live 10+ days without regressions)
6. **(NEW v1.2)** When a phase's real engineering is < 30 min and the rest is documentation closure, bypass the phase mechanism entirely. The "collapse inline" branch is now part of the GSD vocabulary
7. **(NEW v1.2)** Reality-check before scoping cleanup milestones. Production-state queries (`vercel list-deployments`, `curl -sI`, sibling UAT audits) BEFORE writing CONTEXT.md / REQUIREMENTS.md / ROADMAP.md prevents writing artifacts against a stale premise
