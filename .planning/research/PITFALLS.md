# Domain Pitfalls — v1.1 Second Sunrise

**Domain:** Adding auth + cloud sync + schema migration to an existing local-first MTG SPA
**Researched:** 2026-04-14
**Confidence:** HIGH (Supabase/Dexie pitfalls verified against official docs and 2026 community post-mortems); MEDIUM (game timer / Web Vitals findings inferred from spec + browser docs)

> This file documents pitfalls specific to **adding** these features to a stable v1.0 local-first app. v1.0-era foundation pitfalls (multi-face cards, JSON.parse on bulk data, IndexedDB eviction) are documented in the v1.0 PITFALLS.md sibling file and are not repeated here.

---

## Critical Pitfalls

Mistakes that cause silent data loss, account compromise, or fundamental architecture failures.

---

### Pitfall 1: Skipping Migration Function on Dexie v5 → v6 Bump

**What goes wrong:**
The v6 schema adds `turnLaps` to the existing `games` table (or restructures it). A developer adds `db.version(6).stores({ games: '...' })` but forgets the `.upgrade(tx => ...)` callback. Existing v1.0 users open v1.1, Dexie sees a structural change, runs the version transition with no upgrade function, and the games table either: (a) keeps old rows but new code crashes reading missing `turnLaps`, or (b) for stores marked with primary key changes, drops rows entirely.

**Why it happens:**
The Dexie tutorial shows `version().stores()` as the canonical pattern. The `.upgrade()` step is documented separately and looks optional for "just adding a field." For non-indexed property additions, no upgrade IS technically needed — but if you also rename, restructure, or change primary key shape (likely with turn laps as a sub-collection), data loss follows. v1.0 went through 5 schema versions in 8 days without ever needing a destructive migration, so the team has no muscle memory for this case.

**Why it bites HARD here:**
v1.0 users have months of game history. There is no cloud backup yet (sync ships in this same milestone). A botched migration is unrecoverable user data loss.

**How to avoid:**
1. **Test the migration on real v5 data, not empty databases.** Add a Vitest integration test:
   ```js
   // tests/db/migration-v5-to-v6.test.js
   const v5Db = await openV5DbWithFixtures(GAMES_FIXTURE_50_ROWS);
   const v6Db = await upgradeToV6(v5Db);
   expect(await v6Db.games.count()).toBe(50);
   expect((await v6Db.games.toArray()).every(g => Array.isArray(g.turnLaps))).toBe(true);
   ```
2. **Keep ALL prior `db.version(N)` declarations.** Dexie chains migrations; deleting v1-v5 blocks breaks users on those versions.
3. **Provide explicit `.upgrade()` when adding fields** even if technically optional — initialise `turnLaps: []` on every existing game so reads never see `undefined`.
4. **Never change the primary key on synced tables.** Per Dexie Cloud best practices, "if you need to migrate, create another table and migrate the data using REST or CLI export/import." Since `games` will sync, lock its PK shape now.
5. **Add an `onblocked` handler** that toasts "Please close other Counterflux tabs to upgrade." Without this, a user with two tabs hangs silently.
6. **Snapshot to localStorage before running upgrade.** Stringify `games` table to localStorage with key `games_v5_backup_<timestamp>`. If the upgrade throws, restore. Delete backup after verification.

**Warning signs:**
- Console errors `Cannot read properties of undefined (reading 'turnLaps')` after fresh upgrade.
- `games.count()` differs between v5 and v6.
- `onblocked` event fires in production logs.

**Phase to address:** SCHEMA (must precede GAME phase — turn laps need the table shape ready).

**Verification:** Migration test passes against fixtures simulating each prior schema version (1-5).

**Confidence:** HIGH — verified via Dexie issues #698, #742, #921, #1145, #1599, #2214 documenting exactly these failure modes.

---

### Pitfall 2: Supabase RLS Disabled or `USING (true)` on Sync Tables

**What goes wrong:**
You create the `collections`, `decks`, `games`, `watchlist` tables in Supabase. RLS is **disabled by default**. You ship. Anyone with the public anon key can `curl` the entire database and read every user's collection, decklist, and game history — or worse, write to them. Even with RLS enabled, a `USING (true)` policy (often AI-generated to "make tests pass") has the same effect.

**Why it happens:**
The default state of every new Supabase table is RLS disabled. The Supabase dashboard shows a yellow warning, but it's easy to dismiss when developing locally where you're the only user. Creating tables via SQL Editor or migrations does not auto-enable RLS. Per 2026 reporting: **83% of exposed Supabase databases involve RLS misconfigurations**, and 170+ Lovable apps were publicly leaking user data in early 2025 from this exact mistake.

**Why it bites HARD here:**
A user's MTG collection is their financial record (cards have real market value, often £1000s+). Leaking other users' decklists destroys trust irrecoverably. Counterflux is also a personal/portfolio project — a security incident is reputationally catastrophic.

**How to avoid:**
1. **Enable RLS on every sync table the moment it's created.** Use a migration template:
   ```sql
   CREATE TABLE collections (...);
   ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users see own collection" ON collections
     FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "users modify own collection" ON collections
     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
   ```
2. **Always include `WITH CHECK` on INSERT/UPDATE policies.** Without it, an authenticated user can insert rows with `user_id = <victim_uuid>` or update existing rows to change ownership.
3. **Test policies from the client SDK in an integration test, not the SQL Editor.** SQL Editor bypasses RLS — you'll see what the postgres role sees, not what your end user sees.
4. **Index every column referenced in an RLS policy.** `WHERE user_id = auth.uid()` triggers a sequential scan without an index on `user_id`. At 100k rows across all users, queries become >50ms; at 1M rows, they time out.
5. **Never use `user_metadata` claims in RLS policies.** Authenticated users can edit their own user_metadata, which lets them spoof access.
6. **Never expose the `service_role` key.** It is rebound to a different Postgres role that bypasses RLS. It belongs in serverless functions only — never `import.meta.env.VITE_*`.
7. **Add an automated RLS audit test** that signs in as User A and tries to read User B's rows. Should return `[]` not 401 (Postgres returns empty under RLS, not an error).

