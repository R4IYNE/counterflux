# Project Research Summary

**Project:** Counterflux: The Aetheric Archive — v1.1 "Second Sunrise"
**Domain:** Local-first MTG SPA gaining cloud auth, multi-device sync, and feature refinement
**Researched:** 2026-04-14
**Confidence:** HIGH (stack and pitfalls), MEDIUM-HIGH (features), HIGH (architecture)

---

## Executive Summary

v1.1 "Second Sunrise" is a surgical milestone that layers cloud infrastructure onto a proven local-first foundation without breaking existing guarantees. The central challenge is not feature complexity — auth and sync are well-documented patterns — but rather preserving the v1.0 promise ("works offline, no account required") while making cloud sync feel seamless. ManaBox is the competitive reference: local-first with opt-in cloud. Moxfield/Archidekt's cloud-only model is the anti-pattern to avoid. The recommended approach is Supabase JS 2.103.x for auth, a bespoke 300-500 line sync engine on top of Dexie hooks and Supabase Realtime (no sync framework), and lazy-loading the entire Supabase client so unauthenticated cold starts stay at the v1.0 bundle size (~99KB).

The non-sync feature work (precon browser, LHS pop-out panel, spoiler overhaul, Vandalblast turn laps, notification bell) is largely low-complexity UI work that reuses the v1.0 Scryfall pipeline and existing Alpine components. The highest-risk items are the Dexie v5->v6 schema migration (irreversible data loss if botched) and the sync engine's first-sync semantics (v1.0 users with existing local collections must never have data wiped silently on sign-in). These two pitfalls define the sequencing: schema migration must precede sync code, and first-sync detection is the foundation of the entire cloud story.

