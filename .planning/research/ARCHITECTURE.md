# Architecture Research — v1.1 Second Sunrise Integration

**Domain:** Local-first SPA (Alpine.js + Dexie.js) gaining cloud sync, auth, and new product surfaces
**Researched:** 2026-04-14
**Confidence:** HIGH (existing codebase walked, public docs verified)

---

## 1. System Overview — v1.0 → v1.1

### v1.0 (current)

```
┌──────────────────────────────────────────────────────────────────┐
│  index.html — Alpine app shell, splash, sidebar, topbar          │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  main.js — boot: init stores → Alpine.start() → initRouter()     │
│             → bulkdata pipeline → currency rate                  │
└──────────────────────────────────────────────────────────────────┘
        │
        ├──── Navigo (hash router) ─── lazy screens/* (5 routes)
        │
        ├──── Alpine.store('app'|'toast'|'profile'|'undo'|'search'
        │                  |'collection'|'deck'|'game'|'intelligence'
        │                  |'market'|'bulkdata')
        │
        └──── db/schema.js (Dexie v5)  ←──  services/* (sync read/write)
                  │
                  └─ Web Worker: bulk-data.worker.js  →  bulk-data-pipeline.js
                                                       (@streamparser/json-whatwg)
```

### v1.1 additions (this milestone)