**Warning signs:**
- The Supabase dashboard "Security Advisor" shows red warnings.
- Anonymous `curl` against the table returns rows.
- Two test accounts can see each other's data.

**Phase to address:** AUTH (RLS policies must ship with the table schema, before SYNC phase ships any client code that writes to those tables).

**Verification:** Cross-user data isolation test in CI: sign in as User A, write a deck. Sign in as User B, query decks. Assert User B sees zero rows from User A.

**Confidence:** HIGH — verified via Supabase official docs + multiple 2026 post-mortems (Lovable incident, ProsperaSoft RLS guide, vibeappscanner audit).

---

### Pitfall 3: First-Sync Wipes Local Data (or Vice Versa)

**What goes wrong:**
A v1.0 user creates an account in v1.1. Their browser has 500 cards in IndexedDB. The fresh Supabase row count for their `user_id` is zero. The naive sync algorithm "pull from server, replace local" obliterates their entire collection on first sign-in. The mirror failure: "push local to server, overwrite remote" wipes data from their other devices that signed up first.

**Why it happens:**
First-sync semantics are an explicit decision that's easy to forget. Most sync tutorials assume the local DB starts empty (mobile app pattern), but Counterflux v1.0 has thousands of pre-existing local-only datasets. Pull-then-push and push-then-pull are both wrong on first sync — neither matches user expectation.

**Why it bites HARD here:**
This is the #1 churn risk for the entire milestone. A user who loses their collection on first login will not come back. There is no "undo" once the destructive sync has run.

**How to avoid:**
1. **Detect "first sync" explicitly.** On sign-in, check both:
   - Does Supabase have any rows for this `user_id`?
   - Does local IndexedDB have any rows for this domain (collection, decks, games, watchlist)?
2. **Branch on the four states:**
   - Local empty + Remote empty → no-op, set `last_synced_at`
   - Local empty + Remote populated → pull (safe)
   - Local populated + Remote empty → push (safe — this is the v1.0 user upgrading)
   - **Local populated + Remote populated → MERGE WITH USER CONFIRMATION** (do NOT auto-resolve)
3. **For the populated/populated case, show a "Reconcile your devices" modal:**
   - "We found 500 cards locally and 423 cards in your cloud account."
   - Options: "Merge both" (default, deduplicate by oracle_id+foil+category), "Use local only", "Use cloud only", "Cancel sign-in"
4. **Snapshot before any destructive operation.** Export collection/decks/games to localStorage as JSON before merging. Add an "Undo last sync" button in settings for 24 hours.
5. **Write the first-sync state machine as a Vitest test matrix** covering all four branches × all four domains.

**Warning signs:**
- Beta tester reports "all my cards are gone" after first sign-in.
- Support requests asking to "restore my collection."
- `collection.count()` drops to 0 after sign-in event in telemetry.

**Phase to address:** SYNC (must implement first-sync detection before exposing sign-in to v1.0 users).

**Verification:** Manual QA scenario "sign in as new user with 500 local cards" must show reconciliation modal, not silent overwrite.

**Confidence:** HIGH — this is the canonical local-first sync failure mode, documented in RxDB downsides docs and dexie cloud best practices.

---

### Pitfall 4: Sync Loop / Ping-Pong (Local Update Triggers Remote Update Triggers Local Update)

**What goes wrong:**
Sync fires a Supabase write. Supabase realtime broadcasts the change back. The realtime subscriber writes to local Dexie. A Dexie hook fires. The hook re-queues a sync. Sync writes back to Supabase. Infinite loop. Either the user's network gets hammered, the request queue grows unbounded, or the Supabase realtime quota is exhausted in minutes.

**Why it happens:**
Bidirectional sync feels like "just listen to both sides." Without origin-tagging, every change looks identical regardless of where it came from. Dexie hooks fire on ALL writes, including writes from the sync layer itself.

**How to avoid:**
1. **Tag every write with an origin.** Every change has `origin: 'local-user' | 'sync-pull' | 'sync-push-ack'`. Sync layer ignores writes whose origin is anything other than `local-user`.
2. **Use a per-row `updated_at` and `last_synced_at`.** A row only becomes a sync candidate if `updated_at > last_synced_at`.
3. **Suppress hooks during sync writes.** Wrap pull-into-Dexie operations in a flag (`isSyncing = true`) that the Dexie hook checks before re-queuing.
4. **Idempotency via `change_id` UUID.** Each user-initiated change generates a UUID. Round-tripped echoes carry the same UUID and are dropped.
5. **Add a per-second sync rate limit** as a safety net — if more than 10 syncs/sec attempt to fire, log a loop warning and pause.

**Warning signs:**
- Network tab shows steady-state Supabase POST/PATCH traffic when user is idle.
- Realtime subscription delivers messages with the same `id` repeatedly.
- Sync queue length grows monotonically without user action.

**Phase to address:** SYNC.

**Verification:** Idle-user test: sign in, leave the tab open for 5 minutes with no input. Network panel must show <5 sync requests total (just heartbeats).

**Confidence:** HIGH — universal bidirectional sync pitfall.

---

### Pitfall 5: Last-Write-Wins With Clock Skew

**What goes wrong:**
Two devices edit the same deck. Device A's clock is 30 seconds fast. Device B is correct. Device A makes a change at 12:00:00 (local clock 12:00:30 UTC). Device B makes a change at 12:00:15 (local clock 12:00:15 UTC). Server-side LWW says "Device A's timestamp is newer (30 > 15)" and discards Device B's change — even though Device B was actually 15 seconds later in real time.

