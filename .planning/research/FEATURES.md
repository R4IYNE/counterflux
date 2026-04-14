# Feature Research — Counterflux v1.1 "Second Sunrise"

**Domain:** MTG Collection / Deckbuilding / Game Tracking — incremental features on shipped v1.0
**Researched:** 2026-04-14
**Confidence:** MEDIUM-HIGH (Scryfall + Lifetap + Lotus + Archidekt verified directly; some Moxfield UX inferred from feedback forum)
**Competitors examined:** Moxfield, Archidekt, Deckbox, ManaBox, Scryfall, MythicSpoiler, MagicSpoiler, Untapped.gg, Lifetap, Lotus, Moxtopper, Lifelinker

> **Scope reminder:** This document covers only the v1.1 new-feature surface area: Supabase auth, cloud sync, precon quick-add, set-icon printing picker, LHS pop-out add panel, visual spoiler overhaul, first-player picker + turn indicator + per-turn laps, and notification bell wire-up. v1.0 features are already validated and live in the previous FEATURES.md (preserved in `.planning/milestones/` after this milestone closes).

---

## 1. Auth + Cloud Sync (Supabase)

### How competitors handle account vs no-account

| Tool | No-account flow | Account flow | Sign-out behaviour |
|------|-----------------|--------------|--------------------|
| **Moxfield** | None — account required to save anything; can browse public decks anonymously | Cloud-only. Decks accessible from any device once signed in. No local-first layer. | Sign-out clears session; data lives only on server |
| **Archidekt** | Browse + view only; cannot persist | Cloud-only collections/decks; cross-device by design | Same as Moxfield |
| **Deckbox** | Browse-only | Cloud-only | Same |
| **ManaBox** | Local-only by default; "ManaBox Cloud" tier for cross-device sync (paid) | Opt-in cloud, local stays primary | Signing out preserves local data |
| **Counterflux v1.0** | Full app works locally with no account | N/A (v1.0 has no auth) | N/A |

**Pattern collectors expect:** ManaBox is the closest analogue — local-first with **opt-in** cloud sync. Moxfield/Archidekt users tolerate cloud-only because that's all they've known, but the Counterflux promise of "works offline, no account required" is a v1.0 differentiator we **must not break**. Auth must be additive, not gating.

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| Email magic-link auth | Industry standard for friction-free signup; matches passwordless trend (Notion, Vercel, Substack) | LOW | New: Supabase auth client; needs profile store extension |
| Google OAuth | Required for ~60-70% of users who default to "Sign in with Google" | LOW | New; standard Supabase provider |
| Persistent session across page reloads | Users must not re-auth daily | LOW | Supabase JS client handles by default via localStorage |
| Sign-out without data loss | Users panic when signing out wipes local IndexedDB | LOW-MED | Must explicitly preserve Dexie tables on sign-out; only clear `session` not `db` |
| Auth-state-aware UI | Sidebar profile widget shows email/name when signed in, "Sign in" CTA when not | LOW | Already-built profile store can subscribe to Supabase `onAuthStateChange` |
| Sync indicator in UI (idle/syncing/error) | Users need to know if their changes are safe; opaque sync = anxiety | MEDIUM | Wire into existing notification system + sidebar status dot |
| Conflict resolution (last-write-wins by default) | Multi-device editing without LWW = lost edits = trust collapse | MEDIUM | Per Supabase ecosystem, LWW is sufficient for ~95% of single-user multi-device apps (RxDB pattern) |
| Offline write queue | Edits made offline must replay on reconnect; existing local-first promise demands this | MEDIUM-HIGH | Outbound queue in IndexedDB; flush on reconnect |
| Sync errors surface to user | Silent sync failures are the #1 trust-killer in cloud apps | LOW | Notification bell wire-up handles this |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Pre-auth local data → migrate-to-cloud-on-signup prompt | Existing v1.0 users with rich local data shouldn't lose it on first sign-in | MEDIUM (one-shot upload of local Dexie state) |
| "Working offline" badge in topbar when network drops | Reinforces the local-first promise; converts an error into a feature | LOW |
| Per-table sync timestamps in settings | Power users want "collection synced 2m ago, decks 14s ago" — debug confidence | LOW |
| Sync pause/resume toggle | Debug aid; rarely used but eliminates support tickets | LOW |
| Account-linked Mila personalisation | Carries Mila greeting/name across devices | LOW |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Better alternative |
|--------------|---------------|-----------------|--------------------|
| Real-time collaborative editing (CRDTs, multi-user) | "Sync should be instant!" | CRDTs (Yjs, Automerge) add 50-200KB and a steep mental model; v1.1 has no shared-edit use case (single user, multi-device) | LWW + sync-status indicator |
| Forced account creation on first run | Easier infra ("everyone has a userId") | Destroys the v1.0 "no friction" promise; alienates existing users | Optional sign-in; local userId for unauthenticated users |
| Three-way merge UI for conflicts | "Show me the diff!" | 99.9% of conflicts are user-with-themselves on two devices; surfacing this is noise | Silent LWW with timestamp; offer "view sync log" for the rare case |
| Email/password auth alongside magic-link | "Some users hate magic links" | Doubles the auth surface area for marginal gain; password reset flow is its own subsystem | Magic-link only; OAuth for users who want a single click |
| Social/sharing features riding on auth | "While we have accounts, let's add deck likes!" | Out of scope; expands surface area; v1.1 sync is the goal | Defer to v1.2+ |
| Account deletion with data export | Compliance theatre that nobody uses | GDPR-required eventually but not for v1.1; bake in once user base grows | Add in v1.2 with formal data-portability story |