```
                  ┌────────────────────────────────────────────┐
                  │           Supabase Cloud (Postgres)         │
                  │  auth.users  collection  decks  deck_cards  │
                  │              games  watchlist  precons      │
                  └────────────────────┬───────────────────────┘
                                       │ HTTPS / WebSocket
                                       │ (auth + REST + Realtime)
        ┌──────────────────────────────┴───────────────────────────┐
        │                                                          │
        ▼                                                          ▼
┌──────────────────┐                                ┌─────────────────────────┐
│ services/        │                                │ workers/sync.worker.js  │
│   supabase.js    │                                │ (optional Phase 2 perf) │
│  (singleton      │                                └─────────────────────────┘
│   client + JWT)  │                                          │
└────────┬─────────┘                                          │
         │                                                    │
         ▼                                                    ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
│ stores/auth.js   │───▶│ stores/sync.js   │───▶│ services/sync-engine.js  │
│ (session, user,  │    │ (status, queue   │    │ (push, pull, conflict,   │
│  signin/signout) │    │  size, lastSync) │    │  Dexie hook tap)         │
└────────┬─────────┘    └────────┬─────────┘    └─────────────┬────────────┘
         │                       │                            │
         │ subscribes            │ dispatches                 │ db.table.hook(
         ▼                       ▼                            │   'creating'|
┌──────────────────┐    ┌──────────────────┐                  │   'updating'|
│ stores/profile   │    │ stores/notif.js  │                  │   'deleting')
│ (auth-aware,     │    │ (bell badge,     │                  ▼
│  cloud-backed)   │    │  inbox, route    │    ┌──────────────────────────┐
└──────────────────┘    │  to /alerts)     │    │ db/schema.js (Dexie v6)  │
                        └────────┬─────────┘    │  + sync_queue table      │
                                 │              │  + sync_meta key         │
                                 ▼              │  + games.turn_laps       │
                  routes/alerts (new screen)    │  + precons table         │
                                                └──────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Cross-cutting v1.1 modules                                      │
│                                                                  │
│  utils/perf.js          — web-vitals collection, console + meta  │
│  services/precons.js    — Scryfall /sets/{code}/products         │
│  components/lhs-popout/ — Treasure Cruise persistent panel       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

### New components

| Component | File (new) | Owns | Talks to |
|-----------|-----------|------|----------|
| Supabase client | `src/services/supabase.js` | `createClient()` singleton, env config, realtime channel factory | All sync/auth callers |
| Auth store | `src/stores/auth.js` | `session`, `user`, `status` (`anonymous`\|`authed`\|`pending`), `signInMagic()`, `signInGoogle()`, `signOut()` | `supabase.js`, broadcasts to `profile.js`, `sync.js` |
| Sync engine | `src/services/sync-engine.js` | Dexie hooks → enqueue mutation; flush queue → Supabase upserts; pull deltas with `updated_at > lastSync`; conflict policy | `db/schema.js`, `supabase.js`, `stores/sync.js` |
| Sync store | `src/stores/sync.js` | `status` (`idle`\|`syncing`\|`offline`\|`error`), `queueSize`, `lastSyncAt`, `errors[]` | `sync-engine.js`, `notifications.js` |
| Notification store | `src/stores/notifications.js` | Unified inbox: sync errors, price alerts, app messages; `unreadCount`, `markRead()`, `dispatch()` | `market.js` (forward alerts), `sync.js` (forward errors) |
| Precon service | `src/services/precons.js` | Fetch + cache product/decklist data from Scryfall `/sets/{code}/products` | `db.precons` table, called by Treasure Cruise + Thousand-Year Storm |
| Perf hook | `src/utils/perf.js` | `web-vitals` import (LCP/INP/CLS/TTFB), boot-time marks, persist roll-up to `meta` | `main.js` boot, dev console, optional dashboard widget |
| LHS popout panel | `src/components/lhs-popout-panel.js` + slots wired in `treasure-cruise.js` | Persistent left-side add/quick-action drawer for Treasure Cruise | `collection` store actions |
| Alerts screen | `src/screens/alerts.js` | Renders unified notification inbox (route `/alerts`) | `notifications` store |

### Modified existing components

| File | Modification |
|------|--------------|
| `src/db/schema.js` | Bump to `db.version(6)`; add `games.turn_laps` (data shape change, not indexed), add `sync_queue`, `precons` tables; meta key `sync_meta` for cursor tracking |
| `src/stores/profile.js` | Replace `localStorage` persistence with auth-aware load: when `auth.status === 'authed'`, hydrate from Supabase row; subscribe via `Alpine.effect`/listener on `auth.session` |
| `src/stores/game.js` | Mutate `players[i].turn_laps: number[]` on `nextTurn()`; persist in saved game record |
| `src/stores/market.js` | When `pendingAlerts` populated, forward each into `notifications.dispatch({kind:'price-alert',...})` instead of (or in addition to) sidebar badge |
| `src/main.js` | Add `initAuthStore()`, `initSyncStore()`, `initNotificationStore()` BEFORE Alpine.start; call `bootAuth()` then `bootSyncEngine()` AFTER Alpine.start; import + invoke `installPerfHooks()` first thing |
| `src/router.js` | Add `'/alerts'` route → `screens/alerts.js`; add to `ROUTE_MAP` |
| `src/components/topbar.js` (or sidebar) | Wire bell badge to `$store.notifications.unreadCount`; click → `router.navigate('/alerts')` |
| `src/components/sidebar.js` | `hasAlertBadge()` reads from `notifications.unreadCount` not `market.alertBadgeCount` (single source of truth) |
| `src/screens/treasure-cruise.js` | Layout grid splits into LHS popout + main content; popout binds to `collection.addCardOpen`/quick-add state |
| `src/components/settings-modal.js` | Adds Account section: signed-in email, Sign In / Sign Out buttons calling `auth` store actions |

---

## 3. Recommended Project Structure (v1.1 deltas only)

```
src/
├── main.js                          [MODIFIED] — register auth/sync/notif/perf
├── router.js                        [MODIFIED] — /alerts route
├── services/
│   ├── supabase.js                  [NEW]      — client singleton
│   ├── sync-engine.js               [NEW]      — Dexie hooks + flush + pull
│   ├── sync-conflict.js             [NEW]      — resolution policy (LWW + 3-way for decks)
│   ├── precons.js                   [NEW]      — Scryfall product fetch + cache
│   └── (existing files unchanged)
├── stores/
│   ├── auth.js                      [NEW]      — session, user, sign-in actions
│   ├── sync.js                      [NEW]      — sync UI state
│   ├── notifications.js             [NEW]      — unified inbox + bell badge
│   ├── profile.js                   [MODIFIED] — auth-aware persistence
│   ├── game.js                      [MODIFIED] — turn_laps tracking
│   └── market.js                    [MODIFIED] — forward to notifications
├── screens/
│   └── alerts.js                    [NEW]      — notification inbox screen
├── components/
│   ├── lhs-popout-panel.js          [NEW]      — Treasure Cruise drawer
│   ├── auth-modal.js                [NEW]      — magic-link + Google buttons
│   ├── settings-modal.js            [MODIFIED] — Account section
│   ├── topbar.js                    [MODIFIED] — bell wiring
│   └── sidebar.js                   [MODIFIED] — badge from notifications store
├── db/
│   └── schema.js                    [MODIFIED] — version 6, sync_queue, precons
├── utils/
│   └── perf.js                      [NEW]      — web-vitals collector
└── workers/
    └── sync.worker.js               [DEFERRED] — only if main-thread cost shows up
