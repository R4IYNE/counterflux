# Technology Stack — v1.1 "Second Sunrise"

**Project:** Counterflux: The Aetheric Archive
**Milestone:** v1.1 (subsequent — adds auth, cloud sync, precon quick-add, spoiler overhaul, perf tooling)
**Researched:** 2026-04-14
**Confidence:** HIGH for libraries, MEDIUM for sync engine recommendation (architecture decision)

> This document covers ONLY the new additions for v1.1. The validated v1.0 stack (Alpine.js 3.15, Dexie 4, Vite 8 Rolldown, Tailwind v4, Chart.js 4, SortableJS, Navigo, mana-font, @streamparser/json-whatwg) remains unchanged. See `.planning/milestones/v1.0-*` for v1.0 stack context.

---

## TL;DR — What's Being Added

| Concern | Recommended | Net Bundle Cost (gzip) | Confidence |
|---------|-------------|------------------------|------------|
| Auth + cloud DB | `@supabase/supabase-js` 2.103.x | ~25KB | HIGH |
| Sync engine | **Roll-your-own** on top of Dexie hooks + Supabase Realtime + outbox table | ~3KB (custom code) | HIGH (architecture) |
| Perf measurement | `web-vitals` 5.2.x (runtime) + `@lhci/cli` 0.15.x (CI/dev only) | ~2KB shipped, 0KB shipped | HIGH |
| Scryfall precons | Existing `scryfall.js` service — no new dependency | 0KB | HIGH |

**Total new shipped JS: ~30KB gzipped.** Pushes the bundle from ~99KB → ~129KB. Acceptable but worth gating Supabase loading behind first auth interaction (lazy import) so unauthenticated boot stays at current size.

---

## 1. Auth + Cloud Database

### `@supabase/supabase-js` 2.103.x

| Property | Value |
|----------|-------|
| Latest version | **2.103.0** (April 2026) |
| Bundle size | 98.2KB minified / **25.2KB gzipped** |
| Dependencies | `@supabase/auth-js`, `@supabase/postgrest-js`, `@supabase/realtime-js`, `@supabase/storage-js`, `@supabase/functions-js` (all peer-bundled) |
| Browser support | All modern browsers with native `fetch` + `WebSocket` — Counterflux is desktop-first, no concern |
| Framework | **Isomorphic, framework-agnostic.** Works with vanilla JS / Alpine.js with zero adapters. Only React/Next/Sveltekit get extra `@supabase/auth-helpers-*` packages. We do NOT need those. |

**Why this version specifically:**
- Stable v2 line since 2022; minor version bumps are additive (PostgREST features, type fixes). No v3 on the horizon.
- v2.103.0 added `stripNulls` (handy for sync diffs) and storage `cacheNonce` (useful if we later sync deck cover images).

**Integration pattern with Alpine 3:**

```javascript
// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } }
  }
);

// src/stores/auth.js — Alpine store wraps the client
Alpine.store('auth', {
  user: null,
  init() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user ?? null;
    });
    supabase.auth.getSession().then(({ data }) => { this.user = data.session?.user ?? null; });
  },
  async signInGoogle() { return supabase.auth.signInWithOAuth({ provider: 'google' }); },
  async signInMagic(email) { return supabase.auth.signInWithOtp({ email }); },
  async signOut() { return supabase.auth.signOut(); }
});
```

**Bundle scrutiny:** 25KB gzip is significant given we're at ~99KB. Mitigation: **lazy-import** the supabase module on first auth interaction (sign-in click, or first sync attempt). Unauthenticated users browsing the demo never load it. Use Vite's dynamic `import('./services/supabase.js')`.

**Compatibility flags:**
- ✅ Alpine 3.15.x: no conflict — supabase-js doesn't touch the DOM
- ✅ Dexie 4.4.x: independent layer — they don't even share a package
- ✅ Vite 8 + Rolldown: ESM-first, tree-shakes cleanly, no Rolldown-specific issues reported
- ⚠️ Realtime WebSocket connection counts toward Supabase free-tier 200-concurrent limit per project — fine for us

### `@supabase/auth-helpers-*` — DO NOT INSTALL