**Why it happens:**
Client clocks are unreliable. Browsers don't sync to NTP. Users in different timezones, on travelling laptops, with manual clock settings, or in VMs all have skew measured in seconds-to-minutes. `Date.now()` from the client cannot be trusted as a global ordering.

**How to avoid:**
1. **Always use server-generated `updated_at` timestamps for conflict resolution.** Set `DEFAULT now()` in Postgres and `UPDATE ... SET updated_at = now()` triggers. Never trust client-supplied timestamps for ordering.
2. **For CRDT-friendly fields, prefer last-write-wins per-field, not per-row.** A deck where Device A edited the commander and Device B edited the sideboard should merge both edits, not pick one whole row.
3. **For decklists, consider operation-based sync (ops log) not state-based.** Each "add card", "remove card", "change quantity" is an idempotent operation. Replay produces identical state on both devices regardless of order. v1.1 may not need this, but flag for v1.2 if conflicts become user-visible.
4. **Show conflict UI for irreconcilable cases.** If two devices renamed the same deck differently, present both and let the user choose. Silent overwrite destroys user trust.

**Warning signs:**
- Users report "my changes disappeared after editing on my laptop."
- `updated_at` values in Supabase show timestamps in the future.
- Conflict logs show resolution always favouring one device.

**Phase to address:** SYNC.

**Verification:** Two-browser test with clock skew injected (`Date.now = () => realNow + 60000` in one tab). Edit same deck in both. Assert no edits are lost.

**Confidence:** HIGH — clock skew is a well-documented distributed systems pitfall.

---

### Pitfall 6: Partial Deck Update Leaves Deck in Inconsistent State

**What goes wrong:**
User adds 10 cards to a deck. Sync batches them into a single Supabase request. The request fails halfway through (network drop, RLS violation, payload too large). Three cards are persisted to Supabase, seven aren't. Other devices pull and see a deck that's missing 70% of its contents. Or worse: the Dexie write succeeded, the Supabase write failed, and the local deck disagrees with the remote deck silently.

**Why it happens:**
Multi-row writes are not atomic across the local+remote boundary. Even within Supabase, you need explicit transactions or RPC functions for atomicity. The "happy path" of single-card adds works; the bug only surfaces on bulk operations.

**How to avoid:**
1. **Wrap multi-row deck mutations in a Supabase RPC function** that does the inserts inside a Postgres transaction. All-or-nothing.
2. **For Dexie + Supabase coupling, use a saga pattern:** local write → enqueue sync → on sync failure, mark deck as `sync_pending` and surface "Pending sync" badge in UI. Don't pretend it succeeded.
3. **Version the deck row.** Each deck has a `version` integer that increments per mutation. On pull, if remote `version != local known_version + 1`, fetch full state and reconcile rather than apply diff.
4. **Always sync deck-as-a-whole on conflict.** A deck is small (typically <100 rows). Don't try to merge individual card adds across diverging trees — pull the whole deck and let user pick.

**Warning signs:**
- A deck shows different card counts in the analytics sidebar vs. the card grid.
- `deck.cards.length` !== count of `deck_cards` rows for that deck.
- Sync queue contains stale operations targeting deleted decks.

**Phase to address:** SYNC.

**Verification:** Network-fail test: simulate Supabase 500 mid-batch on an `add 10 cards` operation. Assert deck shows correct local state and "pending sync" indicator.

**Confidence:** HIGH.

---

### Pitfall 7: Offline Queue Survives Across Account Switches

**What goes wrong:**
User A signs in, makes 50 changes offline. Queue holds them. User A signs out without going online. User B signs in on the same browser. Queue flushes to User B's account. User B's collection is now polluted with User A's edits. Worst case: under RLS, the inserts fail (good); medium case: the inserts succeed under User B's auth and User B silently inherits 50 random card additions.

**Why it happens:**
The sync queue is naturally a global IndexedDB store. It doesn't know about user identity. Sign-out without flush is an edge case that tutorials skip.

**How to avoid:**
1. **Tag every queue entry with `user_id` at enqueue time.** On flush, only process entries matching the currently authenticated `user_id`.
2. **On sign-out, prompt user:** "You have 50 unsynced changes. Sync now, discard, or cancel sign-out?" Default = sync now, blocking sign-out until done or explicit discard.
3. **On sign-in, refuse to flush queue entries for a different `user_id`.** Move them to a `quarantine_queue` and surface a settings UI to manually export/discard.
4. **Cap queue size.** Hard limit of 1000 entries; oldest get archived to a local-only "rescue export" file when limit hits. Prevents unbounded growth from a stuck sync.

**Warning signs:**
- Sign-in followed by unexpected new rows in cloud data.
- Queue size grows past 100 with no successful sync in between.
- Two account UUIDs appear in the same queue.

**Phase to address:** SYNC.

**Verification:** Multi-account test: sign in as A, queue 5 changes offline, sign out, sign in as B. Assert queue does not flush to B's account.

**Confidence:** HIGH.

---

### Pitfall 8: Auth State Race With Store Init

**What goes wrong:**
Page loads. Alpine stores initialise (collection, deck, game). Each store reads from local Dexie and renders UI. Meanwhile, Supabase auth client async-checks the session token and resolves 200ms later. The user's signed-in state arrives AFTER the stores have rendered as "anonymous." The collection screen shows local-only data, then flickers/replaces when auth resolves and pull begins. Worse: a write fired during the 200ms window goes out without `user_id`, gets RLS-rejected silently, and the user's "added a card" never persists to cloud.

**Why it happens:**
Alpine stores init synchronously on `alpine:init`. Supabase `getSession()` is async. Without explicit gating, they race.