```

### Structure rationale

- **`services/sync-engine.js` is NOT a worker.** Dexie hooks must run in the main-thread context where the db handle lives; the network egress is async fetch and naturally yields. A worker would force serialization of every mutation across `postMessage`. Reserve worker promotion for if perf measurement (Phase 7) shows >50 ms blocked time during bursty queue flushes.
- **`stores/auth.js` separate from `stores/profile.js`.** Auth is identity (session, JWT). Profile is presentation (display name, avatar). Decoupling lets Profile keep working anonymously (today's behaviour) and lets Auth gate sync without touching profile UI.
- **`stores/notifications.js` separate from `stores/market.js`.** Today's `market.alertBadgeCount` is a coupled concern (Preordain badge driven by market store). v1.1 needs a third source (sync errors), so a unified inbox store eliminates fan-out logic in the topbar/sidebar.
- **`screens/alerts.js` not a modal.** The bell already implies a "view full history" affordance. A first-class screen reuses the lazy-loaded screen pattern (consistent with rest of app) and gives sync errors a stable URL for support links.

---

## 4. Architectural Patterns

### Pattern 1: Auth-aware store hydration

**What:** A store that has two source-of-truth modes (local vs cloud) based on auth state, and re-hydrates when auth flips.

**When to use:** `profile`, `collection`, `decks`, `games`, `watchlist` — anything that pre-existed v1.0's local-first model and now optionally syncs.

**Trade-offs:**
- Pro: anonymous mode keeps working unchanged (no regression, GSD-friendly)
- Pro: single store API for both modes; consumers don't branch
- Con: hydration is async, must handle race between auth callback and screen mount

**Example:**

```js
// stores/profile.js (revised shape)
export function initProfileStore() {
  Alpine.store('profile', {
    name: '', email: '', avatar: '',
    _source: 'local',  // 'local' | 'cloud'

    async hydrate() {
      const auth = Alpine.store('auth');
      if (auth.status === 'authed') {
        const { data } = await supabase
          .from('profiles').select('*').eq('user_id', auth.user.id).single();
        Object.assign(this, data || {});
        this._source = 'cloud';
      } else {
        Object.assign(this, loadLocal());
        this._source = 'local';
      }
    },

    update(fields) {
      Object.assign(this, fields);
      if (this._source === 'cloud') {
        supabase.from('profiles').upsert({ user_id: ..., ...fields });
      } else {
        saveLocal(this);
      }
    },
  });

  // Subscribe to auth changes
  Alpine.effect(() => {
    Alpine.store('auth').status; // touch reactive dep
    Alpine.store('profile').hydrate();
  });
}
```

### Pattern 2: Dexie hook → sync queue → flusher

**What:** Use `db.table.hook('creating'|'updating'|'deleting')` to capture every local mutation, append a row to a `sync_queue` Dexie table, and run an asynchronous flusher that drains the queue to Supabase. Pull-side runs on a timer + Realtime channel + on-focus.

**When to use:** Bidirectional sync where local writes must keep working offline.

**Trade-offs:**
- Pro: Local writes never block on network; queue survives reload
- Pro: Hooks are synchronous and run inside the same Dexie txn, so the queue write is atomic with the data write
- Con: Hooks fire for ALL writes including bulk-data import — must filter by table allowlist (`collection`, `decks`, `deck_cards`, `games`, `watchlist`) and ignore `cards`, `meta`, `*_cache`
- Con: Schema bumps need careful ordering — hooks must be installed AFTER `db.open()`

**Example:**

```js
// services/sync-engine.js
const SYNCABLE = new Set(['collection', 'decks', 'deck_cards', 'games', 'watchlist']);

export function installSyncHooks(db) {
  for (const tableName of SYNCABLE) {
    const t = db.table(tableName);

    t.hook('creating', (primKey, obj) => {
      obj.updated_at = new Date().toISOString();
      obj._sync_state = 'pending';
      enqueue({ op: 'put', table: tableName, key: primKey, payload: obj });
    });

    t.hook('updating', (mods, primKey, obj) => {
      mods.updated_at = new Date().toISOString();
      mods._sync_state = 'pending';
      enqueue({ op: 'put', table: tableName, key: primKey,
                payload: { ...obj, ...mods } });
    });

    t.hook('deleting', (primKey) => {
      enqueue({ op: 'del', table: tableName, key: primKey });
    });
  }
}