These exist for SSR frameworks (Next, SvelteKit, Remix) that need cookie-based session sync between server and client. Counterflux is a pure SPA — `@supabase/supabase-js` handles localStorage session persistence natively.

---

## 2. Sync Engine — Architecture Decision

**Recommendation: ROLL YOUR OWN.** Lightweight custom sync (~300-500 LOC) using Dexie hooks + a Supabase outbox pattern + Realtime subscriptions. Do NOT add RxDB, PowerSync, ElectricSQL, or any heavy sync framework.

### Why not a sync engine library?

| Library | Status (April 2026) | Why Not for Counterflux |
|---------|---------------------|-------------------------|
| **Triplit** | Founder joined Supabase Oct 2025; codebase being open-sourced as community project. **Supabase explicitly did NOT adopt it as their official offline solution.** Future is uncertain. | Don't bet a milestone on a library in transition. |
| **PowerSync** | Active, mature, $$$ commercial pricing for production. Brings its own SQLite-WASM client (not Dexie). | We already have Dexie with all data and indexes; replacing it = full data-layer rewrite. SQLite-WASM is ~1MB. Massive bundle hit. |
| **ElectricSQL** | Active, focuses on Postgres↔SQLite-WASM replication. Same problem as PowerSync — replaces our storage layer. | Architecturally incompatible with existing Dexie schema. |
| **Replicache** | Commercial license required (paid for production above usage tier). Custom storage (not Dexie). | License + cost + storage replacement — three strikes. |
| **RxDB + rxdb-supabase plugin** | RxDB has an official Supabase replication plugin that wraps Dexie as storage. Closest to our existing stack. | RxDB itself is ~50KB+ gzip and reshapes our schema (CRDT-style `_modified`/`_deleted` columns). Forces all collections into RxDB collection wrappers. Overkill for 4 tables (collection, decks, games, watchlist) with simple LWW semantics. |
| **Dexie Cloud** | Official Dexie SaaS sync. Beautiful DX. | Vendor lock-in to Dexie's hosted backend. We're committing to Supabase for auth — splitting auth and sync across two vendors is operationally painful. |
| **Dexie.Syncable** | Old protocol, server adapter required. | Would still need to write the Supabase server adapter ourselves. Same effort as roll-your-own. |

### Why roll-your-own works for our shape of data

**Counterflux's sync requirements are unusually simple:**
1. **Single-user, multi-device** — no real-time collaboration. Two devices belonging to the same user, with the same user_id RLS scope.
2. **Last-write-wins is acceptable** — collection edits, deck edits, game logs. The user is unlikely to edit the same deck on two devices in the same minute. No CRDT needed.
3. **Small payloads** — collection rows are ~50 bytes, decks are ~1KB. Even a 5000-card collection is ~250KB total on first sync.
4. **Existing schema is stable** — 4 tables, all with `updatedAt` already present (or trivially added in a migration).
5. **No need for partial sync** — user wants all their data on every device.

This is the textbook "boring sync" case where a sync engine is overkill.

### Recommended architecture (lightweight)

```
┌───────────────────────────────┐
│   Alpine stores / UI          │
└──────────────┬────────────────┘
               │ writes
               ▼
┌───────────────────────────────┐
│   Dexie (IndexedDB)           │  ← canonical local store, source of truth offline
│   + creating/updating hook    │
│   ↓ enqueue                   │
│   outbox table                │  ← pending mutations: { id, op, table, row, attempts }
└──────────────┬────────────────┘
               │ when online + auth'd
               ▼
┌───────────────────────────────┐
│   sync.js worker              │
│   • drain outbox → upsert PG  │
│   • on success, mark row_synced
│   • subscribe to Realtime     │
│     postgres_changes for      │
│     filter: user_id=eq.<me>   │
│   • on remote change, write   │
│     into Dexie if remote      │
│     updatedAt > local         │
└──────────────┬────────────────┘
               ▼
┌───────────────────────────────┐
│  Supabase Postgres (RLS)      │
│  collections, decks, games,   │
│  watchlist — all scoped       │
│  user_id = auth.uid()         │
└───────────────────────────────┘
```