---

## 2. Precon Browser + Quick-Add (Treasure Cruise)

### How competitors handle precons

| Tool | Precon flow |
|------|-------------|
| **Archidekt** | Has a dedicated "Commander Precons" search namespace (`Archidekt_Precons` user). Workflow: Deck menu → Commander precons → pick precon → "Add to collection" button **directly from the precon decklist** (no need to clone deck). Also supports "Clone Deck" via Extras menu if user wants to brew on top. |
| **Moxfield** | Public precon decks exist; user must clone, then "Add all to collection" (multi-step). Active feature requests for one-click add. |
| **ManaBox** | Set browser shows precon products; can bulk-add by selecting all cards in product. |
| **Scryfall** | Lists precon products under set browser; no "add to collection" since Scryfall is data-only. |

**Source insight (Archidekt forum, Larcondos request):** Users want the **decklist viewable first**, then a one-click "add all to my collection". Selective add (cherry-pick from precon) is requested but lower-priority than view-then-add.

### Scryfall data shape

Scryfall `set_type` field distinguishes product types. Relevant precon types:
- `commander` — Commander precons (Commander 2017, Commander Masters, set-tied Commander decks)
- `duel_deck` — Older Duel Decks
- `starter` — Starter/welcome decks
- `premium_deck` — Premium Deck Series
- `planechase` — Planechase products (mostly schemes; secondary)
- `archenemy` — Archenemy products

**Counterflux scope:** v1.1 should target `set_type=commander` first (highest-traffic, ~50+ products since 2011), with infrastructure that easily extends to other precon types in v1.2.

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| Browse list of precon products with set name + release date | Users need to find recent precons easily | LOW | Existing Scryfall bulk-data cache + Dexie has set list; filter by `set_type='commander'` |
| View full decklist of a precon **before** committing | Users want to see what they're adding | LOW | Existing card-grid component reused; `q=set:cmm` style query against cached cards |
| One-click "Add all to collection" with confirmation toast | Matches Archidekt's primary UX; the dominant ask in user feedback | LOW-MED | Bulk insert into Dexie collection table; reuse existing add-card service; respect inventory categories (default to "Owned") |
| Set icon visible in browser list | MTG users navigate by set icon, not text — strong domain convention | LOW | mana-font + keyrune already handle set icons |
| Card count + face value summary | "150 cards, ~£42" — collectors are price-conscious | LOW | Sum from cached prices |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Show "X of Y already owned" before adding | Avoids accidentally double-counting precons; signals collection intelligence | LOW (collection lookup already exists) |
| Selective add (checkbox per card) | Collector who only wants 3 reprints from a precon | MEDIUM (UI complexity, quantity selector per card) |
| Inventory category prompt on add (Owned / Trade / Sealed) | Sealed precons are a real category | LOW |
| "Add as sealed precon" — single line item that expands to full list later | Reflects how some collectors track sealed product separately | MEDIUM (data model change; defer if scope tight) |
| Group precon products by year / set release | Faster scanning | LOW |
| Search/filter within precon list (commander name, colours) | "Show me all Atraxa precons" | LOW-MED |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Auto-import every newly-released precon to user's collection | "Saves me a click!" | Unwanted writes; users buy ≠ users own everything | Notification-bell alert "New Commander precon released" with link to view |
| Track precon-deck-as-deck (auto-create deck per precon added) | "I want the deck too!" | Conflates collection (do I own it?) with deck (am I playing it?); pollutes deck list | Add an "Import as deck" secondary button; opt-in |
| Pricing arbitrage / EV calculator | "Is this precon worth opening?" | Out of v1.1 scope (Preordain territory); rabbit hole | Defer; basic total face-value is enough |
| Selective add as default flow | "Power users want control" | 90% of users want all-or-nothing; defaulting to per-card selection adds 50+ clicks | Default = add-all; selective is a secondary toggle |

---

## 3. Set-Icon Printing Picker (Add to Collection)

### How competitors handle printing selection