async function enqueue(op) {
  await db.sync_queue.add({ ...op, queued_at: Date.now() });
  scheduleFlush();
}
```

### Pattern 3: Conflict resolution — Last-Write-Wins by table, with merge for deck_cards

**What:** Keep policy ultra-simple. For top-level entities (`collection`, `decks`, `games`, `watchlist`), the row with the later `updated_at` wins. For `deck_cards` (a join table), merge by `(deck_id, scryfall_id)` summing quantities and taking the later note/foil flag.

**When to use:** Single-user multi-device sync where conflicts are rare (user is active on one device at a time). NOT suitable for collaborative editing.

**Trade-offs:**
- Pro: Trivial to implement, no CRDT library cost (~0 KB added)
- Pro: Predictable behaviour — users understand "last edit wins"
- Con: Silent data loss if user makes simultaneous edits on two devices
- Mitigation: surface "conflict resolved, remote version kept" toasts via `notifications` store; keep 30-day deletion tombstones in Supabase to recover from accidental wipes

### Pattern 4: Notification bus via dispatch

**What:** Each subsystem (`sync`, `market`, future `app-update`) calls `notifications.dispatch({kind, severity, title, body, action})`. The store de-dupes (by `dedupeKey`), assigns ID, and emits to the bell. Subscribers read `unreadCount` via Alpine reactivity.

**When to use:** Any cross-cutting alert that today would proliferate as direct toast calls or per-store badges.

**Trade-offs:**
- Pro: Single sidebar/topbar surface, single screen (`/alerts`), single mark-read flow
- Pro: Consumers still keep ephemeral toasts for transient feedback (success, undo) — only persistent/actionable items go through notifications
- Con: One more store to wire; need clear policy on what's a toast vs notification

**Example:**

```js
// stores/notifications.js
Alpine.store('notifications', {
  items: [],          // {id, kind, severity, title, body, action, ts, read, dedupeKey}

  get unreadCount() { return this.items.filter(i => !i.read).length; },

  dispatch(notif) {
    if (notif.dedupeKey && this.items.some(i => i.dedupeKey === notif.dedupeKey && !i.read)) return;
    this.items.unshift({ id: crypto.randomUUID(), ts: Date.now(), read: false, ...notif });
    if (this.items.length > 200) this.items.length = 200;
    persist(this.items);
  },

  markAllRead() { this.items.forEach(i => i.read = true); persist(this.items); },
  open(id) { /* navigate to action */ },
});
```

### Pattern 5: Layout-by-screen for LHS popout

**What:** Don't change `index.html`. Instead, the Treasure Cruise screen (`screens/treasure-cruise.js`) renders a 2-column grid inside `#main-content`: `[popout panel | content]`. The popout is a `position: sticky` element bound to its own Alpine state. Other screens render normally.

**When to use:** Per-screen permanent UI affordances that shouldn't pollute the global shell.

**Trade-offs:**
- Pro: Maintains `screens/*` independence — no other screen sees or pays for the panel
- Pro: Survives the existing `container.innerHTML = ''` cleanup pattern in router
- Pro: No global CSS to maintain; popout width is screen-local
- Con: If multiple screens later need similar drawers, will need to extract a `withPopoutLayout()` helper

**Example shape:**

```js
// screens/treasure-cruise.js (mount excerpt)
container.innerHTML = `
  <div class="grid" style="grid-template-columns: 280px 1fr; gap: 24px;">
    <aside id="tc-popout" class="sticky top-[88px] self-start">
      ${renderLhsPopoutPanel()}
    </aside>
    <main>
      <!-- existing treasure cruise content -->
    </main>
  </div>
`;
```

### Pattern 6: Web Vitals — collect, persist, surface lazily

**What:** `utils/perf.js` calls `onLCP`, `onINP`, `onCLS`, `onTTFB` from the `web-vitals` package on boot. Each metric is logged to console (dev) and rolled into a `meta.perf_samples` record (last 50). NO toast fires — perf is observed, not intrusive.

**When to use:** Phase 7 measurement before Phase 8+ optimisation.

**Trade-offs:**
- Pro: Tiny dependency (~3 KB), zero runtime cost after boot
- Pro: Local-only, no telemetry endpoint needed (privacy-aligned with local-first)
- Con: Samples never leave the device — for fleet-wide stats would need a backend

**Example:**

```js
// utils/perf.js
import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals';
import { db } from '../db/schema.js';

const samples = [];

function record(metric) {
  const s = { name: metric.name, value: metric.value, ts: Date.now() };
  samples.push(s);
  console.log(`[Perf] ${s.name}: ${s.value.toFixed(1)}`);
  if (samples.length >= 4) flush();
}

async function flush() {
  const existing = (await db.meta.get('perf_samples'))?.samples || [];
  const merged = [...existing, ...samples].slice(-50);
  await db.meta.put({ key: 'perf_samples', samples: merged });
  samples.length = 0;
}

export function installPerfHooks() {
  onLCP(record); onINP(record); onCLS(record); onTTFB(record);
  performance.mark('cf:boot:start');
  window.addEventListener('load', () => performance.mark('cf:boot:loaded'));
}
```

---

## 5. Data Flow

### Auth flow

