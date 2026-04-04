# Counterflux: The Aetheric Archive

## Product Requirements Document v1.0

---

## 1. Product Vision

**Name:** Counterflux — The Aetheric Archive

**One-liner:** A premium, desktop-first command centre for Magic: The Gathering collectors and Commander players — fusing rigorous data analytics with a spellbook-terminal interface to track collections, optimise decks, monitor markets, and run games.

**Why it exists:** The MTG tool landscape is deeply fragmented. Players currently juggle Moxfield for deckbuilding, Deckbox for collection tracking, EDHREC for recommendations, TCGPlayer for pricing, MythicSpoiler for previews, Commander Spellbook for combos, and a separate life-tracking app at the table. Each tool is decent in isolation but none talk to each other, and none of them feel like *yours*. Counterflux consolidates all of these into a single, personalised command centre — with a distinctive visual identity that no existing tool offers.

**For whom:** Spike/Johnny Commander players and high-volume MTG collectors who care deeply about deck optimisation, portfolio value tracking, streamlined inventory management, and having all their game data in one place. Players who own 500+ cards, maintain multiple Commander decks, and play weekly.

**Differentiators:**
- All-in-one: Collection + Deckbuilding + Market Intel + Game Tracking + Spoilers in a unified interface — no tab-juggling
- Collection-aware deckbuilding: The deck builder knows what you own, what you're missing, and what it would cost to complete a brew
- Personal analytics: Win rates by deck, metagame trends in your pod, spending over time
- The aesthetic: No other MTG tool looks or feels like this. The neo-occult spellbook-terminal identity is a feature, not a skin

**Primary platform:** Desktop web app (responsive but desktop-optimised). Future consideration for a mobile companion (primarily for the Game Tracker).

---

## 2. User Personas

### The Archivist (Primary)
Owns 2,000+ cards across multiple sets. Maintains a trade binder and wishlist. Cares about portfolio value, set completion percentages, and knowing exactly what they own by set, condition, and printing. Currently splits time between Deckbox and a spreadsheet.

### The Brewer (Primary)
Maintains 5–10 Commander decks simultaneously. Obsesses over mana curves, synergy scores, and finding the perfect 99. Visits EDHREC weekly. Wants to build decks that pull from their actual collection and flag what needs buying. Currently uses Moxfield or Archidekt.

### The Speculator (Secondary)
Tracks price movements, watches for reprints, and times purchases around set releases. Wants price alerts, historical charts, and cost-basis tracking. Currently refreshes TCGPlayer and MTGGoldfish.

### The Pod Leader (Secondary)
Runs a regular playgroup. Wants to track life totals, commander damage, and game history. Wants post-game stats. Currently uses Lifetap or Moxfield plus pen and paper.

---

## 3. Data Architecture

### 3.1 Primary Data Source: Scryfall API

Scryfall is the canonical data layer for Counterflux. It provides free, comprehensive card data under the Wizards of the Coast Fan Content Policy.

**Key endpoints:**
- `/cards/search` — Full-text card search with Scryfall syntax (e.g., `c:UR t:instant cmc<=3`)
- `/cards/named` — Exact or fuzzy card name lookup
- `/cards/autocomplete` — Type-ahead suggestions for card names
- `/cards/collection` — Batch lookup by identifiers (up to 75 per request)
- `/cards/{id}` — Individual card by Scryfall ID
- `/bulk-data` — Daily bulk export of entire card database (Oracle Cards, Default Cards, All Cards, Rulings)
- `/sets` — Set metadata (codes, release dates, set types, icons)
- `/symbology` — Mana symbol definitions and parsing

**Card object fields used:**
- Identity: `id`, `oracle_id`, `name`, `set`, `collector_number`, `lang`
- Gameplay: `mana_cost`, `cmc`, `type_line`, `oracle_text`, `power`, `toughness`, `colors`, `color_identity`, `keywords`, `legalities`
- Imagery: `image_uris` (small, normal, large, art_crop, border_crop), `card_faces` for DFCs
- Pricing: `prices` (usd, usd_foil, eur, tix) — updated daily
- Metadata: `rarity`, `edhrec_rank`, `released_at`, `reprint`, `reserved`