| Tool | UX |
|------|-----|
| **Scryfall** | "Show all prints" link below set info; lists every printing as separate cards in a grid with set icon, set name, collector number, prices, foil/non-foil. |
| **Moxfield** | Card detail → "Versions" dropdown listing all printings with set name + price. Heavy feature requests for "Update to oldest / cheapest / preferred printing" bulk operations. |
| **Deckbox** | Set + collector_number selectors as cascading dropdowns. |
| **ManaBox** | Tap set icon + collector number → opens picker showing every printing as a card image with set icon overlay; can "lock" a specific set in scanner mode. |
| **Archidekt** | Versions tab on card detail; click to swap printing on the deck/collection entry. |

### What signals "currently selected" (from observed patterns)

1. **Set icon prominent** (the visual anchor MTG users navigate by)
2. **Set name + 3-letter code** (e.g. "Commander Masters · CMM")
3. **Collector number** (`#0042`)
4. **Foil/non-foil treatment indicator** (foil sparkle, etched, halo, borderless, showcase, retro frame)
5. **Price** in user's currency (£ for Counterflux)
6. **Visual highlight on the currently-selected variant** (border, glow, "selected" badge)
7. **Card image preview** for the variant (because alt-art is a major reason users care)

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| Show all paper printings of a card on add-to-collection | Collectors care which printing they own; standard UX everywhere | LOW-MED | Scryfall card object includes `prints_search_uri`; bulk data has `set`, `collector_number` per printing. Filter `games:paper` (matches scope decision) |
| Set icon + set name + collector number per option | Standard MTG visual language | LOW | mana-font/keyrune for icons |
| Default selection = most recent paper printing | Sensible default; matches "Update to newest" in Moxfield | LOW | Sort by `released_at` desc |
| Per-printing price in user currency (£) | Required for collection valuation | LOW | EUR→GBP conversion already exists |
| Foil/non-foil toggle per printing | Two prices per printing; collectors track foils separately | LOW | `prices.eur_foil` exists |
| Currently-selected variant clearly highlighted | Visual feedback for active choice | LOW | CSS state |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Card image thumbnail per printing (showcase art, borderless, retro) | Critical for alt-art collectors; ManaBox does this and it's beloved | MEDIUM (image-heavy panel) |
| Filter pills: "First printing only" / "Cheapest" / "Newest" / "Most expensive" | Power-user shortcuts; matches Moxfield feature requests | LOW-MED |
| Frame-style badge (borderless, showcase, retro, etched) | Surfaces collector-relevant variants without forcing user to recognise art | LOW |
| Reserved-list badge | Reserved-list cards are price-relevant; collectors care | LOW |
| Quantity input per variant in picker | "I own 2 borderless + 1 retro" without re-opening picker | MEDIUM |
| Inline search to filter printings (e.g. "secret lair") | Cards like Sol Ring have 80+ printings; search is essential at the upper end | LOW |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Show MTGO/Arena-only printings | "Completionist!" | Out of v1.1 scope per `games:paper` decision; clutters picker with non-paper SKUs | Filter `games:paper` strictly |
| Crop artist credit from image thumbnails to fit more on screen | "Tighter UI" | **Scryfall TOS violation**; bans the app | Use `art_crop` URI which preserves credit, or `small` images |
| Auto-pick cheapest printing on add | "Saves a click" | Surprises users who assumed newest; new collectors don't know this is happening | Optional toggle in settings; default = newest |
| Hide non-foil if foil printing exists | "Save space" | Non-foil is the default print run for most cards; foil-only is the exception | Show both, foil-toggle is per-printing |
| Open picker as a separate page/route | "Cleaner architecture" | Breaks flow — user is mid-add; round-trip kills momentum | Modal or inline expansion within the LHS pop-out add panel |

---

## 4. LHS Permanent Pop-Out Add-to-Collection Panel

### Pattern analysis

This is more of a **layout pattern** than a competitor-mappable feature. Closest analogues:

- **ManaBox scanner mode** — persistent bottom sheet that stays open while user keeps scanning; current scan target stays in view
- **Moxfield deck builder LHS search panel** — persistent, can collapse, search results stay visible while editing on the right
- **VS Code Explorer panel** — toggleable, persistent, has its own state independent of main editor

### Table Stakes (MUST have)