```
User clicks "Sign in" in settings-modal
        │
        ▼
auth.signInMagic(email)  ──▶  supabase.auth.signInWithOtp({email})
        │                                  │
        │                                  ▼
        │                          Email arrives, user clicks link
        │                                  │
        ▼                                  ▼
auth.status = 'pending'            Page reloads with #access_token=...
                                           │
                                           ▼
                          supabase.auth.onAuthStateChange fires
                                           │
                                           ▼
                            auth.status = 'authed', auth.user = {...}
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              ▼                            ▼                            ▼
       profile.hydrate()            sync.bootstrap()           notifications.dispatch(
       (cloud → store)              (initial pull, then       {kind:'auth', title:'Signed in'})
                                     install hooks)
```

### Local write → cloud sync flow

```
User adds card to collection
        │
        ▼
collection.addCard()  ──▶  db.collection.add({...})
                                 │
                                 ▼
                  Dexie 'creating' hook fires (sync-engine)
                                 │
                                 ▼
                  db.sync_queue.add({op:'put', table:'collection', payload})
                                 │
                                 ▼
                            scheduleFlush()  (debounced 500 ms)
                                 │
                                 ▼
                  flushQueue() drains queue:
                  for each item → supabase.from(item.table).upsert(item.payload)
                                 │
                                 ├─ success → db.sync_queue.delete(item.id)
                                 │            sync.lastSyncAt = now
                                 │
                                 └─ failure → mark item retries++,
                                              if retries > 5 →
                                              notifications.dispatch({
                                                kind:'sync-error',
                                                severity:'warn',
                                                action:'/alerts'
                                              })
```

### Cloud → local pull flow

```
Triggers: app focus | sync.bootstrap | Realtime channel event | 5-min interval
        │
        ▼
sync-engine.pull()
        │
        ▼
since = sync.lastSyncAt (from db.meta.sync_meta)
        │
        ▼
For each syncable table:
  supabase.from(t).select('*').gt('updated_at', since)
        │
        ▼
For each remote row:
  local = await db[t].get(remote.id)
  if (!local) → db[t].add(remote)                                  // new from other device
  else if (remote.updated_at > local.updated_at) →
          db[t].put(remote, {silent:true})   // suppress sync hooks // remote wins
  else → no-op (local already newer; will be pushed on next flush)
        │
        ▼
sync.lastSyncAt = now
db.meta.put({key:'sync_meta', last_sync_at: now})
```

**Critical:** the pull-side write must NOT trigger the Dexie hook re-enqueue (infinite loop). Two options:
1. **Hook bypass via Dexie's transactional flag** — track inside the hook via a shared module state.
2. **Internal flag** — module-scoped `let _suppressHooks = false`; pull sets to `true`, hook returns early when set, pull sets back to `false` in `finally`. Simple, well-tested pattern.

Recommend option 2 — concrete, debuggable, no Dexie magic.

### Schema migration flow (v5 → v6)

```js
// db/schema.js — appended
db.version(6).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category], updated_at',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id], updated_at',
  edhrec_cache: 'commander',
  combo_cache: 'deck_id',
  card_salt_cache: 'sanitized',
  watchlist: '++id, &scryfall_id, updated_at',
  price_history: '++id, scryfall_id, date, [scryfall_id+date]',
  games: '++id, deck_id, started_at, ended_at, updated_at',
  // NEW
  sync_queue: '++id, table, queued_at',
  precons: 'set_code, name, released_at',
}).upgrade(async (tx) => {
  // Backfill updated_at on existing rows so first sync push has timestamps
  const now = new Date().toISOString();
  await tx.table('collection').toCollection().modify(r => { r.updated_at = r.added_at || now; });
  await tx.table('decks').toCollection().modify(r => { r.updated_at = r.updated_at || now; });
  await tx.table('deck_cards').toCollection().modify(r => { r.updated_at = now; });
  await tx.table('watchlist').toCollection().modify(r => { r.updated_at = r.added_at || now; });
  // Backfill turn_laps on saved games (empty arrays — historical games have no per-turn data)
  await tx.table('games').toCollection().modify(g => {
    if (Array.isArray(g.players)) {
      g.players.forEach(p => { if (!p.turn_laps) p.turn_laps = []; });
    }
    g.updated_at = g.ended_at || g.started_at || now;
  });
});
```

`turn_laps` lives inside `players[i]` (object shape, not indexed) so the schema string is unchanged for that field — only the upgrade backfills empty arrays.

---

## 6. Suggested Build Order

Dependencies are strict; reordering breaks downstream phases.