The architecture research identifies a strict phase ordering driven by hard dependencies: schema migration blocks sync, auth blocks sync, sync blocks notification bell wiring with error content. Polish, performance measurement, precon work, and Vandalblast changes are all independent and can be sequenced early. The research is internally consistent across all four agents with one notable divergence on sync worker placement (architecture agent correctly overrides the stack agent's draft artifact — sync stays on the main thread).

---

## Key Findings

### Recommended Stack Additions

The v1.0 stack (Alpine 3.15, Dexie 4, Vite 8/Rolldown, Tailwind v4, Chart.js 4, SortableJS, Navigo, mana-font) is unchanged. Three packages are added:

**New production dependencies:**
- `@supabase/supabase-js ^2.103.0` — auth (magic-link + Google OAuth) + Postgres REST + Realtime subscriptions. Single SDK covers all three. Lazy-import on first auth interaction to keep unauthenticated cold-start bundle at ~99KB. Do NOT install `@supabase/auth-helpers-*` (SSR-only, not needed for SPAs).
- `web-vitals ^5.2.0` — real-user LCP, INP, CLS, FCP, TTFB measurement. ~2KB gzipped, treeshakeable. Ship in production behind `import.meta.env.PROD`; collect samples into IndexedDB `meta.perf_samples` for later review.

**New devDependency:**
- `@lhci/cli ^0.15.0` — reproducible Lighthouse CI runs against `vite preview`. Desktop-preset only (we are desktop-first). Configure via `lighthouserc.cjs` with explicit route list for all 5 screens. Downloads Chromium on first run (~150MB, document this).

**Roll-your-own (no npm package):**
- `src/services/sync-engine.js` (~250 lines) + `src/services/sync-conflict.js` (~80 lines) + `src/stores/sync.js` (~80 lines) — Dexie hook tap -> sync queue -> Supabase upsert + Realtime pull. LWW conflict resolution per-row; merge-by-card for `deck_cards` join table. Every sync library evaluated (Triplit, PowerSync, ElectricSQL, RxDB, Replicache, Dexie Cloud) was eliminated due to uncertain trajectory, storage-layer incompatibility, or cost. Roll-your-own is the right call for four tables and single-user multi-device semantics.

**Bundle impact:** Unauthenticated boot stays at ~99KB (lazy import). First auth click loads Supabase, pushing warm bundle to ~127KB. Acceptable.

**Installation:**
```bash
npm install @supabase/supabase-js@^2.103.0 web-vitals@^5.2.0
npm install -D @lhci/cli@^0.15.0
```

---

### Expected Features

Full competitive analysis in `.planning/research/FEATURES.md`.

**Must-have (table stakes) — P1 for v1.1:**
- Email magic-link auth + Google OAuth — industry standard; sign-out must NOT wipe local Dexie
- Cloud sync with LWW conflict resolution + offline write queue — the headline feature
- Sync indicator (idle/syncing/error states) — silent sync failure is the #1 trust killer
- Commander precon browser — view decklist first, then one-click "Add all to collection" (Archidekt pattern)
- Set-icon printing picker — set icon + collector number + price + foil toggle; default to newest paper printing
- LHS permanent pop-out add panel in Treasure Cruise — keyboard-first, persists across navigation within the screen
- Visual spoiler overhaul — larger tiles (250-300px), reverse-chrono reveal grouping, NEW badge (48h window), hover preview, quick add-to-watchlist
- First-player picker (coin flip or dice) + auto-highlight winner
- Visual active-turn indicator (ring/glow on active player)
- Per-turn lap timing persisted to game history + post-game lap chart
- Notification bell — shows sync errors + watchlist alerts + unread badge

**Should-have (differentiators) — P2 targeting v1.1 or v1.2:**
- "X of Y already owned" indicator before adding a precon
- Card image thumbnail per printing in the printing picker
- Day-section headers with reveal date + card count in spoiler browser
- Pre-auth local data -> migrate-to-cloud prompt on first sign-in (avoids silent wipe for v1.0 upgraders)
- Per-table sync timestamps in settings ("collection synced 2m ago")

**Defer to v1.2+:**
- Selective per-card add in precon browser (default = add-all is correct for 90% of users)
- Spinner-style first-player picker (deliver coin/dice baseline first)
- Mila narration on notifications
- Per-card price sparkline in spoiler tiles (requires price-history infra)
- Multi-user real-time pod sync (CRDTs, each player on own phone)
- GDPR data export / account deletion
- Email notification digests / browser push notifications

**Anti-features explicitly excluded:**
- Forced account creation on first run (destroys v1.0 "no friction" promise)
- Email/password auth (doubles auth surface for marginal gain)
- Real-time collaborative editing (CRDTs are 50-200KB, no multi-user use case in v1.1)
- MTG news/RSS feeds in Preordain (out of scope per PROJECT.md — spoiler-focused only)
- Auto-advance turn on timeout (Vandalblast is casual pod play, not tournament)

---

### Architecture Approach

v1.1 adds a vertical cloud slice on top of the existing Alpine + Dexie + Navigo shell without restructuring it. The v1.0 architecture is proven stable at 15,367 LOC; every addition is additive, not a refactor of existing screens.

**New files:**
- `src/services/supabase.js` — singleton Supabase client with env-var config
- `src/services/sync-engine.js` — Dexie hook tap, outbox flush, pull logic, `_suppressHooks` flag
- `src/services/sync-conflict.js` — LWW policy + deck_cards merge strategy
- `src/services/precons.js` — Scryfall precon products fetch + IndexedDB cache
- `src/stores/auth.js` — session, user, sign-in/sign-out actions
- `src/stores/sync.js` — sync UI state (idle/syncing/offline/error, queueSize, lastSyncAt)
- `src/stores/notifications.js` — unified inbox, unreadCount, dispatch/markRead
- `src/screens/alerts.js` — notification inbox screen at route `/alerts`
- `src/components/lhs-popout-panel.js` — Treasure Cruise persistent left-side drawer
- `src/components/auth-modal.js` — magic-link + Google OAuth buttons
- `src/utils/perf.js` — web-vitals collector, boot marks, IndexedDB sample persistence

**Modified files:**
- `src/db/schema.js` — version 6: adds `sync_queue`, `precons` tables; backfills `updated_at` on all sync-eligible rows; backfills `turn_laps: []` on all existing game records
- `src/stores/profile.js` — auth-aware hydration (local vs Supabase row)
- `src/stores/game.js` — `players[i].turn_laps: number[]` tracking via `nextTurn()`
- `src/stores/market.js` — forward price alerts into `notifications.dispatch()`
- `src/main.js` — init auth/sync/notif stores, install perf hooks, register sync hooks after `db.open()`
- `src/router.js` — add `/alerts` route
- `src/components/topbar.js` — bell badge wired to `notifications.unreadCount`
- `src/components/sidebar.js` — badge source moves from `market.alertBadgeCount` to `notifications.unreadCount`
- `src/screens/treasure-cruise.js` — 2-column grid layout hosting LHS popout
- `src/components/settings-modal.js` — Account section with sign-in/sign-out

**Key architectural patterns:**
1. **Lazy Supabase import** — `await import('../services/supabase.js')` on first auth interaction only; unauthenticated users never load it
2. **Dexie hook -> sync queue** — atomic: every mutation on SYNCABLE tables (`collection`, `decks`, `deck_cards`, `games`, `watchlist`) enqueues to `sync_queue` in same Dexie transaction; `_suppressHooks` flag prevents pull-side writes from re-queuing
3. **Auth-aware store hydration** — `Alpine.effect` on `auth.status` drives profile and sync bootstrap; stores expose unified API regardless of auth state
4. **Notification dispatch bus** — `notifications.dispatch({kind, severity, dedupeKey, action})` is the single aggregation point for sync errors and price alerts
5. **LHS popout as screen-local layout** — grid defined inside `screens/treasure-cruise.js`; no modification to `index.html` global shell
6. **Pull-side hook suppression** — `let _suppressHooks = false` module-scoped flag in sync-engine; prevents ping-pong

---

### Critical Pitfalls

Full 16-pitfall catalogue in `.planning/research/PITFALLS.md`. Top 5 by severity and phase ownership:

1. **Dexie v5->v6 migration missing `.upgrade()` callback** (Phase 7) — v1.0 users have irreplaceable game history; no cloud backup exists yet when migration runs. Prevention: Vitest migration test against real v5 fixture data, keep all prior `db.version(1-5)` declarations, initialise `turnLaps: []` on every existing game row, add `onblocked` toast, snapshot to localStorage before upgrade.

2. **Supabase RLS disabled or `USING (true)` on sync tables** (Phase 10) — 83% of exposed Supabase databases involve RLS misconfigurations (2026 post-mortems). Prevention: enable RLS on table creation, always include `WITH CHECK` on INSERT/UPDATE, index every `user_id` column, never put `service_role` key in `VITE_*` env vars, cross-user isolation test in CI.

3. **First-sync wipes local data** (Phase 11) — v1.0 users signing in have local-only collections; naive "pull from server, replace local" deletes everything. Prevention: 4-state first-sync detector (empty/empty, empty/populated, populated/empty, populated/populated); "Reconcile your devices" modal for the populated/populated case; snapshot before any destructive merge.

4. **Sync ping-pong loop** (Phase 11) — pull-side Dexie writes re-trigger the sync hook -> re-enqueue -> re-push -> Realtime echo -> infinite loop. Prevention: `_suppressHooks` flag during pull writes; `origin` tag on every queue entry; per-second rate-limit safety net.

5. **Magic link hash fragment collides with Navigo hash router** (Phase 10) — Supabase default uses URL fragment (`#access_token=...`) which Navigo intercepts as a route. Prevention: configure Supabase `flowType: 'pkce'`; register `/#auth-callback` route first in Navigo; test in real email clients (Outlook, Gmail, Apple Mail).

**Additional pitfalls for phase planners:**
- Clock skew destroys LWW — always use server-generated `updated_at` (Postgres `DEFAULT now()` trigger), never client timestamps for conflict resolution
- Offline queue survives account switch — tag every queue entry with `user_id`; prompt on sign-out with pending queue
- Game lap timer drift from background tab throttling — store `lap_started_at = Date.now()` anchor; compute delta on render; never increment a counter variable
- Scryfall rate limit on precon bulk import — always go through `ScryfallService` queue; use `/cards/collection` batch endpoint (75 identifiers per request)
- LHS pop-out z-index collision — define z-index as named CSS custom properties before adding new layer; use `inert` attribute for modal backdrop

---

## Implications for Roadmap

Research confirms the 7-phase plan from PROJECT.md (phases 7-13 continuing from v1.0's phase 6). Dependencies are strict and the ordering below is not negotiable.

### Phase 7: Polish Pass + Performance Baseline + Schema Migration
**Rationale:** Schema v6 is a prerequisite for phases 9 (game turn laps) and 11 (sync uses `updated_at` backfill). Polish items and perf hooks are independent and cheap — front-load them. No backend dependency.
**Delivers:** 11 polish items resolved; web-vitals + lhci baseline; Dexie v6 with all backfills; `lighthouserc.cjs` config.
**Addresses:** Polish pass requirements; performance baseline; schema prerequisite for sync.
**Owns pitfall prevention:** Pitfall 1 (Dexie migration safety); Pitfall 11 (web-vitals must be `requestIdleCallback`-deferred, not synchronous in critical path).
**Research flag:** Skip — standard patterns fully specified in ARCHITECTURE.md.

### Phase 8: Treasure Cruise Rapid Entry
**Rationale:** Fully independent of auth/sync; works anonymously. Delivers large collector quality-of-life improvement early. Requires v6 schema (precons table added in v6).
**Delivers:** LHS pop-out add panel; Commander precon browser with one-click add-all; set-icon printing picker (newest paper default); mass-entry close button fix.
**Addresses:** COLLECT-01 through COLLECT-05 requirements.
**Owns pitfall prevention:** Pitfall 13 (Scryfall rate limit on precon bulk import via `/cards/collection` batch); Pitfall 14 (LHS z-index hierarchy via CSS custom properties).
**Research flag:** Skip — Scryfall endpoints and LHS layout pattern fully documented.

### Phase 9: Thousand-Year Storm Accuracy + Vandalblast Pod Experience
**Rationale:** Independent of auth/sync. Game turn laps require v6 schema (done in Phase 7). Sequencing game changes before sync avoids a second schema migration during a cloud rollout.
**Delivers:** Deck analytics QA fixes; RAG warning redesign; Commander-as-own-type fix; first-player picker (coin + dice); visual turn indicator; per-turn lap timing + post-game lap chart; Vandalblast layout and life-colour fixes.
**Addresses:** DECK accuracy requirements; GAME-01 through GAME-07.
**Owns pitfall prevention:** Pitfall 12 (game lap timer drift — `Date.now()` anchor at lap start, delta computed on render, never a counter variable).
**Research flag:** Skip — standard patterns.

### Phase 10: Auth Foundation
**Rationale:** Hard prerequisite for Phase 11. Sync engine reads `auth.user.id` for RLS-scoped upserts and `auth.session.access_token` for the Supabase client. Lazy Supabase import protects cold-start bundle.
**Delivers:** `services/supabase.js`; `stores/auth.js`; `components/auth-modal.js`; settings modal Account section; profile store auth-aware hydration; sign-out preserves local Dexie.
**Stack:** `@supabase/supabase-js ^2.103.0` (lazy-imported on first auth interaction).
**Owns pitfall prevention:** Pitfall 2 (RLS on all sync tables from day one); Pitfall 10 (magic link / Navigo hash collision via PKCE flow); Pitfall 8 (auth state race via `getSession()` await before Alpine.start).
**Research flag:** Manual checklist needed — Supabase project creation, Google OAuth provider config, magic link redirect URL allowlisting for Vercel preview vs prod environments.

### Phase 11: Sync Engine
**Rationale:** Depends on Phase 10. Most complex phase in the milestone. First-sync detection must be implemented before any user-facing sync code ships.
**Delivers:** `services/sync-engine.js`; `services/sync-conflict.js`; `stores/sync.js`; Supabase Postgres schema (4 tables with RLS); offline write queue; first-sync detection + reconciliation modal; sync status indicator.
**Stack:** Dexie hooks (built-in), Supabase Realtime `postgres_changes`, bespoke LWW conflict logic.
**Owns pitfall prevention:** Pitfall 3 (first-sync data wipe); Pitfall 4 (ping-pong loop); Pitfall 5 (LWW clock skew via server timestamps); Pitfall 6 (partial deck update via Supabase RPC); Pitfall 7 (offline queue user_id tagging); Pitfall 9 (dead-letter queue for permanent errors).
**Research flag:** Spike recommended — Supabase Realtime channel semantics (one `eq` filter per channel = 4 WebSocket channels for 4 tables) and RPC function setup for atomic deck mutations.

### Phase 12: Notification Bell + Preordain Spoiler Refresh
**Rationale:** Notification bell requires sync so sync errors populate the inbox meaningfully on day one. Preordain overhaul is independently shippable but grouped here as both are UI-heavy with no backend dependency.
**Delivers:** `stores/notifications.js`; `screens/alerts.js` at `/alerts`; bell badge wired to unreadCount; sidebar badge migrated from market store; price alerts forwarded through notification bus; Preordain spoiler tiles enlarged (250-300px); reverse-chrono; NEW badge; hover preview; quick add-to-watchlist; set icons in dropdown.
**Addresses:** NOTIF-01 through NOTIF-05; MARKET-01 through MARKET-06.
**Owns pitfall prevention:** Notification deduplication via `dedupeKey` to prevent sync-error spam flooding the inbox.
**Research flag:** Skip — notification dispatch bus and Preordain pattern fully specified.

### Phase 13: Performance Optimisation (conditional)
**Rationale:** Only proceeds if web-vitals data collected since Phase 7 shows regressions vs targets (LCP > 2.5s, INP > 200ms). If targets already met, Phase 13 is a documentation pass only.
**Delivers:** Targeted optimisations if needed, or signed-off "v1.1 meets perf budget" record.
**Owns pitfall prevention:** Pitfall 15 (ChunkLoadError from cache bust on deploy — only relevant if aggressive code splitting is pursued).
**Research flag:** Skip unless measurements show a problem.

---

### Phase Ordering Rationale

- **Schema v6 in Phase 7, not Phase 11** — sync LWW logic needs `updated_at` on all existing rows; without backfill, conflict resolution has no basis for comparison.
- **Auth before sync** — sync engine has no `user_id` identity without auth; building them together creates entangled code with unclear test boundaries.
- **Sync before notification bell errors** — wiring the bell with only watchlist content delivers a confusingly quiet inbox; users form the wrong mental model.
- **Precon and LHS popout before auth** — anonymous-friendly, high collector value, ship immediately without cloud infrastructure.
- **Game changes before sync** — turn laps add to the games schema; if sync shipped first, a second migration would be needed during an active cloud rollout.

---

### Cross-Agent Divergences

**1. `sync.worker.js` — worker vs main thread (RESOLVED):**
- STACK.md listed `src/workers/sync.worker.js` in the roll-your-own table (draft artifact).
- ARCHITECTURE.md explicitly marks it `[DEFERRED]` and explains: Dexie hooks must run in main-thread context; moving sync to a worker forces `postMessage` serialisation per queue insert plus a duplicate IDB connection.
- **Resolution: ARCHITECTURE.md wins.** Sync runs on main thread. Revisit only if Phase 13 measurement shows >50ms blocking during burst flushes.

**2. Notification bell timing (minor framing, not a real conflict):**
- FEATURES.md frames "bell after sync so sync errors are day-one content."
- ARCHITECTURE.md groups bell and Preordain in Phase 12 post-sync.
- **Resolution: Both agree.** Bell ships after sync. Preordain grouping is a practical convenience, not a contradiction.

**3. EDHREC production proxy (open question, out of scope):**
- PROJECT.md flags as unresolved; none of the four research agents addressed it.
- **Resolution: Out of v1.1 scope.** Escalate to v1.2 planning backlog. Does not block any v1.1 phase.

---

### Research Flags Summary

| Phase | Research flag | Reason |
|-------|---------------|--------|
| Phase 7 | Skip | Standard Dexie migration + web-vitals patterns fully documented |
| Phase 8 | Skip | Scryfall endpoints + LHS layout fully specified |
| Phase 9 | Skip | DOM/CSS patterns + wall-clock timer standard |
| Phase 10 | Manual checklist needed | Supabase dashboard config (OAuth provider, redirect URLs per deploy environment) requires manual steps |
| Phase 11 | Spike recommended | Realtime channel filter semantics + RPC atomicity for deck mutations |
| Phase 12 | Skip | Fully specified |
| Phase 13 | Conditional | Only if perf data shows regression |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against npm/GitHub as of April 2026. Sync library eliminations verified via official docs for each rejected library. |
| Features | MEDIUM-HIGH | Scryfall, Lifetap, Lotus, Archidekt verified directly. Some Moxfield UX inferred from feedback forums. |
| Architecture | HIGH | Existing v1.0 codebase walked. All file paths verified. Dexie hook API confirmed stable since Dexie 3. Realtime filter semantics confirmed via official docs. |
| Pitfalls | HIGH (14/16), MEDIUM (2/16) | 14 pitfalls verified against official docs and 2026 post-mortems. Pitfalls 11 and 16 rated MEDIUM — inferred rather than post-mortem-verified. |

**Overall confidence:** HIGH

### Gaps to Address During Planning

1. **Supabase project setup checklist** — Phase 10 requires: Google OAuth provider configured, magic link redirect URLs allowlisted for Vercel preview and production URLs, RLS policies written and tested, `user_id` indexes on all sync tables. Capture as a pre-flight checklist in the Phase 10 plan.

2. **First-sync reconciliation modal UX** — the 4-state matrix and merge strategy (oracle_id + foil + category deduplication) are specified but the UI wireframe is not. Phase 11 planner should resolve this before implementation begins.

3. **Vercel preview URL dynamic allowlisting for OAuth** — Supabase requires explicit redirect URL allowlisting. Vercel preview deployments get unique URLs per branch. Wildcard allowlist vs per-deploy allowlist decision needed before Phase 10.

4. **`service_role` key management** — sync admin tooling needs RLS bypass. Correct pattern is Vercel environment variables with no `VITE_` prefix, but this is not documented as a project decision yet.

5. **EDHREC production proxy** — flagged in PROJECT.md as unresolved. Out of v1.1 scope but should be explicitly acknowledged in Phase 12+ planning to avoid silently blocking a shipped feature.

---

## Sources

### Primary (HIGH confidence)
- [supabase/supabase-js GitHub releases](https://github.com/supabase/supabase-js/releases) — v2.103.0 confirmed April 2026
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — 25.2KB gzip bundle size
- [Supabase Realtime Postgres Changes guide](https://supabase.com/docs/guides/realtime/postgres-changes) — `eq` filter semantics per channel
- [Supabase Realtime filter discussion #1791](https://github.com/orgs/supabase/discussions/1791) — single-filter-per-channel constraint confirmed
- [Triplit joins Supabase blog post](https://supabase.com/blog/triplit-joins-supabase) — NOT adopted as official offline solution
- [GoogleChrome/web-vitals npm](https://www.npmjs.com/package/web-vitals) — v5.2.0 March 2026, 2KB brotli
- [Lighthouse CI getting started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md) — v0.15.x with Lighthouse 12.6.1
- [Scryfall API set objects docs](https://scryfall.com/docs/api) — `set_type` enumeration, `commander` type confirmed
- [Dexie issues #698, #742, #921, #1145, #1599, #2214](https://github.com/dexie/Dexie.js/issues) — migration failure modes
- Chrome 88 throttling documentation (W3C hr-time #65) — `setInterval` throttling in background tabs confirmed
- 2026 Supabase RLS post-mortems (Lovable incident, ProsperaSoft guide, vibeappscanner) — 83% of exposed databases = RLS misconfiguration

### Secondary (MEDIUM confidence)
- [ElectricSQL alternatives reference](https://electric-sql.com/docs/reference/alternatives) — sync engine comparison
- [RxDB Supabase replication plugin](https://rxdb.info/replication-supabase.html) — sync framework evaluation
- [Scryfall Commander Sets browse](https://scryfall.com/sets?type=commander&order=set) — confirms `set_type=commander` filter
- Archidekt precon UX (forum posts, Larcondos request thread) — view-decklist-first preference pattern confirmed
- ManaBox competitive analysis — local-first + opt-in cloud as the right analogue for Counterflux

### Tertiary (inferred)
- Pitfall 11 (web-vitals boot overhead) — extrapolated from PerformanceObserver docs; not post-mortem verified
- Pitfall 16 (precon cache staleness) — Scryfall does update product data post-release but frequency is anecdotal

---

*Research completed: 2026-04-14*
*Covers: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Ready for roadmap: yes*