**How to avoid:**
1. **Block the app shell behind auth resolution.** Show a splash/skeleton until `supabase.auth.getSession()` resolves. Then init stores with auth context already known.
2. **Stores accept an `authState` parameter at init.** Don't read auth from a global; pass it explicitly so the dependency is visible.
3. **All sync-eligible writes check `authState.ready === true`** before enqueueing; otherwise queue locally with `pending_auth: true` and flush on auth ready.
4. **Auth state changes (sign-in, sign-out, token refresh) trigger a deliberate store rehydration**, not a partial reactive update. Easier to reason about.

**Warning signs:**
- UI flicker on page load (anonymous → authenticated).
- Console warnings about RLS rejections in the first second of load.
- Writes silently disappear if performed in the first 200ms of load.

**Phase to address:** AUTH.

**Verification:** Slow-network test: throttle to Slow 3G in DevTools. Reload signed-in. Assert no anonymous-state flash, no pre-auth writes attempted.

**Confidence:** HIGH.

---

### Pitfall 9: Sync Queue Stuck Forever On Permanent Error

**What goes wrong:**
A queue entry contains a write that will never succeed (e.g., references a `deck_id` that was deleted on another device, violates a CHECK constraint added in a server migration, or has malformed data). The queue retries with exponential backoff. On retry #20, the backoff is 17 minutes. The queue head is permanently blocked, so all subsequent legitimate writes pile up behind it.

**Why it happens:**
Naive retry logic doesn't distinguish transient errors (network, 5xx) from permanent errors (4xx, constraint violations). Treating them all as transient creates head-of-line blocking.

**How to avoid:**
1. **Classify errors at the response layer.** 408/429/500/502/503/504 → retry. 400/401/403/404/409/422 → dead-letter.
2. **Dead-letter queue with user-visible badge.** "3 changes can't sync — tap to review." Lets user manually resolve or discard.
3. **Cap retries at 5.** Beyond that, move to dead-letter.
4. **Out-of-band processing:** queue is per-entity, not strictly serial. A stuck `decks` entry doesn't block `collection` syncs.
5. **Telemetry: log dead-letter count.** If it grows, investigate.

**Warning signs:**
- Queue length stays nonzero after going online.
- "Pending sync" badge never clears.
- Same error logged repeatedly with growing backoff intervals.

**Phase to address:** SYNC.

**Verification:** Inject a permanent 422 on a single queue entry. Assert dead-letter UI appears, other entries continue to sync.

**Confidence:** HIGH.

---

### Pitfall 10: Magic Link Hash Fragment Lost on SPA Reload

**What goes wrong:**
User clicks magic link in email. Browser navigates to `https://counterflux.app/#access_token=eyJ...&type=magiclink`. Navigo (SPA router) sees the hash and tries to route to a non-existent screen. Either: (a) it strips the hash, sending the user to dashboard with no auth set, or (b) it throws a route-not-found error and the auth callback never fires.

**Why it happens:**
Supabase JS uses URL fragments by default for OAuth/magic link callbacks. Hash-based SPA routers (like Navigo) intercept the same fragment. They collide.

**How to avoid:**
1. **Configure Supabase to use PKCE flow with `flowType: 'pkce'`.** This puts the code in the query string (`?code=...`), not the fragment, and avoids router collision.
2. **Add an auth callback route to Navigo:** `/#auth-callback` or `/auth/callback`. Register it BEFORE other routes so it matches first.
3. **In the callback handler, call `supabase.auth.exchangeCodeForSession(window.location.href)` immediately**, then `router.navigate('/dashboard')` to clean the URL.
4. **Test in a real email client.** Outlook, Gmail, and Apple Mail wrap links differently — some open in app-internal browsers that handle redirects oddly.

**Warning signs:**
- Magic link appears to log user in, but `getSession()` returns null after redirect.
- Browser URL retains `access_token=...` after auth supposedly completes.
- Console logs route-not-found for `/#access_token=...`.

**Phase to address:** AUTH.

**Verification:** End-to-end test: trigger magic link, click via link in test email account, assert user lands on dashboard with valid session.

**Confidence:** HIGH — well-documented Supabase + SPA router collision.

---

### Pitfall 11: Web Vitals Observer Slowing Down Boot Itself

**What goes wrong:**
You add `web-vitals` library to measure LCP, FID, CLS, INP, TTFB. The observer registers `PerformanceObserver` callbacks early in boot. The library is ~5KB gzipped but its evaluation runs synchronously in the critical path, and its callback closures retain references to layout shift entries that prevent GC. Result: the act of measuring boot performance regresses boot performance by 50-200ms — and you "fix" the regression you accidentally introduced.

**Why it happens:**
Naive perf instrumentation is added at the top of `main.js` to "make sure we don't miss the early metrics." It runs before any user code and competes with the same critical path it's measuring. Also: `console.log`-ing every metric is itself expensive on Chrome DevTools open.

**How to avoid:**
1. **Lazy-load web-vitals after first paint.** Use `requestIdleCallback(() => import('web-vitals'))` so the measurement library doesn't compete with the thing being measured.
2. **Don't `console.log` metrics in production.** Send to analytics only. Console logging in DevTools-open scenarios distorts results.
3. **Measure with and without instrumentation.** Run a "no-instrument" baseline on a separate branch. If instrumented runs are >5% slower, you've biased your data.
4. **Use the browser's built-in DevTools Performance panel for one-off baselining.** Don't ship instrumentation just to get a number you only need once.
5. **For ongoing monitoring, sample.** Send web-vitals from 10% of sessions, not 100%.

**Warning signs:**
- Boot time regresses after PERF phase commits.
- LCP measurement varies wildly between identical loads.
- Long-task warnings in Performance panel point to web-vitals callbacks.

**Phase to address:** PERF.

**Verification:** A/B baseline: branch A has no instrumentation, branch B has it. LCP delta should be <50ms. If larger, instrumentation is the bottleneck.