**Key implementation primitives:**
- `db.collection.hook('creating' | 'updating' | 'deleting', ...)` — Dexie's built-in hooks let us enqueue every mutation into an `outbox` table transactionally.
- `supabase.from('collections').upsert(rows, { onConflict: 'id' })` — server-side upsert with the row's stable UUID handles "did this device already push?" idempotently.
- `supabase.channel('user-data').on('postgres_changes', { event: '*', schema: 'public', table: 'collections', filter: `user_id=eq.${uid}` }, ...)` — server pushes deltas back.
- Conflict resolution: compare `updated_at` timestamps. Newer wins. Log conflicts to a debug table for audit (Mila can surface "your laptop and phone disagreed about Sol Ring quantity, used the more recent value").

**Shipped code budget:** ~300-500 lines across `src/services/sync.js`, `src/services/outbox.js`, and a Dexie schema migration (`v6` adds `updated_at`, `synced_at` to existing tables; new `outbox` table). No new npm dependency.

**Why this beats RxDB even though RxDB is the closest fit:**
- RxDB's Supabase plugin is ~15KB+ gzip on top of RxDB core (~50KB+).
- RxDB requires shaping every collection through `addRxPlugin()` and `RxCollection` — a meaningful refactor of our existing Dexie services.
- We get the same LWW semantics in <500 lines of code we own and can debug.
- The roll-your-own gives us full control of the Mila notification touchpoints (item: "notification bell wire-up") which is part of the milestone scope.

**When to revisit this decision:** If we ever add real-time collaboration (multiple users editing the same deck), CRDTs and a sync engine become non-negotiable. Until then, roll-your-own is the right call.

---

## 3. Performance Measurement Tooling

### Runtime: `web-vitals` 5.2.x (small, ship in production)

| Property | Value |
|----------|-------|
| Latest version | **5.2.0** (Mar 2026) |
| Bundle size | **~2KB brotli / ~2.4KB gzip** (modular — only what you import) |
| Maintainer | Google Chrome team (official) |
| Purpose | Real-user measurement of LCP, INP, CLS, FCP, TTFB |

**Why ship it in production (not just dev):**
- Field data > lab data. Lighthouse runs on a synthetic environment; web-vitals captures real users' experience on real hardware.
- We can console.log to start (no telemetry endpoint in v1.1), then later pipe to Supabase if we want a perf dashboard.

**Integration:**
```javascript
// src/services/perf.js
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

if (import.meta.env.PROD) {
  const log = (metric) => console.log('[vitals]', metric.name, metric.value, metric.rating);
  onCLS(log); onINP(log); onLCP(log); onFCP(log); onTTFB(log);
}
```

**Bundle scrutiny:** 2KB is negligible. Tree-shakes per-metric — only imports used metrics.

### CI/Dev: `@lhci/cli` 0.15.x (NOT shipped — devDependency)

| Property | Value |
|----------|-------|
| Latest version | **0.15.x** (uses Lighthouse 12.6.1) |
| Node requirement | Node 22+ (we already require this for Vite 8) |
| Purpose | Reproducible Lighthouse runs against `vite preview` build, optional GitHub Actions integration, budget enforcement |

**Why both:**
- **web-vitals** measures what users actually experience.
- **lhci** gives us a controlled, reproducible "is the build worse than last time?" signal pre-merge.

**Configuration for our SPA:**

```javascript
// lighthouserc.cjs (project root)
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
      settings: { preset: 'desktop' }  // we are desktop-first
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }]
      }
    },
    upload: { target: 'temporary-public-storage' }
  }
};
```

```bash
# package.json scripts
"perf:lh": "lhci autorun"
"perf:lh:desktop": "lhci collect --settings.preset=desktop && lhci assert"
```

**Compatibility flags:**
- ✅ Vite 8 + Rolldown: lhci runs against the built output via `vite preview`, doesn't care about the bundler.
- ⚠️ Lighthouse spawns headless Chrome — first run downloads Chromium (~150MB, one-time). Document this in onboarding.
- ⚠️ Lighthouse against a SPA on `/` only audits the dashboard route. Add additional URLs for `/collection`, `/deck/:demoid`, `/market`, `/game` to cover the slow-loaders.