**Caching strategy:**
- Bulk data download cached locally, refreshed daily via cron
- Individual card lookups cached for 24 hours
- Price data treated as stale after 24 hours (per Scryfall terms)
- Imagery cached aggressively (card images rarely change)

**Compliance requirements (Scryfall terms):**
- Must include `User-Agent` and `Accept` headers on all requests
- Must not paywall access to Scryfall-sourced data
- Must not crop artist credits or copyright from card images
- Must not repackage Scryfall data without adding value
- Rate limit: 50–100ms delay between requests recommended

### 3.2 Secondary Data Sources

| Source | Data | Usage |
|--------|------|-------|
| Commander Spellbook API | Combo database with card requirements, steps, and results | Combo detection in Deck Builder |
| EDHREC (scrape/reference) | Synergy/lift scores, popularity data, commander pages | Recommendation engine in Deck Builder |
| TCGPlayer / Cardmarket | Marketplace pricing, buy links | Price comparison, purchase links |
| Scryfall sets endpoint | Set release calendar, spoiler availability | Spoiler/Preordain feed |

### 3.3 User Data Model

All user data stored locally (IndexedDB) with optional Supabase sync for cross-device access.

**Collection entry:**
```
{
  scryfall_id: string,       // Links to Scryfall card data
  quantity: number,
  foil: boolean,
  condition: enum (NM, LP, MP, HP, DMG),
  location: enum (collection, trade_binder, deck:{deck_id}, lent_out),
  acquired_price: number,    // Cost basis for P&L tracking
  acquired_date: date,
  notes: string
}
```

**Deck entry:**
```
{
  id: string,
  name: string,
  commander: scryfall_id,
  partner: scryfall_id | null,
  companion: scryfall_id | null,
  format: enum (commander, oathbreaker, brawl),
  cards: [{ scryfall_id, quantity, category, is_owned }],
  categories: string[],      // User-defined: "Ramp", "Removal", "Win Con", etc.
  created: date,
  updated: date,
  game_history: game_id[],
  notes: string,
  tags: string[]
}
```

**Game entry:**
```
{
  id: string,
  date: date,
  deck_id: string,
  players: [{ name, commander, starting_life }],
  winner: string | null,
  turns: number,
  duration_ms: number,
  elimination_order: string[],
  life_history: [{ player, turn, delta, new_total }],
  commander_damage: [{ source, target, amount }],
  notes: string
}
```

---

## 4. Screens & Features

### 4.1 Epic Experiment (Dashboard)

*The home screen. A high-level command overview of everything that matters.*

**Layout:** Full-width content area with a persistent sidebar. The dashboard is a grid of modular panels.

**Panels:**

- **Portfolio Summary** — Total collection value (TCGPlayer market), change over 7/30/90 days, number of unique cards, number of total cards. Sparkline chart of portfolio value over time.

- **Quick Add** — A fast card entry input. Type a card name (autocomplete via Scryfall `/cards/autocomplete`), hit Enter to add to collection. Supports quantity prefixes (e.g., `4x Lightning Bolt`). Supports set code suffixes (e.g., `Lightning Bolt [2XM]`). Tab into condition/foil toggles before confirming.

- **Price Alerts** — Cards from your wishlist or collection that have crossed a price threshold you set. Shows card name, current price, your threshold, and a trend arrow. Clicking opens the card in Preordain.

- **Mila's Insight** — A rotating daily tip from the System Familiar. Categories: upgrade suggestion for a deck ("Your Krarkashima deck is running 3 taplands that could be replaced for under £5"), price alert ("Dockside Extortionist is down 12% this month"), or collection stat ("You're 4 cards from completing your Innistrad: Midnight Hunt set").