**Confidence:** MEDIUM — extrapolated from web-vitals docs and general perf observer behaviour; not directly post-mortem-verified.

---

### Pitfall 12: Game Timer Drift From Background Tab Throttling

**What goes wrong:**
Game tracker turn lap timer uses `setInterval(tick, 1000)`. User switches to another tab to check Scryfall. Chrome throttles the interval to once per minute after 5 minutes of being hidden (per Chrome 88+ behaviour). User switches back. The displayed lap time is off by minutes. Worse: lap durations persisted to game history are wrong, and post-game charts show garbage data.

**Why it happens:**
Browsers aggressively throttle `setTimeout`/`setInterval` in background tabs to save battery. Chrome reduces to 1Hz then 1/min; Firefox enforces minimum delays; Safari similar. `Date.now()` deltas are correct (wall clock), but interval-based counters that increment a variable are not.

**Why it bites HARD here:**
Vandalblast is a play-along tool. Users WILL switch tabs mid-game (to look up rulings, check Scryfall, message their pod). This is the primary use case, not an edge case.

**How to avoid:**
1. **Never count seconds. Always compute deltas from wall-clock anchors.** Store `lap_started_at = performance.now()` (or `Date.now()` if you need wall-clock semantics). On render, compute `currentLap = now - lap_started_at`.
2. **Use `requestAnimationFrame` for UI updates** when the tab is visible. RAF naturally pauses when hidden, but the underlying `lap_started_at` anchor doesn't drift.
3. **For wall-clock anchor, use `Date.now()` not `performance.now()`** if turns can span sleep/wake cycles. `performance.now()` may freeze; `Date.now()` reflects system clock advancement.
4. **Persist the anchor, not the elapsed.** If user reloads or app crashes mid-turn, lap can resume from `Date.now() - lap_started_at`.
5. **Detect impossible deltas.** If a lap delta exceeds 4 hours, something's wrong (sleep, clock change, bug). Cap and flag for user review.
6. **Move the timer logic to a Web Worker** as a fallback. Workers aren't subject to the same throttling rules.

**Warning signs:**
- Lap durations consistently show "0:00" after tab return.
- Post-game charts have impossible turn-time values (e.g., 6 hours for one turn).
- Bug reports about "the timer froze."

**Phase to address:** GAME (turn laps feature).

**Verification:** Background-tab test: start a game, switch tabs for 2 minutes, return. Assert lap timer reflects ~2 elapsed minutes, not 1 second per minute throttled.

**Confidence:** HIGH — Chrome 88 throttling behaviour is well-documented; W3C hr-time #65 confirms `performance.now()` may freeze.

---

### Pitfall 13: Scryfall Rate Limit Violation On Bulk Precon Import

**What goes wrong:**
Precon quick-add fetches a Commander precon's 100 cards. Naive implementation fires 100 parallel `fetch('/cards/named?...')` calls. Scryfall's TOS requires 50-100ms minimum between requests. The user gets rate-limited, possibly IP-banned for the day. The quick-add silently fails for half the cards.

**Why it happens:**
The existing v1.0 `ScryfallService` has a 75ms-spaced queue, but it's easy to bypass it accidentally — `Promise.all(cards.map(c => fetch(...)))` doesn't go through the queue.

**How to avoid:**
1. **Use the existing `ScryfallService` queue for ALL Scryfall calls. Always.** Refactor any direct fetch to go through the queue; add a lint rule (`no-restricted-globals: ['fetch']`) scoped to files that talk to Scryfall.
2. **Prefer bulk endpoints when available.** Scryfall's `/cards/collection` endpoint accepts up to 75 identifiers per request, fetching 75 cards in 1 request instead of 75. For 100-card precons, that's 2 requests.
3. **Cache precon contents in IndexedDB.** A precon list rarely changes after release. Fetch once, cache forever (with an expiry of 30+ days).
4. **Show progress UI** ("Adding 47 of 100 cards…") so users don't refresh and double-trigger the import.
5. **Set User-Agent on every request** (already a v1.0 requirement; verify no regression).

**Warning signs:**
- Network panel shows >12 concurrent Scryfall requests.
- HTTP 429 responses in console.
- Precon import "completes" but card count is wrong.

**Phase to address:** COLLECT (precon quick-add) and SPOILER (if spoiler refresh fetches in bulk).

**Verification:** Import a 100-card precon, assert all 100 cards appear, no 429 responses, total wall time matches expected (75ms × N requests).

**Confidence:** HIGH.

---

### Pitfall 14: LHS Pop-Out Panel Breaks z-index / Focus Trap

**What goes wrong:**
The new LHS add-to-collection pop-out renders above the topbar but BELOW the existing modals (settings, deck import, shortcut cheat sheet). When a modal opens while the pop-out is visible, the modal appears behind it, becoming inaccessible. Worse: focus trap escapes — Tab key cycles into the pop-out from inside an open modal, breaking accessibility.

**Why it happens:**
v1.0 has an established z-index hierarchy that lives implicitly in CSS files. Adding a new layer without updating the hierarchy creates collisions. Modal libraries assume they're the topmost layer.

**How to avoid:**
1. **Document the z-index hierarchy as named CSS custom properties:**
   ```css
   :root {
     --z-base: 0;
     --z-sticky-header: 100;
     --z-popout-panel: 200;
     --z-modal-backdrop: 1000;
     --z-modal: 1010;
     --z-toast: 2000;
     --z-tooltip: 3000;
   }
   ```
   Refactor existing magic numbers to use these tokens.
2. **Pop-out should be in DOM but `visibility: hidden`** when closed, not unmounted, so focus management is predictable.
3. **Use the `inert` attribute** on background content when a modal opens. Native Tab-trapping, no JS gymnastics.
4. **Test focus order with Tab key only (no mouse).** If you can't reach close button via Tab, screen reader users can't either.
5. **Test "modal opens while pop-out is open."** Modal must visually cover pop-out and steal focus.