```
Phase 7  ─ Polish + Perf measurement  (no backend)
   │
   ├─ utils/perf.js installs hooks at top of main.js          [INDEPENDENT]
   ├─ Polish items 1-11                                        [INDEPENDENT]
   └─ Schema v6 bump (turn_laps backfill, updated_at backfill) [BLOCKS sync]
                                                ↓
Phase 8  ─ Treasure Cruise rapid entry
   │
   ├─ services/precons.js + db.precons table                   [INDEPENDENT, after v6]
   ├─ components/lhs-popout-panel.js                           [INDEPENDENT]
   └─ screens/treasure-cruise.js layout refactor               [INDEPENDENT]
                                                ↓
Phase 9  ─ Thousand-Year Storm accuracy + Vandalblast pod      [INDEPENDENT, after v6]
   │
   └─ stores/game.js writes turn_laps                          (uses v6 schema)
                                                ↓
Phase 10 ─ Auth foundation                                     [BLOCKS sync, notif-error]
   │
   ├─ services/supabase.js
   ├─ stores/auth.js
   ├─ components/auth-modal.js
   ├─ stores/profile.js auth-aware refactor
   └─ settings-modal.js Account section
                                                ↓
Phase 11 ─ Sync engine                                         [BLOCKS notif-error wiring]
   │
   ├─ Supabase tables + RLS policies (Postgres-side)
   ├─ services/sync-engine.js (push/pull/hooks)
   ├─ services/sync-conflict.js
   ├─ stores/sync.js
   └─ Initial bootstrap UX (first-sync progress)
                                                ↓
Phase 12 ─ Notification bell + Preordain refresh
   │
   ├─ stores/notifications.js                                  [requires sync to dispatch errors]
   ├─ screens/alerts.js + /alerts route
   ├─ topbar.js bell wiring
   ├─ sidebar.js badge swap (market → notifications)
   ├─ market.js forwards price alerts to notifications
   └─ Preordain spoiler refresh                                [INDEPENDENT, can parallel]
                                                ↓
Phase 13 ─ Perf optimisation (if measurements warrant)
   │
   └─ Reads from utils/perf.js samples persisted since Phase 7
```

**Why this order:**

- **Perf hook in Phase 7, not Phase 13.** You measure for at least one full milestone before optimising. Measuring last is too late — you have no baseline.
- **Schema v6 must precede sync.** Sync uses `updated_at` columns; without backfill, every existing row has `undefined > undefined` semantics and pull logic breaks.
- **Auth must precede sync.** Sync engine reads `auth.user.id` to scope upserts and `auth.session.access_token` for the Supabase client. With no auth, the sync engine has no identity to attach rows to.
- **Sync must precede notification wire-up for errors.** The notification store can be built without sync, but its first real customer is sync errors — building them together causes unclear ownership. Build sync first, dispatch errors to console, then add notifications and replace the console calls.
- **Precon service is independent of sync** — it reads from Scryfall, caches in IndexedDB, and is anonymous-friendly. Can ship in Phase 8 without waiting for cloud.
- **LHS popout is a layout change inside one screen** — also independent. Ships in Phase 8.
- **Game `turn_laps`** uses the v6 schema but is logically independent of sync (sync just carries it along). Ships in Phase 9.

---

## 7. Integration Points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/supabase-js` v2, `signInWithOtp` (magic link) + `signInWithOAuth({provider:'google'})` | OAuth callback URL must be added to Supabase dashboard; magic link redirect URL must match deploy origin (Vercel preview vs prod). Session persists in `localStorage` by default — keep that default. |
| Supabase Postgres | REST via `supabase.from(table)`; Realtime via `supabase.channel(...).on('postgres_changes', ...)` | Enable RLS on every synced table — `auth.uid() = user_id`. Add `user_id uuid not null default auth.uid()` to every table. **Never** ship a sync table without RLS. |
| Scryfall (existing) | `utils/scryfall.js` already centralises base URL + User-Agent | Add `precons` endpoint here too — keep all Scryfall fetches uniform. Reuse 75 ms rate-limit queue once consolidated. |
| EDHREC (existing) | Vite proxy `/api/edhrec` | Production proxy still TBD per `PROJECT.md` — orthogonal to this milestone. |
| `web-vitals` (new) | npm package, ESM imports | ~3 KB. Treeshake-friendly — only import the metrics you use. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `auth` ↔ `profile` | Profile uses `Alpine.effect` on `auth.status` to re-hydrate | One-way: auth is source of truth, profile reacts |
| `auth` ↔ `sync-engine` | Sync engine reads `Alpine.store('auth').user` on bootstrap; pauses queue flush when `status === 'anonymous'` | Sync engine is dormant for anonymous users — queue accumulates locally and flushes on first sign-in (gives users an "all your local stuff just synced" moment) |
| `sync-engine` ↔ Dexie | Hooks installed once at boot, after `db.open()` resolves | Must be installed before first user write — install in `main.js` immediately after `await db.open()`. Otherwise early writes (e.g. bulk-data import on first run) might miss the hook (though `cards` table is correctly excluded from `SYNCABLE`) |
| `sync-engine` ↔ `notifications` | Sync engine `dispatch({kind:'sync-error', dedupeKey:'sync-error-batch'})` after N retries | Dedupe key prevents 100-error spam from creating 100 notifications |
| `market` ↔ `notifications` | Market store's `checkAlerts()` forwards each triggered alert via `dispatch({kind:'price-alert', dedupeKey:'price-' + scryfall_id + '-' + today})` | One alert per card per day max |
| `notifications` ↔ topbar/sidebar | UI reads `Alpine.store('notifications').unreadCount` | Single source — sidebar `hasAlertBadge('preordain')` deprecated, badge moves to bell only |
| `treasure-cruise` ↔ `lhs-popout` | Popout binds to `Alpine.store('collection')` for quick-add state | No new store needed — popout is presentation, state lives in collection |
| `precons.js` ↔ Treasure Cruise + Thousand-Year Storm | Both screens import `getPrecon(setCode)` directly | Service handles cache check; consumers don't know about caching |