| Feature | Why expected | Complexity |
|---------|--------------|------------|
| Panel persists across navigation within Treasure Cruise | Current modal-based add forces context loss between adds | LOW (Alpine component lifecycle) |
| Last-added card stays visible with edit affordances | Lets user fix mistakes immediately (wrong printing, wrong qty) | LOW |
| Keyboard-first input flow (search → enter → printing → enter → qty → enter) | Mass-entry is a power-user workflow; v1.0 mass-entry terminal proves users want this | LOW-MED (already proven pattern in mass-entry terminal) |
| Collapsible to icon strip | Desktop-first but reclaim space when not adding | LOW |
| Pop-out width adjustable / sane default (~360-420px) | Must not crowd the main grid | LOW |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Recently-added stack (last 5-10 cards) inside the panel | Visual confidence + quick undo | LOW |
| Inline printing picker (instead of opening separate modal) | Fewer modals = better flow | MEDIUM (depends on printing-picker design) |
| Panel state remembered across sessions (open/collapsed, width) | Respects user preference | LOW (localStorage / Alpine persist) |
| Drag-to-resize panel divider | Power-user customization | MEDIUM |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Make panel behaviour app-wide (every screen has it) | "Consistency!" | Treasure Cruise is the only screen where rapid add is a workflow; other screens have their own LHS needs | Scope panel to Treasure Cruise only |
| Modal overlay instead of pinned panel | "Modals are simpler" | Defeats the entire point — modals force context loss between adds | Pinned panel; that's the whole feature |
| Auto-close panel after each add | "Less clutter" | Same anti-pattern; mass-entry users will rage-quit | Always-open until user explicitly collapses |

---

## 5. Visual Spoiler Browser Overhaul (Preordain)

### How competitors do it