**Warning signs:**
- Modals appearing behind other UI.
- Tab key cycles through hidden elements.
- `aria-modal="true"` content fails axe-core checks.

**Phase to address:** COLLECT (LHS pop-out implementation) and POLISH (z-index audit pass).

**Verification:** Manual a11y check + axe-core test that asserts modal content has correct stacking and inert background.

**Confidence:** HIGH.

---

### Pitfall 15: Lazy-Loaded Chunks Break After Cache Bust on Deploy

**What goes wrong:**
PERF phase introduces aggressive route-based code splitting. Each screen module is its own chunk with a content hash (`Treasure-Cruise.a3f2b1.js`). User loads the app at 09:00. You deploy at 09:30 — old chunks are deleted from the CDN, new chunks have new hashes. User navigates from Dashboard to Treasure Cruise at 10:00. Browser requests the old hash, gets 404, navigation fails with a blank screen and `ChunkLoadError` in console.

**Why it happens:**
Vite's default behaviour is to assume same-version chunks are always available. There's no built-in "version mismatch detected, please reload" UX. The bug only surfaces when a user has the app open across a deploy.

**How to avoid:**
1. **Detect ChunkLoadError globally.** Wrap dynamic imports in a handler:
   ```js
   try { await import('./screens/treasure-cruise.js') }
   catch (e) {
     if (e.name === 'ChunkLoadError' || /Loading chunk \d+ failed/.test(e.message)) {
       toast.show('App updated. Reloading…');
       location.reload();
     }
   }
   ```
2. **Set CDN cache headers to keep old chunks for 24h after deploy.** Don't immediately purge.
3. **Embed a build version constant** in `index.html`. On focus/visibility change, fetch `/version.txt`. If it changed, prompt the user to reload at a safe moment.
4. **Don't lazy-load screens that are reachable in <1 click from the current screen.** Saves a network round-trip without sacrificing meaningful payload.

**Warning signs:**
- Sentry/console errors `Loading chunk X failed` after deploy.
- Users report "got a blank screen, had to reload."
- Navigation works in dev (no chunking) but fails in prod.

**Phase to address:** PERF.

**Verification:** Build version A, load in browser, deploy version B, navigate to a lazy screen. Assert reload prompt fires, not blank screen.

**Confidence:** HIGH.

---

### Pitfall 16: Stale Precon Data After Set Release

**What goes wrong:**
You cache Scryfall precon products by `set_code` for 30 days. A new Commander set drops. Wizards updates the precon contents post-release (corrections, swap-outs). Users adding the precon for 30 days post-launch get the wrong list.

**Why it happens:**
Treating precon data as static is reasonable — it usually IS — but Scryfall does update entries when WotC issues corrections. Aggressive caching hides this.

**How to avoid:**
1. **Cache precon contents by `id + released_at`.** If the released set's `updated_at` from Scryfall changes, invalidate.
2. **Cache for 7 days for sets released in the last 60 days; 30 days otherwise.** Recent sets get more frequent re-checks.
3. **Show "Cached on YYYY-MM-DD" with a "Refresh" button** in the precon picker UI, so power users can force-refresh.
4. **Track Scryfall bulk data refresh date.** If bulk data is fresher than the cached precon, invalidate.

**Warning signs:**
- Users report "this precon doesn't match what's in the box."
- Cached precon list doesn't match Scryfall website list.

**Phase to address:** COLLECT (precon quick-add).

**Verification:** Mock Scryfall returning updated precon contents, assert cache invalidates on `released_at` change.