---

## 8. Anti-Patterns to Avoid

### Anti-Pattern 1: Putting sync logic in a Web Worker on day one

**What people do:** "Network IO should be off the main thread, let's worker-ise sync."
**Why it's wrong:** Dexie can be used from workers but the existing 11 stores all hold direct `db` references in the main thread. Moving sync to a worker forces a postMessage protocol for every queue insert and a duplicate Dexie connection (Dexie uses one IDB connection per JS realm). The complexity buys you nothing for a queue that flushes 1-10 items every few seconds.
**Do this instead:** Keep sync in main thread. Revisit only if Phase 13 perf measurement shows >50 ms blocking during burst flushes. The bulk-data worker exists for a reason — 300 MB JSON parse — sync has nowhere near that cost profile.

### Anti-Pattern 2: One Alpine store for "auth + sync + profile"

**What people do:** Cram cloud concerns into one mega-store.
**Why it's wrong:** Three different lifecycles (auth = session, sync = network, profile = preferences). Tests for each become coupled. A bug in sync error display would force re-rendering every profile widget.
**Do this instead:** Three stores (`auth`, `sync`, `profile`/`notifications`), each with a single concern. Cross-store coordination via `Alpine.effect` or explicit dispatch.

### Anti-Pattern 3: Mutating `index.html` shell for the LHS popout

**What people do:** Add a permanent `<aside>` to `index.html` that's `x-show`-bound to a route check.
**Why it's wrong:** Breaks screen independence — every screen now has a hidden 280 px column reserved. Other screens' grid math becomes wrong. Future screens have to know the popout exists.
**Do this instead:** Layout owned by `screens/treasure-cruise.js`. The screen mount renders `[popout | content]` grid inside `#main-content`. Other screens see `#main-content` as a single column.

### Anti-Pattern 4: Last-Write-Wins on `deck_cards`

**What people do:** Apply LWW row-by-row.
**Why it's wrong:** `deck_cards` is a join table. If device A adds cards X, Y and device B adds card Z while both offline, LWW on the deck row resolves OK but `deck_cards` rows from each device collide on `(deck_id, scryfall_id)` and one set silently loses.
**Do this instead:** Special-case `deck_cards` — merge by `(deck_id, scryfall_id)`, sum quantities, take latest `notes`/`foil`. Documented in `services/sync-conflict.js`.

### Anti-Pattern 5: Pulling without suppressing hooks

**What people do:** Pull writes data via the same `db.collection.put()` that user code uses.
**Why it's wrong:** The Dexie hook fires, queue gets the remote row appended, next flush pushes the row back to Supabase, Supabase's Realtime fires, pull sees "new" row, infinite loop with monotonically increasing `updated_at`.
**Do this instead:** Module-scoped `_suppressHooks` flag, set true around pull writes, hook checks it and returns early.

### Anti-Pattern 6: Silent perf collection that never surfaces

**What people do:** Collect web-vitals to localStorage, never look at them.
**Why it's wrong:** Phase 13 optimisation needs the data — if it's never reviewed, it's wasted overhead.
**Do this instead:** Console-log every metric in dev. At minimum, add a DevTools-style command (`window.__cf_perf()`) that prints the rolling average. Optional: tiny dashboard widget showing P50/P95 boot time over last 50 sessions.