### What NOT to add for perf

| Tool | Why Not |
|------|---------|
| `vite-plugin-inspect` | Useful one-off for debugging, but install ad-hoc, don't keep as devDep — adds dev-server overhead |
| `rollup-plugin-visualizer` | Tempting for bundle analysis, but we already have `vite build --emptyOutDir` + manual `dist` inspection. Add only if a phase explicitly needs treemap analysis |
| `Sentry`/`PostHog` | Out of scope for a perf baseline phase. v1.1 needs measurement, not telemetry infrastructure |
| `unlighthouse` | Crawls a whole site auto-discovering URLs. Overkill for our 5-route SPA. Stick with explicit lhci URLs |

---

## 4. Scryfall Precon Products — No New Dependency

### Endpoint: `GET /sets?type=commander`

Scryfall's `set_type` field categorises sets. Full enumeration (verified April 2026):

```
core, expansion, masters, alchemy, masterpiece, arsenal, from_the_vault,
spellbook, premium_deck, duel_deck, draft_innovation, treasure_chest,
commander, planechase, archenemy, vanguard, funny, starter, box,
promo, token, memorabilia, minigame
```

**For Commander precons specifically:** filter sets where `set_type === 'commander'`. Each result is a set object with `code`, `name`, `released_at`, `card_count`, and crucially **`search_uri`** — a fully-formed Scryfall search URL that returns every card in that precon set.

**Existing infra reuse:**
- `src/services/scryfall.js` already has the rate-limited queue. Add a thin wrapper:
  ```javascript
  // src/services/scryfall.js (additions)
  async getCommanderPrecons() {
    const res = await this.queueRequest('/sets');
    return res.data
      .filter(s => s.set_type === 'commander')
      .sort((a, b) => b.released_at.localeCompare(a.released_at)); // newest first
  }

  async getPreconCards(searchUri) {
    // searchUri is a complete Scryfall URL, includes pagination
    return this.queueRequest(searchUri.replace('https://api.scryfall.com', ''));
  }
  ```
- For the **set-icon printing picker** (item: paper-only printings), use the existing `prints_search_uri` field on every Card object — it's already in the schema. Filter to `games:paper` client-side after fetch (or append `&q=games:paper` if the URI hasn't been resolved yet).

**No new dependency.** All work happens in `scryfall.js` and a new Alpine component `precon-quick-add.js`.

**Compatibility flags:**
- ✅ Rate limiter handles the burst when fetching cards for a 100-card precon (100 requests at 75ms = 7.5s — needs a loading state, no API issues)
- ⚠️ Could optimise via the `/cards/collection` endpoint (POST up to 75 identifiers per request) for batched precon hydration. Not required for v1.1 but worth noting in PITFALLS for the phase planner.

---

## Recommended Stack — v1.1 Additions

### Core Additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | **^2.103.0** | Auth (magic-link + Google OAuth) + Postgres CRUD + Realtime subscriptions | Single SDK covers all three needs; framework-agnostic; lazy-loadable to protect cold-start bundle |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `web-vitals` | **^5.2.0** | Real-user perf metrics (LCP, INP, CLS, FCP, TTFB) | Phase: Performance Baseline. Ship in production behind `import.meta.env.PROD` guard |

### Development Tools (devDependencies — never shipped)

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `@lhci/cli` | **^0.15.0** | Lighthouse CI for desktop-preset audits | Run via `npm run perf:lh`. Configure with `lighthouserc.cjs` at repo root. Downloads Chromium on first run |

### Roll-Your-Own (no npm package)

| Module | Lines (est.) | Purpose | Notes |
|--------|--------------|---------|-------|
| `src/services/sync.js` | ~250 | Outbox drain, Realtime subscription, conflict resolution | Calls into Dexie via existing `db.js` service |
| `src/services/outbox.js` | ~100 | Mutation queue persisted as Dexie table `outbox` | Enqueued via Dexie hooks, drained when online + auth'd |
| `src/stores/auth.js` | ~80 | Alpine store wrapping supabase.auth | Provides reactive `user`, `signInGoogle`, `signInMagic`, `signOut` |
| Schema migration `db.version(6)` | ~30 | Adds `updated_at`, `synced_at` cols + new `outbox` table + `conflicts` table | Backward-compatible: existing rows get `Date.now()` defaults |