**Confidence:** MEDIUM — verified Scryfall does update product data, but timing/frequency is anecdotal.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `.upgrade()` callback for "just adding a column" | Saves 30 minutes of test writing | First user who lost games to crash | **Never** for v1.0→v1.1 schema bump |
| `USING (true)` RLS policy "until I figure out the real one" | Tests pass immediately | Public data leak, see Lovable incident | **Never** — table without correct policy stays disabled |
| Single sync queue without per-user tagging | Simpler initial implementation | User A's data flushed to User B's account | **Never** — single-user mode only |
| `Date.now()` for game lap deltas without wall-clock anchor | Works in foreground | Background tab throttling destroys data | **Never** — anchor + delta is the same effort |
| Direct `fetch('https://api.scryfall.com/...')` outside the queue | Bypasses queue overhead for "just one call" | Rate limit ban, broken precon import | **Never** — always go through queue |
| `console.log` web-vitals metrics | Easy debugging | Distorts the measurements you're collecting | Dev only; strip in production |
| Service role key in client env vars "just for now" | Skip serverless function setup | Total RLS bypass, full data exposure | **Never** — server-only |
| Bidirectional sync without origin tagging | Simpler initial code | Sync ping-pong, network hammering | **Never** — origin tag is one extra field |
| Lazy-load every route to "save kB" | Smaller initial bundle | Chunk-load failures after deploy | Skip lazy-load for routes <1 click from entry |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (magic link) | Hash fragment collision with hash-based SPA router | Use PKCE flowType, register `/auth/callback` route first |
| Supabase Auth (Google OAuth) | Forget to add redirect URL to Google Console + Supabase project settings | Document both in `.env.example`; verify on each new deploy environment |
| Supabase RLS | Test policies in SQL Editor (which bypasses RLS) | Test from client SDK with two real test accounts |
| Supabase Realtime | Subscribe per-table without filter, get other users' broadcasts | Always filter subscriptions by `user_id` |
| Supabase JS client | Re-create client on every render, leaking subscriptions | Singleton per page load, attached to Alpine global |
| Dexie hooks | Hooks fire on sync-pull writes, triggering re-sync loop | Suppress hooks during sync via flag; tag origin |
| Dexie schema | Delete old `db.version(N)` blocks once "everyone's upgraded" | Never delete; chain must remain intact |
| Scryfall `/cards/collection` | Pass >75 identifiers per request | Chunk into batches of 75 |
| Scryfall bulk data | Re-download even when 304 Not Modified | Use Scryfall's `Last-Modified` header + If-Modified-Since |
| Navigo router | Routes registered after auth callback, callback never matches | Register `/auth/callback` before catch-all routes |
| Vite production build | Lazy-loaded chunk references stale after deploy | Add ChunkLoadError handler that prompts reload |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `await` per-row Supabase write in loop | Sync of 50 cards takes 25s | Batch into bulk insert with `upsert([])` | >10 rows |
| Realtime subscription per row visible | Memory leak, message storm | Single subscription per table, filter by user_id | >50 visible items |
| Web-vitals observer in critical path | Boot time regression | Lazy-load via requestIdleCallback | Always |
| Re-fetch precon on every panel open | Repeated 75-request bursts | Cache by id+released_at, 7-30 day TTL | Multiple precon picks per session |
| Sync poll instead of realtime | Constant network chatter | Use Supabase Realtime channels | Always |
| Eager-loading all screen modules at boot | Slow LCP | Lazy-load below-the-fold screens; bundle frequent ones | Initial load |
| Render entire collection list (no virtual scroll) on resync | Frame drops, scroll jank | Reuse v1.0 virtual scroll for synced view | >500 cards (already crossed) |
| Unbounded sync queue retention | IndexedDB bloat | Cap queue at 1000, archive overflow | >1000 unsynced edits |
| Recompute deck analytics on every sync pull | UI jank during syncs | Debounce analytics; skip recalc if cards unchanged | Every sync after edit |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on any sync table | Public data exposure of every user's collection | Migration template enables RLS + adds policy in same SQL block |
| `service_role` key in client bundle | Full RLS bypass, total data control | Server-only env; lint rule blocks in client paths |
| Trust `user_metadata` in RLS policy | User can spoof access by editing their own metadata | Only use `auth.uid()` and verified claims |
| Magic link redirect URL not allow-listed | Auth code interceptable on attacker domain | Allowlist in Supabase project settings; reject all others |
| Storing JWT in localStorage | XSS exfiltration | Supabase JS uses localStorage by default; mitigate via strict CSP + no inline scripts |
| Logging Supabase responses with auth tokens | Tokens leak via console/Sentry | Strip `access_token`/`refresh_token` before any logging |
| OAuth state parameter not validated | CSRF on auth flow | Supabase handles by default — don't override callback handling |
| INSERT policy without WITH CHECK | User can insert rows owned by others | Always include `WITH CHECK` on INSERT/UPDATE policies |
| Allow unauthenticated card data writes | Vandalism of shared data | All `INSERT/UPDATE/DELETE` policies require `auth.uid() IS NOT NULL` |
| Profile photo upload without size/type validation | DoS via huge files; XSS via SVG | Validate client-side AND in Supabase Storage policies |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent first-sync overwrite | User loses 500 cards, never returns | Show reconciliation modal with merge/local/cloud choice |
| No "pending sync" indicator | User unsure if changes are saved | Status chip in topbar: synced / syncing / offline / error |
| "You have unsaved changes" only on tab close | User loses work on a different page navigation | Auto-save mid-edit; sync within seconds |
| Sign-out without warning about queued changes | Lost edits, user blames the app | Block sign-out with "You have N unsynced changes" prompt |
| Sync errors shown as cryptic JSON | User can't act on the error | Plain-language error + actionable "Retry" / "Discard" |
| Magic link email looks like spam | Low conversion on first sign-in | Customise template; sender domain matches app domain |
| Background tab game timer freezes | User mid-game can't tab to look up a ruling | Wall-clock anchored timer immune to throttling |
| LHS pop-out blocks the workflow it's part of | "Where did my collection go?" | Pop-out, don't replace the main view |
| Spoiler images load all at once | 30s blank state on first load | Lazy-load on scroll, blur-up placeholders |
| Profile menu logs out without confirm | Accidental clicks lose work | Two-step confirm OR put sign-out behind a settings page |

## "Looks Done But Isn't" Checklist