- **Recent Activity** — A timeline of recent actions: cards added, decks modified, games played, price alerts triggered.

- **Deck Quick-Launch** — Grid of your decks with commander art thumbnails. Click to enter the Deck Builder. A prominent "Initialize Ritual" (New Brew) button.

- **Upcoming Releases** — Next 2–3 upcoming MTG sets with release dates, linked to the Preordain spoiler view.

---

### 4.2 Thousand-Year Storm (Deck Builder)

*Full Commander deck construction environment with real-time analytics.*

**Inspired by:** Moxfield's editor (speed, keyboard-driven entry), EDHREC's recommendation engine (data-backed suggestions), Commander Spellbook's combo finder (combo detection).

**Core layout:** Three-panel design.
- **Left panel:** Card search and recommendations
- **Centre panel:** The 99 (visual grid or sortable list, user toggle)
- **Right panel:** Live analytics sidebar

**Card Search (Left Panel):**
- Scryfall-powered search with full syntax support (`c:UR t:instant cmc<=3 o:draw`)
- Type-ahead autocomplete
- Filter toggles: colour identity (locked to commander), card type, CMC range, rarity
- **"In Collection" toggle** — Filter results to only show cards you own (cross-references Collection Manager data). Cards not owned show a ghost border with estimated price
- Results display card image, name, type, mana cost, price
- Click to add to deck, right-click for details flyout

**Recommendations engine:**
- **Synergy suggestions** — On commander selection, surface top synergy cards from EDHREC data, filtered by colour identity. Show lift/synergy score alongside each recommendation
- **Category gaps** — If the deck has fewer than 10 ramp cards, 8 removal cards, or 10 card-draw sources, surface a contextual prompt: "Your deck has only 4 removal spells. Here are popular options for [Commander]."
- **Combo detection** — Cross-reference the current 99 against Commander Spellbook. Surface known combos with a "Combo detected" badge, listing the pieces and steps. Suggest "near-miss" combos where only 1 piece is missing

**The 99 (Centre Panel):**
- Toggle between **Visual Grid** (card image tiles, drag-and-drop) and **List View** (compact table with name, type, CMC, category, price, owned status)
- User-defined category sorting: Ramp, Card Draw, Removal, Creatures, Lands, Win Conditions, etc. Users can create custom categories
- Drag-and-drop between categories
- Card count tracker (persistent): `67/99 — 32 slots remaining`
- Colour indicator dots on each card
- **Owned/Missing indicator:** Green dot = owned, Red dot = not owned. Summary line: "You own 72 of 99 cards. Remaining cost: £47.30"

**Live Analytics (Right Panel):**
- **Mana Curve** — Bar chart of spells by CMC (0–7+), colour-coded by card colour. Average CMC displayed
- **Colour Pie** — Doughnut chart showing mana symbol distribution across the deck. Overlaid with land colour production to highlight mismatches
- **Type Breakdown** — Creatures / Instants / Sorceries / Enchantments / Artifacts / Planeswalkers / Lands (count and percentage)
- **Category Breakdown** — User-defined categories with card counts and a target fill indicator
- **Price Summary** — Total deck cost, cost of cards not owned, most expensive card, budget alternatives available
- **Salt Score** — Aggregate deck salt score (pulled from EDHREC salt data). A fun social gauge of how annoying your deck is

**Key flows:**

1. **Initialize Ritual (New Brew):**
   - Click "Initialize Ritual" from sidebar or dashboard
   - Enter commander name (autocomplete). System fetches card image, auto-populates colour identity, and locks search filters accordingly
   - Optionally add partner/companion
   - Deck canvas opens with commander in the command zone and 99 empty slots
   - Recommendations panel pre-populates with EDHREC top cards for that commander

2. **Import existing deck:**
   - Paste a decklist (Moxfield, Archidekt, MTGGoldfish, or plain text format)
   - System parses and resolves card names via Scryfall `/cards/collection`
   - Flags any unresolved cards for manual matching
   - Cross-references against collection for owned/missing status