---

## Installation

```bash
# Production additions
npm install @supabase/supabase-js@^2.103.0 web-vitals@^5.2.0

# Dev-only
npm install -D @lhci/cli@^0.15.0
```

Add to `.env.local`:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Add to `package.json`:
```json
"scripts": {
  "perf:lh": "lhci autorun",
  "perf:vitals": "echo 'check browser console after npm run preview'"
}
```

Add `lighthouserc.cjs` at project root (see Section 3 config above).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Roll-your-own sync | **RxDB + rxdb-supabase plugin** | When we need offline-first CRDT semantics, multi-user collaboration on the same record, or replication across more than 4 tables with complex relations |
| Roll-your-own sync | **PowerSync** | When we have hundreds of thousands of rows per user, need partial-sync (only sync the active deck), or want server-pushed compaction. Counterflux is far below this scale |
| Roll-your-own sync | **ElectricSQL** | When we want SQL-on-the-client with full Postgres semantics in SQLite-WASM. Overkill — Dexie's index queries cover our access patterns |
| Roll-your-own sync | **Dexie Cloud** | When we don't already have a backend commitment. We're picking Supabase for auth, splitting vendors costs operationally |
| `@supabase/supabase-js` | `@supabase/auth-js` direct + `postgrest-js` direct | If we wanted to shave 5-8KB by skipping the realtime/storage/functions sub-clients. Defer until v1.2 if bundle becomes a real problem — premature optimisation now |
| `web-vitals` runtime | Manual `PerformanceObserver` | If we want zero dependencies. 2KB savings doesn't justify writing/maintaining the LCP/INP timing edge cases ourselves |
| `@lhci/cli` | **`unlighthouse`** | When auditing many auto-discovered URLs across a content site. Counterflux has 5 known routes, lhci is simpler |
| `@lhci/cli` | **PageSpeed Insights API** | If we wanted no-Chromium-install perf audits. PSI uses Google's lab environment, less reproducible locally |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Triplit** | Acquired by Supabase Oct 2025; Supabase explicitly did NOT make it the official offline solution. Future is "open-source community project" — uncertain trajectory | Roll-your-own on Dexie + Supabase Realtime |
| **`@supabase/auth-helpers-react/-nextjs/-sveltekit`** | These are SSR-cookie helpers for full-stack frameworks. We are a pure SPA — `@supabase/supabase-js` already handles localStorage session persistence | Just `@supabase/supabase-js` |
| **`firebase` / `firebase-auth`** | Replacing Supabase mid-milestone is out of scope. Firebase's bundle is heavier and Postgres is a better long-term fit for relational user data (decks → cards relations) | Stick with Supabase |
| **`yjs` / `automerge`** | CRDTs for collaborative editing. Counterflux is single-user multi-device — we don't need conflict-free merging, LWW is fine | Timestamp-based LWW in custom sync |
| **`pouchdb`** | Old-school CouchDB sync. Would replace Dexie entirely. Mature but the wrong shape for our backend (Supabase = Postgres, not CouchDB) | Keep Dexie |
| **`workbox`** for sync background tasks | Workbox is for service-worker caching of HTTP responses, not for app-level data sync | Plain `online`/`offline` events + window focus listener |
| **`localForage`** | Alternative storage abstraction. We're already on Dexie which is strictly better for our query needs | Keep Dexie |

---

## Stack Patterns by Variant

**If a user is signed out:**
- Skip importing `@supabase/supabase-js` entirely (lazy import on sign-in click)
- All data stays in Dexie; outbox grows but never drains
- App functions identically to v1.0

**If a user is signed in but offline:**
- Outbox accumulates writes; UI shows "X pending changes" badge
- Realtime subscription is dropped; resubscribes on `online` event
- Sync resumes automatically when connectivity restored