- [ ] **Auth sign-in:** Often missing — token persistence test (close tab, reopen, still signed in)
- [ ] **Auth sign-out:** Often missing — verifies queue is flushed/preserved per policy
- [ ] **Magic link:** Often missing — tested in real Gmail/Outlook (not just localhost)
- [ ] **Google OAuth:** Often missing — redirect URL configured for production domain (not just dev)
- [ ] **RLS policies:** Often missing — cross-user access test (User A can't see User B's data)
- [ ] **First sync:** Often missing — reconciliation modal for populated-local + populated-remote
- [ ] **Sync queue:** Often missing — per-user tagging tested across account switch
- [ ] **Sync queue:** Often missing — dead-letter handling for permanent errors
- [ ] **Sync conflicts:** Often missing — clock-skew test with two-tab simulation
- [ ] **Schema migration:** Often missing — integration test against fixtures of every prior version
- [ ] **Schema migration:** Often missing — `onblocked` handler with user-visible toast
- [ ] **Schema migration:** Often missing — localStorage backup before destructive changes
- [ ] **Game timer:** Often missing — background-tab throttling test
- [ ] **Game timer:** Often missing — sleep/wake recovery (laptop closed mid-game)
- [ ] **Precon import:** Often missing — bulk endpoint use, not parallel single fetches
- [ ] **Precon import:** Often missing — progress UI for >10 second imports
- [ ] **LHS pop-out:** Often missing — z-index hierarchy documented as CSS tokens
- [ ] **LHS pop-out:** Often missing — focus trap test with Tab key only
- [ ] **LHS pop-out:** Often missing — modal-over-popout layering verified
- [ ] **Lazy-loaded chunks:** Often missing — ChunkLoadError handler with reload prompt
- [ ] **Web-vitals instrumentation:** Often missing — A/B baseline confirms <50ms overhead
- [ ] **Spoiler refresh:** Often missing — image lazy-load + blur-up placeholder
- [ ] **Profile photo upload:** Often missing — file size + MIME type validation
- [ ] **Notification bell:** Often missing — badge count clears on read, not just on click
- [ ] **Sync status chip:** Often missing — distinguishes offline vs. error vs. syncing

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Botched Dexie migration loses user data | HIGH | Restore from localStorage backup (if implemented); else lost. Issue patch release that detects corrupted state and offers CSV re-import. |
| RLS misconfiguration leaks data | CRITICAL | Disable affected tables immediately. Rotate Supabase anon key. Notify affected users. Audit policies. Disclose per regulations. |
| First sync overwrites user data | HIGH | If snapshot was taken: restore from localStorage. If not: lost. Add reconciliation modal in patch. |
| Sync ping-pong hammers Supabase quota | MEDIUM | Disable sync via feature flag. Patch with origin tagging. Re-enable. |
| Service role key exposed | CRITICAL | Rotate key immediately. Audit Supabase logs for unauthorised access during exposure window. |
| Magic link broken | LOW | Disable magic link, fall back to OAuth. Patch redirect handling. Re-enable. |
| Stuck queue blocks all syncs | MEDIUM | Add admin "clear queue" in settings. Implement dead-letter classification in patch. |
| Game timer drift corrupts history | MEDIUM | Cap implausible lap durations on display. Offer user a "re-record this game" option. |
| Lazy-load chunk 404 after deploy | LOW | Users reload manually; in patch, add ChunkLoadError handler. |
| Precon stale data | LOW | Bump cache version, force re-fetch. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Dexie migration data loss | SCHEMA (precedes GAME) | Vitest integration test against v5 fixtures |
| 2. Supabase RLS misconfiguration | AUTH | Cross-user data isolation CI test |
| 3. First sync wipes data | SYNC | Manual QA + reconciliation modal exists |
| 4. Sync ping-pong | SYNC | Idle-tab network silence test |
| 5. Last-write-wins clock skew | SYNC | Two-tab clock-skew test |
| 6. Partial deck update | SYNC | Network-fail mid-batch test, deck stays consistent |
| 7. Queue survives account switch | SYNC | Multi-account flush test |
| 8. Auth state race | AUTH | Slow-network reload, no anonymous flash |
| 9. Stuck queue forever | SYNC | Permanent-error dead-letter test |
| 10. Magic link router collision | AUTH | E2E magic link test |
| 11. Web-vitals slows boot | PERF | A/B instrumented vs. baseline |
| 12. Game timer drift | GAME | Background-tab elapsed time test |
| 13. Scryfall rate limit on precon | COLLECT (precon) / SPOILER | Network panel: zero 429s on bulk import |
| 14. LHS pop-out z-index/focus | COLLECT / POLISH | Axe-core + Tab-only navigation test |
| 15. Lazy chunks break after deploy | PERF | Cross-deploy navigation test with reload prompt |
| 16. Stale precon data | COLLECT (precon) | Cache invalidates on `released_at` change |

## Sources

- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH
- [Securing Supabase: Preventing Data Leaks From Misconfigured RLS](https://earezki.com/ai-news/2026-04-07-supabase-rls-the-hidden-danger-and-how-to-find-it-before-hackers-do/) — HIGH (2026 post-mortem)
- [Supabase RLS Guide: Policies That Actually Work](https://designrevision.com/blog/supabase-row-level-security) — HIGH
- [How Missing Row Level Security in Supabase Can Expose User Data](https://medium.com/@Gakusen/how-missing-row-level-security-in-supabase-can-expose-user-data-599dcab749f3) — HIGH (2026 incident reporting)
- [Fixing RLS Misconfigurations in Supabase: Common Pitfalls](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/) — HIGH
- [Dexie Cloud Best Practices](https://dexie.org/cloud/docs/best-practices) — HIGH
- [Dexie issue #742: Deleting tables in same run as migration breaks upgrade](https://github.com/dexie/Dexie.js/issues/742) — HIGH
- [Dexie issue #698: Data refreshing on version upgrade](https://github.com/dexie/Dexie.js/issues/698) — HIGH
- [Dexie issue #1599: Version downgrade rollback](https://github.com/dexie/Dexie.js/issues/1599) — HIGH
- [Dexie discussion #2214: Skip upgrade and clear tables for old versions](https://github.com/dexie/Dexie.js/discussions/2214) — HIGH
- [RxDB Downsides of Local-First / Offline-First](https://rxdb.info/downsides-of-offline-first.html) — HIGH (sync conflict patterns)
- [RxDB Supabase Replication Plugin docs](https://rxdb.info/replication-supabase.html) — HIGH (canonical sync algorithm description)
- [Heavy throttling of chained JS timers in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) — HIGH
- [Why do browsers throttle JavaScript timers? (Nolan Lawson)](https://nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers/) — HIGH
- [W3C hr-time issue #65: performance.now() in background tabs](https://github.com/w3c/hr-time/issues/65) — HIGH
- [Bugzilla 652472: Higher setTimeout/setInterval clamping in inactive tabs](https://bugzilla.mozilla.org/show_bug.cgi?id=652472) — HIGH
- v1.0 PITFALLS.md (sibling file) — Foundation pitfalls retained from prior research
- v1.0 RETROSPECTIVE.md — Lessons from existing app: EDHREC CORS, traceability drift, post-plan bugfix patterns

---

*Pitfalls research for: v1.1 Second Sunrise — adding auth + cloud sync + schema migration + perf + UX uplift to existing local-first MTG app*
*Researched: 2026-04-14*