3. **Export:**
   - Copy to clipboard (plain text, MTGO format, Arena format)
   - Export as CSV
   - Share as public link (if Supabase sync is enabled)

---

### 4.3 Treasure Cruise (Collection Manager)

*Exhaustive inventory tracking with terminal-style mass entry.*

**Inspired by:** Deckbox's mature collection tracking (conditions, editions, foils), Archidekt's collection-to-deck integration, EchoMTG's price-focused analytics.

**Views:**

- **Gallery View** — Card image grid with filters. Sortable by name, set, price, date added, colour
- **Table View** — Spreadsheet-style rows: Card Name, Set, Collector #, Condition, Foil, Quantity, Location, Market Price, Cost Basis, P&L. All columns sortable and filterable
- **Set Completion View** — Browse by set. Progress bars showing completion percentage (owned/total). Filter by rarity tier (Common, Uncommon, Rare, Mythic). Highlight missing cards

**Mass Entry Terminal:**
A command-line style input at the top of the screen for rapid collection entry. Supports batch syntax:

```
4x Lightning Bolt [2XM] NM
2x Counterspell [MH2] LP foil
1x Dockside Extortionist [2X2] NM @35.00
```

Format: `{qty}x {card name} [{set code}] {condition} {foil?} {@acquired_price?}`

Auto-resolves via Scryfall. Unresolved entries flagged for manual matching. Confirmation modal before committing batch.

**Inventory categories:**
- **Collection** — Cards you own and keep
- **Trade Binder** — Cards available for trade (future: trade-matching with other users)
- **Wishlist** — Cards you want. Linked to Preordain price alerts
- **Lent Out** — Cards currently with someone else. Track borrower name and date

**Analytics:**
- Total collection value (market) with historical chart
- Value breakdown by set, colour, rarity
- Top 10 most valuable cards
- Price gainers/losers over selected period
- Cost basis vs. market value (total P&L)
- Cards with no price data flagged for review

**Import/Export:**
- CSV import (Deckbox format, Moxfield format, Archidekt format, generic CSV with column mapping)
- CSV export
- Merge or replace on import (user choice)

---

### 4.4 Preordain (Market Intel & Spoilers)

*New release tracking, price intelligence, and spoiler season coverage.*

**Inspired by:** MythicSpoiler's visual spoiler browser, MTGGoldfish's price tracking, TCGPlayer's market data.

**Sub-views:**

**Spoiler Browser:**
- Upcoming and recently released sets listed chronologically
- Visual spoiler gallery: card images in a filterable grid (by colour, rarity, card type)
- New cards highlighted with a "NEW" badge during spoiler season
- Data sourced from Scryfall's sets and cards endpoints (cards appear as Scryfall indexes them)

**Price Watchlist:**
- User-curated list of cards to monitor
- Each entry shows: current price, 7/30/90-day trend, price chart sparkline, your target price
- Alert configuration: notify when price drops below threshold, rises above threshold, or changes by X%
- One-click "Add to Wishlist" (links to Collection Manager)

**Market Trends:**
- Top movers: Cards with the biggest price changes in the last 24h / 7d / 30d (sourced from Scryfall daily price data)
- Format staples tracker: Price trends for Commander staples (Sol Ring, Mana Crypt, Rhystic Study, etc.)
- Reprint tracker: Flag cards that have been announced for reprint in upcoming sets (price typically drops)

**Release Calendar:**
- Visual timeline of upcoming MTG product releases
- Set name, release date, product type (Standard set, Commander decks, Masters set, Universes Beyond, Secret Lair)
- Spoiler season start dates where known

---

### 4.5 Vandalblast (Game Tracker)

*Interactive Commander game companion for life tracking, counters, and game history.*

**Inspired by:** Lifetap's comprehensive counter tracking, Moxtopper's life-total charts, Lotus's clean UI.