| Tool | Layout | NEW indication | Hover behaviour | Refresh cadence |
|------|--------|----------------|-----------------|-----------------|
| **MythicSpoiler** | 4-column grid desktop, large 255px tiles, organised by reveal date (reverse chrono), section headers per day | Section header per day (implicit "newest section = newest cards"); no per-card NEW badge | Click to card detail page (no in-page hover preview) | Manually curated; reveal-day grouping |
| **Scryfall preview pages** | `?order=spoiled` flag sorts by reveal time; standard search grid | None explicit; relies on sort order | Hover shows full card image preview (Scryfall's universal pattern) | Auto-updated as Scryfall ingests previews |
| **MagicSpoiler** | Grid + list views; each card has reveal date | NEW badge on cards revealed in past 24-48h | Modest hover effect | Pulls from various sources |
| **MTG Arena Zone Visual Spoiler** | Set-card grid with filters | Per-set "newest first" sort | Hover scales tile slightly | Per-set page |
| **Untapped.gg spoilers** | Tile grid with rarity-coloured borders | NEW badge on recent | Hover scales | Real-time |
| **Counterflux v1.0 (current)** | Smaller tiles; functional but lacks "content-rich" feel | None | Click only | Bulk data daily |

### What makes a spoiler browser feel "content-rich"

Synthesised from MythicSpoiler + MagicSpoiler + Untapped.gg patterns:

1. **Large card tiles** (~250-300px wide, near-readable card text without clicking)
2. **Reverse-chronological reveal grouping** (newest at top is the entire emotional core of spoiler season)
3. **NEW badges on recently-revealed cards** (24-48h window)
4. **Hover preview** showing larger/full card and meta (set, rarity, mana cost, type line)
5. **Quick-action button on hover** (add to watchlist, view price, copy name)
6. **Set icon prominent** on each tile (multi-set spoiler season, e.g. set + Commander companion product)
7. **Rarity colour signal** (gold border for mythic, etc.) — collectors scan for mythics first
8. **Day-section headers** with reveal date and card count ("April 14 — 12 new cards")

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| Larger card tiles (250-300px wide) | The dominant pattern; small tiles feel like "search results", large tiles feel like "preview spoilers" | LOW | CSS-only change to existing card-grid component |
| Reverse-chronological by reveal date | The single biggest UX win during spoiler season | LOW | `released_at` + `preview.previewed_at` from Scryfall card object; Scryfall's `order=spoiled` semantic |
| NEW badge on cards revealed in past 48h | Visual cue for "what's new since I last looked" | LOW | Compute from `preview.previewed_at` against current time |
| Hover preview with larger card image + key meta | Industry standard; users expect this | LOW-MED | Existing card-detail component can be repurposed for hover state |
| Quick add-to-watchlist on hover (no full modal) | Reduces friction during spoiler binge | LOW | Existing watchlist add already exists; expose via hover button |
| Set icons in the set/dropdown filter | Multi-product spoiler seasons (set + Commander decks) — users navigate by icon | LOW | mana-font + keyrune |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Day-section headers with reveal date + card count | MythicSpoiler signature; gives spoiler season a "newspaper" feel | LOW |
| Filter pills: rarity, colour, type, "in watchlist" | Power-user nav during heavy reveal days | LOW-MED |
| "Mark all viewed" button to clear NEW badges | Clean slate for next visit | LOW (timestamp in user prefs) |
| Mythic-only filter toggle | Collectors/speculators scan for mythics first; one-click filter is high-value | LOW |
| Per-card price-since-reveal sparkline | Speculator-friendly; differentiates from MythicSpoiler | MEDIUM (price history collection needed) |
| "Spoiler season mode" hero banner | Sets context: "Blah Set is in preview, X cards revealed, Y days to release" | LOW |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Real-time push notifications on every spoiler | "Don't miss a card!" | Notification fatigue; users will mute the app | Daily digest via notification bell; opt-in alerts only on watchlisted commanders/themes |
| Comment threads / community reactions per card | "Engagement!" | Out of scope; massive moderation surface; scope creep | Leave to Reddit/Discord |
| Auto-add new mythics to watchlist | "Helpful default" | User loses control; watchlist becomes noise | One-click add on hover (table-stakes) |
| "Predict the price" gamification | "Fun!" | Distracts from the tool's purpose; data quality risk | Defer to a separate Speculator screen if ever needed |
| News feed integration (set lore, articles, podcasts) | "Make Preordain a hub!" | **Explicitly out of scope per PROJECT.md** ("spoiler-focused only, no news feeds") | Stay disciplined |

---

## 6. Game Tracker Polish (Vandalblast — first player, turn indicator, per-turn laps)

### How competitors do it

| Tool | First-player picker | Turn indicator | Per-turn timing |
|------|---------------------|----------------|-----------------|
| **Lifetap** | Coin flip + dice (D4-D20) + "randomly choose a player" button | Implicit turn tracking; emphasises chess clock | Stopwatch / countdown / chess-clock modes; turn time alerts |
| **Lotus** | "High Roll" — d20 with the winning roll auto-highlighted | Turn count + per-player thinking time | Stopwatch only (per docs); pauses/resumes |
| **Lifelinker (Command Zone)** | Visual spinner in centre | Less detailed | Less detailed |
| **Moxtopper** | Basic dice/coin | Basic | Minimal |
| **Counterflux v1.0** | None — assumed by user | Turn count exists but no visual "whose turn is it" highlight | Total game time; no per-turn laps |

### Pattern observed

Competitors mostly default to **dice + coin** for first-player. Spinner is rarer but loved (Lifelinker). The most-praised feature across reviews is **automatic winner highlight** so the table doesn't have to remember who got the highest roll.

For turn indication, the table-stakes pattern is a **highlight ring + glow** around the active player's section, not a separate indicator widget.

For per-turn laps, **stopwatch + lap recording** is standard in chess-clock contexts. Lifetap's chess-clock mode is the closest analogue. Lotus tracks "thinking time per player" but not granular per-turn.

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| First-player picker (coin flip OR dice OR random pick) | Universal feature in every life counter | LOW-MED | New component; reuse existing dice utility |
| Auto-highlight winner with celebration | "Rolling and forgetting" is the bug being fixed | LOW | CSS animation + Mila quip |
| Visual turn indicator (active player ring/glow) | Pod players forget whose turn it is mid-conversation | LOW | CSS state on existing player segments |
| Turn advances with explicit user action | No timer-based auto-advance — table sets the pace | LOW | Existing turn-tracking patterns |
| Per-turn lap timing (start/end of each turn) | Foundation for the "post-game stats per turn" feature | MEDIUM | Schema migration for game history (mentioned in PROJECT.md scope) |
| Per-turn laps surface in post-game stats | Why else collect them? | LOW (chart) | Chart.js already used; new chart on game summary |
| Per-turn laps persist to game history | Required for stats over multiple games | MEDIUM | Dexie schema bump (already planned per PROJECT.md) |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Spinner-style first-player picker (in addition to coin/dice) | Pod-table favourite; visual delight | LOW-MED (CSS rotate animation) |
| Mila narrates the first-player pick | Brand voice opportunity | LOW (witty quips per outcome) |
| Average turn duration across player's history | "Are you the slow player in your pod?" — playful self-awareness | LOW (aggregation over game history) |
| Per-turn life-change overlay on lap chart | "You took 14 damage on turn 6" — adds story to post-game | MEDIUM (combines turn laps with existing life-change log) |
| Configurable first-player rule (high roll, low roll, last winner picks, etc.) | Pod variants exist | LOW |
| Turn-time alert (Lifetap-style "you've been thinking for 4 minutes") | Slow-play awareness | LOW (in-game; opt-in to avoid annoyance) |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Forced chess-clock mode | "Speed up the game!" | Counterflux v1.0 explicitly avoids this; pod-friendly UX matters more than competitive timing | Optional turn-time alert only |
| Penalty/timeout enforcement | "Slow players need consequences" | App becomes adversarial; pods are friend groups | Surface stats; let table self-regulate |
| Auto-skip turn after timeout | "Tournament mode" | Out of scope; Vandalblast is for casual EDH pods | Defer indefinitely |
| Real-time multi-device pod sync (every player on their own phone) | "Each player tracks themselves" | Massive scope; v1.1 sync is single-user multi-device, not multi-user single-game | Defer to v2+; one-device-per-pod stays the model |
| First-player picker UI with 4+ steps (config → animate → reveal → confirm) | "Make it feel important" | Adds friction to a 3-second action | Single screen; one tap; auto-highlight; done |

---

## 7. Notification Bell Wire-Up

### Pattern (universal across web apps)

Bell icon in topbar → unread badge with count → click opens dropdown panel → grouped list of notifications with timestamps → tabs for All / Unread / Settings.

This is **already-rendered UI** in v1.0 (per "wire-up" framing). The work is **content + behaviour**, not chrome.

### Table Stakes (MUST have)

| Feature | Why expected | Complexity | Counterflux dependency |
|---------|--------------|------------|------------------------|
| Sync errors surface as notifications | Silent sync failure = #1 trust killer (see Auth section) | LOW | Subscribe to sync queue error events |
| Watchlist alerts surface as notifications | Existing watchlist alerts have nowhere to live in v1.0 | LOW | Existing watchlist alert generation; route into bell instead of toast-only |
| Unread badge on bell icon | Universal pattern; users glance at bell to know if anything happened | LOW | CSS counter |
| Click bell → dropdown panel (not modal) | Dropdown is the universal pattern; modals feel heavy | LOW | Existing dropdown components |
| "Mark all as read" action | Standard escape hatch | LOW | One-shot store update |
| Persistent across sessions (notifications stored, not just in-memory) | Users who closed the tab last night expect to see overnight alerts | LOW | New Dexie table for notifications |

### Differentiators (NICE)

| Feature | Value | Complexity |
|---------|-------|------------|
| Notification categories with filters (sync / watchlist / system) | Power-user filtering | LOW |
| Per-notification action button (e.g. "View card" jumps to Preordain) | Notifications become navigation, not just announcements | LOW-MED |
| Mila narrates important notifications | Brand voice extension | LOW |
| Notification preferences in settings (mute categories, quiet hours) | Respects user attention | LOW-MED |
| Snooze individual notification | Nice escape hatch for "I'll deal with this later" | LOW |

### Anti-Features (DON'T)

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Browser push notifications | "Engagement!" | Permissions friction; users hate web push; outside the desktop-first promise | In-app only |
| Email digest of notifications | "What if I'm not in the app?" | Operational complexity (Supabase functions, email infra); v1.1 isn't there yet | Defer to v1.2+ if demand emerges |
| Marketing/announcement notifications from Counterflux team | "Tell users about new features!" | Trust collapses fast; nobody wants a tool that pushes its own marketing | Use the existing Mila tip system or release notes screen |
| Real-time websocket notification stream | "Modern!" | Polling on app open + push-on-action covers v1.1 needs at a fraction of the complexity | Compute on-mount + push on local sync events |

---

## Feature Dependencies

```
[Supabase Auth]
    └──enables──> [Cloud Sync]
                       └──requires──> [Conflict Resolution (LWW)]
                       └──requires──> [Offline Write Queue]
                       └──surfaces-via──> [Notification Bell — sync errors]

[Watchlist Alerts (v1.0 exists)] ──surfaces-via──> [Notification Bell]

[Scryfall Bulk Data Cache (v1.0)] ──enables──> [Precon Browser]
[Scryfall Bulk Data Cache (v1.0)] ──enables──> [Set-Icon Printing Picker]
[Scryfall Bulk Data Cache (v1.0)] ──enables──> [Visual Spoiler Browser]

[Set-Icon Printing Picker] ──integrates-into──> [LHS Pop-Out Add Panel]
[LHS Pop-Out Add Panel] ──refactors──> [Treasure Cruise layout]

[Per-Turn Lap Timing] ──requires──> [Game History Schema Migration]
[First-Player Picker] ──independent──> [Visual Turn Indicator]
[Visual Turn Indicator] ──independent──> [Per-Turn Lap Timing]
   (all three ship together as Vandalblast pod-experience bundle)

[Notification Bell Wire-Up] ──depends──> [Cloud Sync] (for sync-error surfacing)
[Notification Bell Wire-Up] ──soft-depends──> [Watchlist exists] (already does)
```

### Dependency Notes

- **Cloud sync depends on auth being live first** — auth must ship before sync work begins. They are tightly coupled but auth is gate-zero.
- **Notification bell wire-up should ship after sync** so it has the most-important content (sync errors) on day one. Wiring it up first with only watchlist content would waste the round-trip into the bell.
- **Set-icon printing picker is a sub-feature of the LHS pop-out panel**, not a standalone screen. Don't ship the picker as a modal first and refactor it into the panel later — design them together.
- **Per-turn laps require schema migration** — the game history Dexie table needs a new field. This is the only schema migration in v1.1; sequence Vandalblast work to land before sync work to avoid migrating in the middle of a sync rollout.
- **Precon browser is fully independent** of all other v1.1 work; can ship at any time once Scryfall bulk data filtering is exposed.
- **Visual spoiler overhaul is fully independent**; CSS-heavy + small data layer additions (NEW badge timestamp).

---

## MVP Definition (within the v1.1 milestone)

### Must-ship for v1.1 (table stakes only)

- [ ] Email magic-link auth
- [ ] Google OAuth
- [ ] Persistent session
- [ ] Sign-out preserves local data
- [ ] Sync indicator in UI
- [ ] LWW conflict resolution
- [ ] Offline write queue
- [ ] Sync errors → notification bell
- [ ] Browse Commander precon products + view decklist + one-click add-all
- [ ] Set + collector_number + price + foil/non-foil printing picker
- [ ] LHS pop-out add panel persistent across Treasure Cruise navigation
- [ ] Larger spoiler tiles + reverse-chrono + NEW badge + hover preview + quick add-to-watchlist
- [ ] First-player picker (coin or dice) + auto-highlight winner
- [ ] Visual active-turn indicator
- [ ] Per-turn lap timing + persisted to game history + post-game lap chart
- [ ] Notification bell shows sync errors + watchlist alerts + unread badge

### Add after validation (v1.2)

- [ ] Pre-auth local data → migrate-on-first-signup prompt (defer until we have telemetry on how often this happens)
- [ ] Selective add (per-card checkbox) in precon browser
- [ ] Card image thumbnails per printing in picker (image-heavy; ship after baseline picker is loved)
- [ ] Spinner-style first-player picker (after coin/dice prove themselves)
- [ ] Mila narration on first-player pick + notifications (after baseline content lives)
- [ ] Per-card price sparkline in spoiler tiles (needs price-history collection first)

### Future consideration (v2+)

- [ ] Multi-user real-time pod sync (every player on own phone)
- [ ] Browser push notifications
- [ ] CRDT-based collaborative editing
- [ ] Account deletion + data export (GDPR formality once user base grows)
- [ ] Email digests for notifications

---

## Feature Prioritisation Matrix

| Feature | User value | Implementation cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Email magic-link + Google OAuth | HIGH | LOW | P1 | Gate-zero for sync |
| Sign-out preserves local data | HIGH | LOW | P1 | Trust-defining moment |
| Cloud sync (LWW + offline queue) | HIGH | MEDIUM-HIGH | P1 | The headline v1.1 feature |
| Sync indicator + sync-error notifications | HIGH | MEDIUM | P1 | Sync without indicator = anxiety |
| Precon browser + one-click add-all | HIGH | LOW-MED | P1 | Big collector quality-of-life win |
| Set-icon printing picker (basic) | HIGH | LOW-MED | P1 | Long-standing UX gap |
| Card image thumbnails per printing | MEDIUM | MEDIUM | P2 | Loved but ship baseline first |
| LHS pop-out add panel | HIGH | MEDIUM | P1 | Required for Treasure Cruise rapid entry |
| Visual spoiler overhaul (tiles + NEW + hover) | HIGH | LOW-MED | P1 | Direct user request from v1.0 polish |
| First-player picker (coin + dice) | MEDIUM | LOW | P1 | Universal life-counter feature |
| Visual turn indicator | HIGH | LOW | P1 | Pod players forget; cheap to add |
| Per-turn lap timing + post-game chart | MEDIUM | MEDIUM | P1 | Persisted to history per PROJECT.md scope |
| Spinner-style first-player picker | LOW-MED | LOW-MED | P2 | Delight feature; adds after baseline |
| Notification bell wire-up | HIGH | LOW-MED | P1 | Final polish; depends on sync |
| Mila narration on notifications | LOW | LOW | P3 | Brand voice; not blocking |
| Per-card spoiler price sparkline | MEDIUM | MEDIUM-HIGH | P3 | Needs price-history infra |

---

## Competitor Feature Snapshot

| Feature | Moxfield | Archidekt | Lifetap / Lotus | ManaBox | Counterflux v1.1 plan |
|---------|----------|-----------|-----------------|---------|------------------------|
| Local-first / offline | ✗ Cloud-only | ✗ Cloud-only | N/A | ✓ Local-first | ✓ Preserved + cloud sync added |
| Magic-link auth | ✓ | ✓ | N/A | ✓ | ✓ |
| Google OAuth | ✓ | ✓ | N/A | ✓ | ✓ |
| Sync indicator | Implicit | Implicit | N/A | ✓ | ✓ |
| Conflict resolution | Server-only (no offline) | Server-only | N/A | ✓ LWW | ✓ LWW |
| Precon browser | ✗ (community decks) | ✓ (Commander_Precons user) | N/A | ✓ (set browser) | ✓ Commander precons, scryfall-driven |
| One-click precon add | ✗ | ✓ | N/A | ✓ | ✓ |
| Set-icon printing picker | ✓ (text-heavy) | ✓ | N/A | ✓ (image-rich) | ✓ Image-rich + filter pills |
| Visual spoiler browser | Basic | Basic | N/A | ✗ | ✓ Larger tiles + hover + quick-watchlist |
| First-player picker | N/A | N/A | ✓ | N/A | ✓ |
| Visual turn indicator | N/A | N/A | Partial | N/A | ✓ |
| Per-turn lap recording | N/A | N/A | Partial (Lifetap chess clock) | N/A | ✓ Persisted to game history |
| Notification bell with watchlist + sync alerts | ✓ | ✓ | N/A | ✓ | ✓ |

---

## Counterflux Subsystem Dependencies (existing v1.0 systems impacted)

| New feature | Existing subsystem touched | Nature of touch |
|-------------|----------------------------|-----------------|
| Auth | profile store, sidebar profile widget, settings modal | Extend with Supabase session; auth-state listener |
| Cloud sync | All Dexie tables (collection, decks, games, watchlist) | Outbound queue + replication layer; no schema changes |
| Notification bell wire-up | Existing notification store, watchlist alert generator, new sync subsystem | New Dexie table for persisted notifications |
| Precon browser | Scryfall bulk-data cache, Treasure Cruise add-card service | Filter sets by `set_type=commander`; bulk insert path |
| Set-icon printing picker | Scryfall bulk-data cache, mana-font/keyrune, currency conversion (£) | Read-only against bulk cache; UI-heavy |
| LHS pop-out add panel | Treasure Cruise screen layout, mass-entry terminal patterns | Layout refactor; share keyboard-flow learnings from mass-entry |
| Visual spoiler overhaul | Preordain screen, card-grid component, watchlist add | CSS + new hover behaviour + small data additions (NEW timestamp) |
| First-player picker / turn indicator | Vandalblast screen, dice utility | New component; no schema change |
| Per-turn laps | Vandalblast screen, **game history Dexie schema** | **Schema migration** — only one in v1.1 |

---

## Persona Validation

Mapping features to the four PROJECT.md personas (Spike/Johnny Commander):

| Persona | Top v1.1 features for them |
|---------|----------------------------|
| **The Archivist** (collection-focused) | LHS pop-out add panel, set-icon printing picker, precon browser, cloud sync (multi-device collection access) |
| **The Brewer** (deckbuilding-focused) | Cloud sync (decks accessible everywhere), printing picker (deck art consistency) |
| **The Speculator** (price-tracking) | Visual spoiler overhaul, notification bell (watchlist alerts surface properly) |
| **The Pod Leader** (game-tracking) | First-player picker, visual turn indicator, per-turn laps, sync (game history across devices) |

Every persona benefits from at least 2 v1.1 features. No persona is left out. The Archivist gets the most love (which matches the v1.0 pain points around mass-add).

---

## Sources

**Direct verification (HIGH confidence):**
- [Scryfall API — Bulk Data](https://scryfall.com/docs/api/bulk-data)
- [Scryfall API — Sets / set_type](https://scryfall.com/docs/api/sets)
- [Scryfall — Commander sets browser](https://scryfall.com/sets?type=commander&order=set)
- [Lifetap official site](https://getlifetap.com/) — first-player + timer modes verified
- [Lotus / lifecounter.app](https://lifecounter.app/) — high-roll + turn tracker verified
- [MythicSpoiler — visual spoiler page](https://mythicspoiler.com/newspoilers.html) — layout verified directly
- [Archidekt forum thread — Precon to collection request](https://archidekt.com/forum/thread/13286559) — UX expectations verified
- [Archidekt Commander Precons page](https://archidekt.com/commander-precons)

**Pattern synthesis (MEDIUM confidence):**
- [ManaBox scanner FAQ](https://www.manabox.app/guides/scanner/faq/) — printing picker UX
- [ManaBox import-export guide](https://www.manabox.app/guides/decks/import-export/)
- [Moxfield Feedback — preferred printing](https://moxfield.nolt.io/911)
- [Moxfield Feedback — Update to oldest](https://moxfield.nolt.io/910)
- [Moxfield Feedback — precon to collection sync](https://moxfield.nolt.io/2263)
- [PowerSync — Offline-first apps with Supabase](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync) — LWW conflict resolution pattern
- [RxDB — Supabase replication](https://rxdb.info/replication-supabase.html) — outbound queue pattern
- [Supabase auth docs — passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase auth docs — Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)

**Pattern reference (LOW-MEDIUM confidence):**
- [PatternFly notification badge guidelines](https://www.patternfly.org/components/notification-badge/design-guidelines/)
- [Courier — Notification center guide](https://www.courier.com/blog/how-to-build-a-notification-center-for-web-and-mobile-apps)
- [Untapped.gg MTG spoilers](https://mtga.untapped.gg/codex/spoilers) — NEW badge pattern
- [MagicSpoiler](https://www.magicspoiler.com/mtg-spoilers/) — visual spoiler browser
- [Draftsim — Best MTG life counter apps](https://draftsim.com/best-mtg-life-counter-app/) — feature comparison

---

*Feature research for: Counterflux v1.1 "Second Sunrise"*
*Researched: 2026-04-14*