**If a user signs in for the first time on a new device:**
- Full pull: fetch all rows for `user_id = auth.uid()` from each synced table
- If local Dexie has data (e.g. user used the app pre-auth), merge: prefer rows with newer `updated_at`, prompt user via Mila for ambiguous cases
- After initial pull, switch to delta-based Realtime subscriptions

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@supabase/supabase-js@^2.103.0` | 2.x | Alpine 3.15.x, Dexie 4.4.x, Vite 8.0.x (Rolldown), Node 22+ | Pure ESM; tree-shakes; no special Vite/Rolldown config needed |
| `web-vitals@^5.2.0` | 5.x | All evergreen browsers; works in any bundler | v5 is current; v4→v5 migration not relevant (greenfield install) |
| `@lhci/cli@^0.15.0` | 0.15.x | Lighthouse 12.6.1 internally; Node 22+ | Runs against `vite preview` build, no Rolldown awareness needed |
| Dexie 4.4.x hooks | — | `creating`, `updating`, `deleting` hooks on every table — used for outbox enqueueing | Documented stable API since Dexie 3 |
| Supabase Realtime filters | server-side | Single `eq` filter per channel (e.g. `user_id=eq.<uuid>`) — no AND/OR. One channel per table | Plan one channel per synced table; 4 tables = 4 WebSocket channels (well within free-tier limits) |

---

## Bundle Impact Summary

| Phase | JS bundle (gzip) | Δ |
|-------|------------------|---|
| v1.0 baseline (current) | ~99KB | — |
| v1.1 with eager Supabase load | ~127KB | +28KB |
| v1.1 with **lazy** Supabase load (recommended) | ~99KB cold / ~127KB after first auth click | +0KB cold, +28KB warm |
| v1.1 + web-vitals | +2KB to whichever above | negligible |

**Recommendation:** Use Vite's dynamic import for the supabase service. Cold-start performance budget (item from milestone: "performance baseline") is preserved for unauthenticated visitors. Authenticated users pay the 28KB once and it's cached forever.

```javascript
// src/stores/auth.js — lazy load pattern
async signInGoogle() {
  const { supabase } = await import('../services/supabase.js');
  return supabase.auth.signInWithOAuth({ provider: 'google' });
}
```

---

## Sources

- [supabase/supabase-js GitHub releases](https://github.com/supabase/supabase-js/releases) — verified v2.103.0 (April 2026), HIGH confidence
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — bundle size 98.2KB min / 25.2KB gzip, HIGH confidence
- [Triplit joins Supabase blog post](https://supabase.com/blog/triplit-joins-supabase) — Supabase explicitly NOT adopting Triplit as official offline solution, HIGH confidence
- [ElectricSQL alternatives reference](https://electric-sql.com/docs/reference/alternatives) — independent comparison of sync engines, MEDIUM confidence
- [RxDB Supabase replication plugin](https://rxdb.info/replication-supabase.html) — for "what if we did use a sync framework" context, HIGH confidence
- [GoogleChrome/web-vitals npm](https://www.npmjs.com/package/web-vitals) — v5.2.0 (March 2026), 2KB brotli, HIGH confidence
- [Lighthouse CI getting started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md) — v0.15.x with Lighthouse 12.6.1, HIGH confidence
- [Scryfall API set objects](https://scryfall.com/docs/api) — `set_type` enumeration including `commander` for precons, HIGH confidence
- [Scryfall Commander Sets browse](https://scryfall.com/sets?type=commander&order=set) — confirms `set_type=commander` filter behaviour, HIGH confidence
- [Supabase Realtime Postgres Changes guide](https://supabase.com/docs/guides/realtime/postgres-changes) — documents `eq` filter semantics for `user_id` scoping, HIGH confidence
- [Supabase Realtime filter discussion #1791](https://github.com/orgs/supabase/discussions/1791) — confirms single-filter-per-channel constraint, HIGH confidence

---

*Stack additions for v1.1 "Second Sunrise" — extends validated v1.0 stack with auth, sync, and perf tooling*
*Researched: 2026-04-14*