**Game Setup:**
- Select your deck (from Deck Builder) or enter commander name manually
- Set starting life total (default 40 for Commander, configurable: 20, 25, 30, 40)
- Add 1–5 opponents: name, commander (optional), colour
- Randomise seating order (optional)

**In-Game Tracking:**

- **Life Totals** — Large, readable numbers per player. Tap +/- buttons to adjust. Long-press for fast adjustment (increments of 5 or 10). Life total change history visible on tap
- **Commander Damage** — Per-player, per-commander tracker. Swipe or tap to enter commander damage mode. Automatically flags when a player has taken 21+ from a single commander. Supports partner commanders (separate tracking per partner)
- **Poison Counters** — Per-player infect damage tracker. Auto-KO at 10 (configurable)
- **Commander Tax** — Track how many times each player's commander has been cast. Display current tax cost
- **Additional Counters** — Energy, Experience, Treasure, Monarch status, Initiative, Day/Night, City's Blessing, Storm count. All toggleable per player
- **Turn Tracker** — Current turn number. Optional turn timer (stopwatch, countdown, or chess-clock mode). Turn time alerts for slow play
- **Dice Roller** — d4, d6, d8, d10, d12, d20. High-roll mode (all players roll, highlight winner). Coin flip

**Post-Game:**
- **Game Summary** — Duration, turn count, winner, elimination order
- **Life Total Chart** — Line graph showing each player's life total over the course of the game (à la Moxtopper). Shareable as an image
- **Save to History** — Game saved and linked to your deck. Builds up win-rate and matchup statistics over time