### Anti-Pattern 7: Making the bell badge two badges

**What people do:** Keep market's sidebar badge, add a separate bell with sync errors only.
**Why it's wrong:** Two surfaces for "you have unread things" splits attention and forces users to learn which badge means what.
**Do this instead:** One bell, all kinds. Filter chips inside `/alerts` (`Price`, `Sync`, `App`). Sidebar Preordain link loses its badge — that information now lives at the bell.

---

## 9. Scaling Considerations

| Scale | Adjustments |
|-------|-------------|
| 1 device per user (today) | LWW conflict policy is fine; Realtime channel optional |
| 2-3 devices per user (v1.1 target) | LWW + dedupe; pull-on-focus + 5-min poll covers 99% of cases; Realtime channel for real-time co-presence (one device updates, other sees within 1 s) |
| Heavy multi-device (out of scope) | Would need per-device vector clocks; CRDT for `deck_cards`; not needed for v1.1 |

### Scaling priorities (when first cracks appear)

1. **First bottleneck — initial sync after sign-in.** Pulling 5,000-card collection in one shot will block UI. Mitigation: paginate pull by `updated_at` ranges, show progress in `auth-modal` post-signin.
2. **Second bottleneck — Realtime channel cost.** Each open device holds an open WebSocket. Free-tier Supabase caps at 200 concurrent. If user count exceeds that, drop Realtime, rely on pull-on-focus only.
3. **Third bottleneck — sync_queue grows unbounded offline.** A user who's offline for weeks then signs back in could have 10k queued items. Mitigation: cap queue at 5000 entries; if exceeded, drop oldest non-delete ops and force a full re-pull on reconnect.

---

## 10. Confidence & Open Questions

**HIGH confidence:**
- Existing architecture map (read directly from source)
- File-level integration points (every modified file inspected)
- Schema v5 → v6 migration shape (Dexie versioning is well-established)
- Build order dependencies (logical analysis from existing code)

**MEDIUM confidence:**
- Conflict resolution policy — LWW + deck_cards merge is appropriate for single-user multi-device, but real-world testing on race conditions needed in Phase 11
- Realtime channel cost vs poll-on-focus — depends on deployment scale, defer decision to Phase 11

**LOW confidence / needs phase-level research:**
- Supabase Postgres schema design (column naming, indices, RLS policy details) — Phase 11 prerequisite
- OAuth redirect URL handling for Vercel preview deploys — Phase 10 setup task
- Exact `web-vitals` package version API surface — Phase 7, verify with package docs

**Open architectural questions to resolve before Phase 11:**
1. Does the precon service write into `db.cards` (extending the bulk-data table) or into a separate `db.precons` table? Recommendation above is separate to avoid polluting bulk data, but this needs a Phase 8 spike.
2. Should `notifications` items persist to IndexedDB or stay in-memory? Recommend IndexedDB (`db.meta.notifications`) so unread state survives reload — confirm in Phase 12.
3. Should anonymous users' local data auto-migrate to their account on first sign-in, or require an explicit "import my local data" button? Recommend auto-migrate (queue flushes immediately on auth) — confirm UX in Phase 10.

---

## Sources

- `d:\Vibe Coding\counterflux\src\main.js` — current boot order (lines 26-81)
- `d:\Vibe Coding\counterflux\src\router.js` — Navigo lazy-load pattern (lines 21-65)
- `d:\Vibe Coding\counterflux\src\db\schema.js` — Dexie versioning history v1-v5 (lines 5-47)
- `d:\Vibe Coding\counterflux\src\stores\profile.js` — current localStorage persistence (lines 1-40)
- `d:\Vibe Coding\counterflux\src\stores\app.js` — toast store (lines 26-81)
- `d:\Vibe Coding\counterflux\src\stores\game.js` — game record shape, autosave debounce (lines 26-42, 257-276)
- `d:\Vibe Coding\counterflux\src\stores\market.js` — current alert badge wiring (lines 71-128)
- `d:\Vibe Coding\counterflux\src\components\sidebar.js` — `hasAlertBadge` coupling to market store (lines 32-36)
- `d:\Vibe Coding\counterflux\src\workers\bulk-data-pipeline.js` — existing worker pattern reference (full file)
- Dexie hooks: https://dexie.org/docs/Table/Table.hook('creating') — `creating` / `updating` / `deleting` signatures
- Supabase JS v2: https://supabase.com/docs/reference/javascript — `signInWithOtp`, `onAuthStateChange`, RLS guidance
- web-vitals: https://github.com/GoogleChrome/web-vitals — `onLCP` / `onINP` / `onCLS` / `onTTFB` API