**Game History & Personal Stats:**
- Win rate by deck (overall and per-matchup)
- Average game length
- Most-played commanders (yours and opponents')
- Win rate by player (who do you beat most? who dominates you?)
- Longest win streak, current streak

**Responsive consideration:** Vandalblast should be usable on a phone/tablet at the table. While Counterflux is desktop-first overall, this screen specifically should have a mobile-optimised layout for in-game use.

---

### 4.6 Firemind (Personal Analytics) — Future Phase

*Aggregate personal insights across all modules.*

- Collection value over time vs. spending (ROI tracking)
- Deck performance rankings (win rates, average game length)
- Most-played cards across all decks
- "Cards you own but never play" — surface unused value
- Pod meta analysis — what commanders/strategies dominate your group
- Monthly/quarterly personal report

---

## 5. Navigation & Layout

### Global Navigation (Persistent Sidebar)

Left-aligned vertical sidebar, always visible on desktop. Collapsed to icons on smaller viewports.

| Icon | Label | Screen | Izzet Flavour |
|------|-------|--------|---------------|
| ⚗️ | Epic Experiment | Dashboard | — |
| 🌀 | Thousand-Year Storm | Deck Builder | — |
| 💎 | Treasure Cruise | Collection Manager | — |
| 🔮 | Preordain | Market Intel & Spoilers | — |
| 💥 | Vandalblast | Game Tracker | — |

**Bottom of sidebar:**
- Mila avatar (System Familiar) — Click for settings, about, and Mila's insight history
- User profile / settings gear

### Top App Bar

Persistent across all screens.

- **Left:** Counterflux wordmark + current screen name
- **Centre:** Global search (searches cards across all contexts — collection, decks, market)
- **Right:** Notification bell (price alerts, spoiler updates), settings cog

---

## 6. Visual & Brand Identity

### 6.1 Design Direction

**"Neo-Occult Terminal"** — The feel of a master alchemist's personal ledger crossed with a high-tech terminal interface. Dark, immersive, and information-dense without being cluttered. Every element should feel like it belongs in an Izzet laboratory: precise, electric, slightly dangerous.

### 6.2 Colour Palette

| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| `--cf-primary` | `#0D52BD` | Izzet Blue | Primary buttons, active tab indicators, link text, selected states |
| `--cf-accent` | `#E23838` | Izzet Red | Alerts, missing card indicators, critical price drops, destructive actions |
| `--cf-bg` | `#0B0C10` | Deep Void | Main workspace background |
| `--cf-surface` | `#14161C` | Charcoal Slate | Cards, panels, sidebar, modals — with 1px ghost borders |
| `--cf-surface-hover` | `#1C1F28` | Ember Slate | Hover state for interactive surfaces |
| `--cf-border` | `#2A2D3A` | Ghost Border | 1px borders on all surface elements |
| `--cf-text` | `#EAECEE` | Frost White | Primary headings and body text |
| `--cf-text-muted` | `#7A8498` | Arcane Dust | Secondary data, inactive states, placeholder text |
| `--cf-text-dim` | `#4A5064` | Void Dust | Tertiary text, disabled states |
| `--cf-success` | `#2ECC71` | Verdant Growth | Owned indicators, positive price changes, successful actions |
| `--cf-warning` | `#F39C12` | Gilded Warning | Cautionary states, near-threshold alerts |
| `--cf-glow-blue` | `rgba(13, 82, 189, 0.3)` | Aether Glow | Text shadow / box-shadow on active/focused elements |
| `--cf-glow-red` | `rgba(226, 56, 56, 0.25)` | Ember Glow | Alert glow states |

### 6.3 Typography

| Role | Font | Weight | Size Range | Usage |
|------|------|--------|------------|-------|
| Headings | Crimson Pro | 600–700 | 20–32px | Screen titles, section headers, card names in detail views |
| Body | Space Grotesk | 400–500 | 14–16px | Paragraph text, descriptions, UI labels |
| Data / Stats | JetBrains Mono | 400 | 12–14px | Prices, mana costs, statistics, terminal input, card counts |
| Micro | Space Grotesk | 400 | 11–12px | Timestamps, metadata, tooltips |

### 6.4 Visual Effects

- **Ghost borders:** All surface panels have a `1px solid var(--cf-border)` border. Subtle but essential for delineating panels on the dark background
- **Active glow:** Active tabs, focused inputs, and selected cards get a `box-shadow: 0 0 8px var(--cf-glow-blue)` or `text-shadow: 0 0 6px var(--cf-glow-blue)` treatment
- **Aether gradient:** Subtle radial gradient on the main background — a barely-perceptible blue-to-void wash emanating from the top-left corner. Atmospheric, not distracting
- **Transitions:** All interactive state changes (hover, focus, active) should have a `transition: all 0.15s ease` for polish
- **Card hover:** Card images scale to `1.03` on hover with a `box-shadow` lift effect
- **No heavy animation:** This is a data tool, not a game. Keep motion functional, not decorative

### 6.5 Mila — The System Familiar

**Role:** Guided mascot and insight provider. Mila is a Corgi wearing Izzet-themed engineering goggles and a tiny lab coat (visual reference previously provided). She appears throughout the app as a warm, personality-rich touchpoint.

**Placement:**
- **Sidebar avatar:** Small circular Mila portrait at the bottom of the sidebar navigation. Clicking opens settings/about
- **Insight bubbles:** On the Dashboard, Mila's Insight panel features her avatar alongside a daily tip or recommendation
- **Empty states:** When a screen has no data yet (empty collection, no decks, no game history), Mila appears with a contextual onboarding message. E.g., on an empty Collection: "Your archive is empty! Start by adding cards with the Quick Add above, or import a CSV from another tool."
- **Loading states:** Mila icon with a subtle animation during data fetches
- **Easter eggs:** Occasionally, Mila's insight text references real Izzet flavour text or card names

---

## 7. Component Library

### 7.1 Shared Components

**Card Tile:**
- Card image (sourced from Scryfall `image_uris.normal`)
- Hover: enlarge to `image_uris.large`, show name overlay, price badge, owned indicator
- Click behaviour varies by context (add to deck, view details, etc.)

**Card Detail Flyout:**
- Full card image, Oracle text, type line, mana cost, price (USD/EUR), legality badges
- Links: View on Scryfall, Buy on TCGPlayer/Cardmarket
- Collection status: owned quantity, location, condition
- Deck usage: list of decks this card appears in
- EDHREC data: synergy score for current commander (if in Deck Builder context)

**Data Table:**
- Sortable columns with click-to-sort headers (ascending/descending toggle)
- Filterable via per-column filter inputs or a global search
- Pagination or virtual scroll for large datasets
- Row hover highlight using `--cf-surface-hover`
- Compact density option for power users

**Search Input:**
- Autocomplete dropdown with card image thumbnails
- Scryfall syntax support with inline help tooltip
- Recent searches memory

**Stat Card:**
- A compact panel showing a single metric: label, value, trend indicator (arrow + colour), sparkline
- Used throughout Dashboard and Analytics

**Toast Notifications:**
- Bottom-right stack
- Types: info (blue), success (green), warning (amber), error (red)
- Auto-dismiss after 5 seconds, manually dismissable

### 7.2 Interaction Patterns

- **Keyboard-first:** All primary actions accessible via keyboard shortcuts. Card search focuses on `/`, Escape closes modals, Enter confirms
- **Right-click context menus:** On card tiles — Add to Deck, Add to Collection, Add to Wishlist, View Details, View on Scryfall
- **Drag and drop:** In the Deck Builder, drag cards between categories or from search results into the 99
- **Undo:** All destructive actions (removing cards, deleting decks) support Ctrl+Z undo with a 10-second grace period

---

## 8. Technical Specifications

### 8.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | HTML + Tailwind CSS v3 + Vanilla JS (or lightweight framework like Alpine.js/Petite Vue) | Keeps build simple for vibe-coding. No complex build tooling required |
| Card Data | Scryfall REST API + local bulk data cache | Comprehensive, free, well-documented, community-standard |
| User Data | IndexedDB (local-first) | Offline-capable, no account required to start |
| Sync (future) | Supabase (Postgres + Auth + Realtime) | Cloud backup, cross-device sync, shareable decklists |
| Hosting | Vercel or Netlify | Simple deploy, fast CDN |
| Price Data | Scryfall `prices` object (daily) | Sufficient for tracking, not for real-time trading |
| Combo Data | Commander Spellbook API | Community-maintained combo database |

### 8.2 Performance Targets

- Initial load: < 3 seconds on broadband
- Card search autocomplete: < 200ms response
- Collection view (1,000+ cards): Smooth scroll via virtualisation
- Deck Builder analytics: Real-time recalculation on card add/remove (< 100ms)
- Bulk data sync: Background process, non-blocking UI

### 8.3 Offline Capability

- Full collection and deck data available offline (IndexedDB)
- Card data from bulk cache available offline
- Price data stale indicator when offline
- Game Tracker fully functional offline
- Sync queue for changes made offline, resolved on reconnect

---

## 9. Phased Delivery

### Phase 1: Foundation (MVP)
- Global navigation and layout shell
- Dashboard (Epic Experiment) with portfolio summary and quick add
- Collection Manager (Treasure Cruise) — add, edit, delete cards; table and gallery views; CSV import/export; mass entry terminal
- Scryfall API integration and bulk data cache
- Visual identity: full colour palette, typography, ghost borders, Mila empty states
- IndexedDB persistence

### Phase 2: Deckbuilding
- Deck Builder (Thousand-Year Storm) — full editor with search, visual grid, list view, categories
- Live analytics sidebar (mana curve, colour pie, type breakdown, price summary)
- Collection-aware deckbuilding (owned/missing indicators)
- Deck import/export
- EDHREC recommendation integration (synergy suggestions)

### Phase 3: Intelligence
- Market Intel (Preordain) — spoiler browser, price watchlist, market trends, release calendar
- Commander Spellbook combo detection in Deck Builder
- Price alerts (configurable thresholds)
- Mila's daily insights (upgrade suggestions, price alerts, collection stats)

### Phase 4: Game Night
- Game Tracker (Vandalblast) — life totals, commander damage, counters, dice, turn tracking
- Post-game summary with life chart
- Game history and personal statistics (win rates, matchup data)
- Mobile-responsive layout for Vandalblast specifically

### Phase 5: Cloud & Social (Future)
- Supabase integration: user accounts, cloud sync, cross-device access
- Shareable deck links
- Firemind (Personal Analytics) — aggregate insights
- Trade binder matching (if community features pursued)

---

## 10. Appendices

### A. Izzet Naming Convention

All screen names and key UI elements draw from real MTG card names, spells, and Izzet guild lore. This creates a cohesive thematic identity and makes the app feel like a tool built by and for MTG players.

| UI Element | MTG Reference |
|------------|---------------|
| Epic Experiment | Epic Experiment (URR Sorcery — exile and cast spells) |
| Thousand-Year Storm | Thousand-Year Storm (Enchantment — copy spells) |
| Treasure Cruise | Treasure Cruise (Sorcery — draw three cards) |
| Preordain | Preordain (Sorcery — scry then draw) |
| Vandalblast | Vandalblast (Sorcery — destroy artifacts / overload) |
| Firemind | Niv-Mizzet, the Firemind (Legendary — the Izzet guild leader) |
| Initialize Ritual | Flavour: beginning a magical process |
| System Familiar | MTG familiars — small creatures that assist wizards |
| The Aetheric Archive | Aether — the magical substance of the multiverse |

### B. Competitive Landscape Summary

| Tool | Strength | Weakness | Counterflux Advantage |
|------|----------|----------|----------------------|
| Moxfield | Best deck editor UX | Minimal collection features, no game tracking | Full collection integration, game tracker, market intel |
| Archidekt | Good collection + deck combo | Collection UI clunky at scale, no mobile scanner | Cleaner UI, terminal mass-entry, analytics |
| Deckbox | Mature collection + trading | Deck builder is dated (2012-era UX) | Modern interface, integrated analytics, no trade dependency |
| EDHREC | Best recommendation/synergy data | No deckbuilder or collection — reference only | Integrates EDHREC data into the builder directly |
| TCGPlayer | Marketplace + pricing | Collection secondary to shopping | Price data integrated without marketplace friction |
| MythicSpoiler | Fast spoiler coverage | Spoiler-only, no other features | Spoilers as one tab in a unified tool |
| Commander Spellbook | Combo database | Standalone tool, no deck integration | Combos surfaced inline during deckbuilding |
| Lifetap / Moxtopper | Polished life tracking | Life tracking only | Game tracking + history + deck-linked stats |

### C. Scryfall API Quick Reference

```
Base URL: https://api.scryfall.com

GET /cards/search?q={query}         — Full-text search
GET /cards/named?fuzzy={name}       — Fuzzy name lookup
GET /cards/named?exact={name}       — Exact name lookup
GET /cards/autocomplete?q={partial} — Autocomplete (up to 20 results)
POST /cards/collection              — Batch lookup (up to 75 identifiers)
GET /cards/{id}                     — Single card by Scryfall ID
GET /sets                           — All sets
GET /sets/{code}                    — Single set by code
GET /bulk-data                      — Bulk data file list
GET /symbology                      — Mana symbols
GET /symbology/parse-mana?cost={cost} — Parse mana cost string

Headers required:
  User-Agent: Counterflux/1.0
  Accept: application/json
```

### D. Key Metrics (Post-Launch)

- Cards added per user per week
- Decks created per user per month
- Collection import completion rate
- Game Tracker sessions per week
- Price alert engagement (alerts set, alerts clicked)
- Return user rate (weekly active / monthly active)

---

*Document version: 1.0*
*Author: James — VP Marketing, Perkbox*
*Assistant: Claude (Anthropic)*
*Created: April 2026*
