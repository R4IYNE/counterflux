# Feature Landscape

**Domain:** MTG Collection Management, Deckbuilding, Market Intelligence, Game Tracking
**Researched:** 2026-04-03
**Competitive Landscape:** Moxfield, Archidekt, Deckbox, EDHREC, TCGPlayer, Commander Spellbook, Lifetap, Moxtopper, Mythic Track, Playgroup.gg

---

## Data Source Capabilities (Foundation for All Features)

Understanding what the APIs can actually do constrains what features are feasible.

### Scryfall API

**Confidence: HIGH** (official docs verified)

| Capability | Details | Limitation |
|------------|---------|------------|
| Card search | Full-text search with 50+ operators (type, color, cmc, oracle text, set, rarity, price, regex) | 50-100ms delay between requests, 10 req/s max |
| Bulk data | Oracle Cards (~80MB), Default Cards (~300MB+), All Cards (1GB+), Unique Artwork, Rulings | Updated every 12 hours only |
| Images | small, normal, large, png, art_crop, border_crop formats. Multi-face cards have per-face URIs | Must not manually construct image URLs; use API-provided URIs |
| Pricing | `prices.usd`, `prices.usd_foil`, `prices.usd_etched`, `prices.eur`, `prices.tix` per card | Updated once per 24 hours. Stale after 24h. Aggregated from TCGPlayer + CardMarket |
| Collection lookup | POST up to 75 card identifiers (by id, name, or set+collector_number) | 75 card limit per batch request |
| Autocomplete | `/cards/autocomplete` endpoint for real-time search-as-you-type | Returns only card names, not full objects |
| Compliance | Must include User-Agent header, must not paywall Scryfall data, must not crop artist credits | Cannot repackage without adding value |

**Key insight for Counterflux:** Use bulk data (Oracle Cards for search, Default Cards for pricing) cached in IndexedDB for offline search and autocomplete. Only hit the live API for fresh pricing or cards not in bulk cache. This is the correct architecture -- do not rely on per-card API calls for collection browsing.

### Commander Spellbook API

**Confidence: MEDIUM** (official site + GitHub verified, API docs via Swagger)

| Capability | Details | Limitation |
|------------|---------|------------|
| Combo search | Search by card name, color identity, prerequisites, steps, results | No official JS SDK |
| Find My Combos | Paste a decklist, get all possible combos within that list | Web feature; API endpoint at `backend.commanderspellbook.com` |
| Bracket estimation | `/estimate-bracket` endpoint for two-card combo classification | Mainly for bracket-level analysis |
| Data format | JSON: `commanderSpellbookId`, `permalink`, `cards[]`, `colorIdentity`, `prerequisites`, `steps`, `results`, `hasBannedCard` | |
| OpenAPI docs | Swagger at `backend.commanderspellbook.com/schema/swagger/` | Undocumented rate limits |
| Open source | MIT license, Django/PostgreSQL backend | |

**Key insight for Counterflux:** Cross-reference deck card lists against combo database to surface "you have 3 of 4 cards for this infinite combo" suggestions. This is a killer differentiator no standalone deckbuilder does well.

### EDHREC Data Access

**Confidence: LOW** (undocumented API, may change without notice)

| Capability | Details | Limitation |
|------------|---------|------------|
| Commander page | `json.edhrec.com/pages/commanders/{name}.json` returns recommended cards with lift scores, inclusion %, deck counts | **Undocumented, unofficial** |
| Card page | `json.edhrec.com/pages/cards/{name}.json` returns which commanders use this card | Same caveat |
| Lift scores | Replaced synergy scores. Measures statistical association strength. 0-100 scale, logarithmic. Staples like Sol Ring score low (good) | Updated ~daily |
| Salt scores | Annual community survey. 0-4 scale per card. Published yearly | Static data, manually maintained |
| Themes/Typal | Theme pages and creature type pages with recommendations | |
| Data sources | Aggregates from Moxfield, Archidekt, MTGGoldfish, Aetherhub, Deckstats | |

**Key insight for Counterflux:** Do NOT depend on EDHREC as a core data source. Treat it as an enhancement layer. Cache responses aggressively (24h+). Have graceful fallback when endpoints inevitably change. Consider scraping salt scores once and storing locally since they only update annually.

### Scryfall Pricing (vs TCGPlayer API)

**Confidence: HIGH**

| Source | Access | Freshness | Detail Level |
|--------|--------|-----------|-------------|
| Scryfall (via card objects) | Free, included in bulk data | Daily | USD, USD foil, USD etched, EUR, TIX per card |
| TCGPlayer API | Requires partnership/approval | Hourly | Low/mid/high/market, per-condition, seller listings |
| JustTCG / CardMarket API | Third-party, may require API key | Varies | Condition-specific, multi-marketplace |

**Decision for Counterflux:** Use Scryfall pricing. It is free, daily, and sufficient for a collection tracker's needs (portfolio value, price trends, watchlist alerts). TCGPlayer API requires business partnership and is overkill for v1. The PROJECT.md already correctly identifies this.

---

## Module 1: Collection Management (Treasure Cruise)

### Table Stakes

Features users expect. Missing any of these and collectors will not migrate from Deckbox/Moxfield.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add cards by name with autocomplete | Every competitor has this. Typing "Sol" should instantly suggest "Sol Ring" | Medium | Scryfall autocomplete API or local bulk data fuzzy search |
| Specify printing (set + collector number) | Collectors care deeply about which printing they own (Alpha Sol Ring != Commander Legends Sol Ring) | Medium | Scryfall has set codes and collector numbers for every printing |
| Track condition | NM/LP/MP/HP/DMG is standard. Affects value calculation | Low | Simple enum field |
| Track foil/etched/showcase variants | Finish affects both value and collectibility | Low | Scryfall provides `finishes[]` array per card |
| Quantity tracking | "I own 4 of this card" is fundamental | Low | Integer field |
| Collection value total | Sum of all cards x qty x condition multiplier | Medium | Daily price refresh from Scryfall bulk data |
| Gallery view (card images) | Visual browsing is core to the MTG experience | Medium | Virtualized grid with lazy-loaded Scryfall images |
| List/table view | Dense data view for power users who want to sort/filter | Medium | Virtualized table with sortable columns |
| Search and filter | By name, type, color, set, rarity, price, tags | Medium | Leverage Scryfall search syntax locally |
| CSV import | Migration path from Deckbox, Moxfield, DragonShield scanner | High | Must parse multiple CSV dialects: Moxfield (Count, Name, Edition, Collector Number, Foil, Condition, Language, Purchase Price), Deckbox (similar but different column names), generic |
| CSV export | Backup and portability | Low | Standard format with all tracked fields |
| "In deck" indicator | Show which cards are currently assigned to decks | Medium | Cross-reference collection with deck data |
| Sort by value, name, color, set, date added | Basic organization | Low | Client-side sort on indexed data |

### Differentiators

Features that would set Counterflux apart from Deckbox/Moxfield collections.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mass Entry Terminal | Rapid-fire card entry mode: type name, quantity, condition in quick succession without page reloads or modals. Deckbox requires clicking through multiple fields per card. Moxfield's bulk entry is text-paste only | High | Custom input component with keyboard-optimized flow |
| Inventory categories / locations | "Binder 1", "Trade Box", "In Decks", "Lent to James" -- physical location tracking. Deckbox has tradelist/wishlist but not arbitrary categories | Medium | User-defined categories with card assignment |
| Set completion tracking | "You have 187/286 cards from Murders at Karlov Manor" with visual progress. Archidekt does this; Moxfield does not | Medium | Cross-reference owned cards against Scryfall set data |
| Purchase price tracking | Track what you paid vs current value for ROI/gains tracking | Low | Per-card field, compare against Scryfall daily price |
| Smart duplicate detection | On import or add, detect "you already own 2 of this printing" | Medium | Lookup by oracle_id + set + collector_number + finish |
| Collection-aware deck suggestions | "You own 67 of the 99 cards in the average Atraxa deck" | High | Cross-reference collection against EDHREC averages |
| Unified data layer | The deck builder knows what you own. Add a card to collection, it updates deck "owned/missing" counts instantly | High | This is the core value prop. Requires shared data model between collection and deck modules |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Camera/phone scanning | Desktop-first app. Camera scanning is a mobile feature that would add enormous complexity (ML model, camera API) for a desktop tool | Support CSV import from DragonShield (which does scanning well) and text-paste bulk entry |
| Social trading / marketplace | Deckbox's trading feature is complex, requires user accounts, reputation systems, messaging. Massive scope for minimal v1 value | Provide wishlists and tradelists as exportable lists |
| Price history charts per card | Requires historical price data storage and charting. TCGPlayer/MTGGoldfish already do this well | Link out to TCGPlayer/MTGGoldfish for historical data. Show current price only |
| Multi-game support (Pokemon, YGO) | Scope creep. Scryfall is MTG-only. Card data models differ between games | MTG Commander focus only |

---

## Module 2: Deck Builder (Thousand-Year Storm)

### Table Stakes

What Moxfield and Archidekt have set as the baseline for deckbuilding.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Card search with Scryfall syntax | Users expect `t:creature c:green cmc<=3` style queries | High | Parse Scryfall syntax locally against bulk data, or proxy to Scryfall API |
| Three-panel layout | Search panel + deck list + analytics sidebar. Moxfield's layout is the gold standard | High | Responsive panels, collapsible |
| Visual (grid) and list view for deck | Toggle between card image grid and compact text list | Medium | Two view modes for the deck panel |
| Category/custom tag grouping | Group cards by "Ramp", "Removal", "Card Draw", etc. Moxfield supports custom tags (global and per-deck), Archidekt has categories | Medium | User-defined categories with drag-and-drop assignment |
| Mana curve visualization | Bar chart of mana values. Real-time updates as cards are added/removed | Medium | Chart component, recalculate on deck mutation |
| Color pip distribution | Pie/bar chart of color symbols in mana costs vs color production from lands | Medium | Parse mana_cost strings from Scryfall data |
| Average CMC display | With and without lands. Moxfield even shows "without Ad Nauseam" for cEDH | Low | Simple calculation from card data |
| Type distribution | Creature/instant/sorcery/enchantment/artifact/land/planeswalker breakdown | Low | Count by type_line field |
| Commander selection | Set 1-2 commanders (partner support). Color identity derived automatically | Medium | Affects legal card pool, shown prominently |
| Card count validation | 100 cards for Commander (including commander). Warn on over/under | Low | Simple count check |
| Format legality checking | Flag cards banned in Commander or not legal in the format | Medium | Scryfall `legalities` field per card |
| Import from text | Paste a decklist (1 Card Name per line format) and parse it | Medium | Parse various text formats: "1x Card Name", "1 Card Name (SET) 123" |
| Export to text/Arena/MTGO | Standard export formats for sharing | Low | Format card list per target format spec |
| Deck price total | Sum of all card prices | Low | From Scryfall pricing data |
| Card quantity per deck | Support "2x Lightning Bolt" in non-singleton formats | Low | Though Commander is mostly singleton |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Collection-aware owned/missing | Highlight which cards you own and which you need to buy. Show "need to buy" list with prices. This is Counterflux's core differentiator -- Moxfield has basic "in collection" toggle but no integrated purchase list | High | Requires unified data layer with collection module |
| Commander Spellbook combo detection | "Your deck contains 3 combos. You're 1 card away from 2 more." Cross-reference deck against Commander Spellbook API | High | API integration, periodic check as deck is edited |
| EDHREC lift score recommendations | "Cards with high lift for your commander that you already own" -- combining EDHREC data with collection data | High | EDHREC JSON endpoint (unofficial). Cache aggressively |
| Near-miss combo suggestions | "Add [Card X] to enable the [Dramatic Reversal + Isochron Scepter] combo. You already own Card X." | Very High | Cross-reference combos, collection, and deck simultaneously |
| Deck comparison | Side-by-side compare two decks: shared cards, unique cards, stat differences | Medium | Useful for evaluating upgrades or comparing with friends |
| Bracket estimation | Use Commander Spellbook's bracket estimation API to suggest which power bracket a deck falls into | Medium | New-ish feature in Commander community, relevant to casual play |
| Mana base analysis | "You need 15 green sources but only have 12. Suggest: add Command Tower, Breeding Pool" | High | Algorithm based on Frank Karsten's mana base math |
| Undo/redo | Full undo stack for deck edits. Surprisingly absent from most web deckbuilders | Medium | Command pattern on deck mutations |
| Right-click context menu | Right-click a card for quick actions: remove, move to sideboard, change category, view on Scryfall | Medium | Custom context menu component |
| Keyboard shortcuts | Ctrl+Z undo, / to focus search, arrow keys to navigate results, Enter to add card | Medium | Keyboard-first interaction pattern |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Goldfish/solitaire playtester | Archidekt's is clunky. Moxfield's is basic. Building a good playtester is enormous scope (card interactions, zones, stack) | Link to PlayEDH or similar external playtesters. Focus on deckbuilding, not simulation |
| Social features (comments, likes, public decks) | Requires user accounts, moderation, discovery. Massive scope | Provide shareable deck export links. No accounts in v1 |
| Card proxying / printing | Legal gray area, separate tooling | Link to external proxy services |
| AI deck suggestions | "Build me a deck" AI is a rabbit hole of complexity and questionable quality | Use EDHREC recommendations (data-driven, community-validated) instead |
| Moxfield URL import | Moxfield's API is not public. Scraping would break | Support text/CSV import which Moxfield can export to |

---

## Module 3: Market Intelligence (Preordain)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Price watchlist | Save cards you want to track. Show current price, change since added | Medium | Store watchlist in IndexedDB, refresh from Scryfall daily prices |
| Price alerts | "Notify me when [Card] drops below $5" | Medium | Compare daily prices against user thresholds. Browser notifications |
| Collection portfolio value | Total value of your collection over time (daily snapshots) | Medium | Store daily value snapshots in IndexedDB |
| Release calendar | Upcoming set release dates | Low | Static/semi-static data, update quarterly |
| Spoiler browser | View newly spoiled cards from upcoming sets | Medium | Scryfall adds spoiled cards as they're revealed. Filter by set + date |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Price movement alerts for owned cards | "3 cards in your collection increased >20% today" -- no other tool proactively alerts on your owned cards | Medium | Daily diff on portfolio pricing |
| "Cards you own that spiked" | Cross-reference collection with daily price changes | Medium | Compelling for The Speculator persona |
| Deck upgrade budget tracker | "Upgrading this deck costs $47. Cards you already own save you $123" | Medium | Requires collection + deck + pricing integration |
| Format staple price tracker | Track price trends for top Commander staples (Sol Ring, Mana Crypt, Cyclonic Rift) | Low | Curated list + daily Scryfall prices |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time price ticker | Scryfall updates daily. Sub-daily pricing requires TCGPlayer API partnership. Misleading to show "real-time" data that's actually stale | Show "as of [date]" with daily refresh |
| Buy/sell marketplace | Enormous scope (payments, escrow, disputes, shipping). TCGPlayer exists | Link to TCGPlayer/CardKingdom with affiliate links |
| Price prediction / speculation AI | Unreliable, legally questionable, massive ML scope | Show historical price data and let users decide |
| Per-card price history charts | Requires months of stored historical data. MTGGoldfish already does this well | Link out to MTGGoldfish for deep price history |

---

## Module 4: Game Tracker (Vandalblast)

### Table Stakes

What Lifetap, Moxtopper, and Mythic Track have established as baseline.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Life total tracking | 2-6 players, starting at 40 (Commander). Large tap-to-increment/decrement buttons | Medium | Must be mobile-responsive (phone at game table) |
| Commander damage tracking | Track damage dealt by each commander to each player. 21 damage = KO | High | Matrix of player x commander relationships. Partner commanders add complexity |
| Commander tax tracking | Track how many times each commander has been cast (affects cost) | Low | Simple counter per commander |
| Poison/infect counters | Track poison counters per player (10 = lose) | Low | Simple counter |
| Player KO detection | Auto-detect when a player should be eliminated (0 life, 21 commander damage, 10 poison) | Medium | Watch multiple loss conditions |
| Configurable player count | 2-6 player pods | Medium | Dynamic layout adjustment |
| Player color/name customization | Set player names and background colors | Low | Personalization |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deck selection per player | "I'm playing my Atraxa deck tonight" -- ties game tracking to deck data | Medium | Enables deck win rate stats |
| Post-game summary | Winner, turn count, duration, final life totals, who eliminated whom | Medium | Captures the story of each game |
| Game history log | Browse past games with date, players, decks, winners | Medium | IndexedDB storage |
| Deck win rate stats | "Your Atraxa deck has won 7 of 15 games (47%)" | Medium | Aggregate from game history |
| Commander popularity stats | "Atraxa has been played 23 times in your group" | Low | Aggregate from game history |
| Playgroup analytics | "James wins 35% of games. The pod plays most on Thursdays" | Medium | The Pod Leader persona wants this |
| Experience/energy/treasure counters | Track various token/counter types per player | Low | Lifetap already does this well |
| Monarchy/initiative/day-night tracking | Game-state mechanics that affect all players | Medium | Shared state indicators |
| Dice roller | Roll d6, d20, flip coins | Low | Simple RNG utility |
| Turn tracker | "It's Player 3's turn. Turn 7." | Low | Sequential tracking |
| Life total graph | Post-game visualization showing life total changes over time. Moxtopper's graph sharing feature is popular | High | Requires recording every life change with timestamp |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full game state tracking | Tracking board state, cards in hand, graveyard, exile is enormous scope and not useful during real games | Track life/damage/counters only. Players manage their own board state |
| Card interaction rules engine | Implementing MTG rules is an impossible task for v1 | Leave rules adjudication to players |
| Online multiplayer / remote play | Requires networking, real-time sync, voice chat integration. SpellTable exists | Focus on in-person pod tracking |
| AI game analysis | "You should have attacked Player 2 on turn 5" is both scope-creepy and patronizing | Provide raw stats, let players draw conclusions |
| Timer/chess clock | Commander is a casual format. Timing players creates feel-bad moments | Optional turn time tracker at most, never enforced |

---

## Module 5: Mila (System Familiar) & Shell

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Global navigation | Sidebar with all module links, current module highlighted | Medium | Persistent shell component |
| Empty state guidance | "Your collection is empty. Start by importing a CSV or adding cards one at a time" | Low | Per-module empty states |
| Loading states | Skeleton screens during data fetch, not blank pages | Low | UX polish |
| Responsive header/breadcrumbs | Know where you are in the app at all times | Low | Navigation clarity |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mila mascot personality | Corgi with Izzet goggles providing contextual tips, encouragement, and personality. No competitor has this | Medium | Character illustrations, contextual message system |
| Mila's insights on dashboard | "Your collection value increased $12 this week", "3 of your watched cards dropped in price", "Your most-played deck is Atraxa" | High | Requires computing insights from multiple data sources |
| Neo-Occult Terminal aesthetic | Distinctive visual identity (ghost borders, aether gradients, Izzet palette) that no competitor matches. The look IS a feature | High | Custom design system, not a Bootstrap theme |
| Keyboard-first interaction | Power users expect keyboard shortcuts. Moxfield has some; most tools don't | Medium | Global shortcut registry |
| Offline capability | Collection, decks, and game tracking work without internet after initial data fetch | High | Service worker + IndexedDB architecture |

---

## Feature Dependencies

```
Scryfall Bulk Data Cache
  |
  +-- Collection Manager
  |     |
  |     +-- "In Deck" indicators (requires Deck Builder)
  |     +-- Portfolio value tracking (requires Scryfall prices)
  |     +-- Set completion (requires set data from Scryfall)
  |
  +-- Deck Builder
  |     |
  |     +-- Owned/Missing highlighting (requires Collection)
  |     +-- Commander Spellbook combos (requires CSB API integration)
  |     +-- EDHREC recommendations (requires EDHREC JSON access)
  |     +-- Near-miss combo suggestions (requires Collection + CSB)
  |     +-- Mana base analysis (requires deck data + Scryfall mana data)
  |
  +-- Market Intelligence
  |     |
  |     +-- Watchlist (requires Scryfall prices)
  |     +-- Portfolio value history (requires Collection + daily price snapshots)
  |     +-- Owned card spike alerts (requires Collection + daily prices)
  |     +-- Spoiler browser (requires Scryfall API for new cards)
  |
  +-- Game Tracker
  |     |
  |     +-- Deck selection per game (requires Deck Builder)
  |     +-- Deck win rate stats (requires Game History + Deck data)
  |     +-- Playgroup analytics (requires Game History)
  |
  +-- Dashboard (Epic Experiment)
        |
        +-- Portfolio summary (requires Collection + Market)
        +-- Quick add (requires Collection)
        +-- Mila's insights (requires all modules)
        +-- Deck quick-launch (requires Deck Builder)
```

**Critical path:** Scryfall Bulk Data Cache -> Collection Manager -> Deck Builder. Everything else branches from these three.

---

## MVP Recommendation

### Phase 1: Foundation + Collection (Treasure Cruise)

Prioritize:
1. Scryfall bulk data caching in IndexedDB (enables everything else)
2. Collection CRUD: add cards, specify printing/condition/foil, quantity, gallery+list views
3. Search and filter within collection
4. CSV import (Moxfield format first -- largest user base)
5. Collection value display
6. App shell with Izzet theme and Mila empty states

**Rationale:** Collection is the "sticky" feature. Once a user imports 500+ cards, they are invested. No collection = no differentiator for the deck builder later.

### Phase 2: Deck Builder (Thousand-Year Storm)

Prioritize:
1. Three-panel editor with Scryfall-syntax search
2. Category/tag management with drag-and-drop
3. Mana curve + type distribution + color pie analytics
4. Collection-aware owned/missing highlighting
5. Import/export (text format)
6. Commander selection + format legality

**Rationale:** The deck builder is the daily-use feature. Collection-aware deckbuilding is the core value prop. Ship it second because it depends on collection data existing.

### Phase 3: Intelligence Layer

Prioritize:
1. Commander Spellbook combo detection in deck builder
2. EDHREC lift score recommendations
3. Price watchlist with alerts
4. Spoiler browser
5. Portfolio value history (daily snapshots)

**Rationale:** This is the "wow" layer. Combo detection and EDHREC integration differentiate Counterflux from "just another deckbuilder."

### Phase 4: Game Night (Vandalblast)

Prioritize:
1. Life total tracking (mobile-responsive)
2. Commander damage matrix
3. Poison/counters
4. Deck selection per game + post-game summary
5. Game history with deck win rates

**Rationale:** Game tracker is the most independent module. Can ship last without blocking other features. Mobile-responsive layout is unique complexity.

Defer to post-v1:
- Mila's advanced insights (needs all modules shipping first)
- Playgroup analytics (needs game history volume)
- Near-miss combo suggestions (very high complexity)
- Deck comparison tool
- Mana base analysis with Frank Karsten math

---

## Sources

### Official / HIGH confidence
- [Scryfall REST API Documentation](https://scryfall.com/docs/api)
- [Scryfall Bulk Data Documentation](https://scryfall.com/docs/api/bulk-data)
- [Scryfall Card Imagery Documentation](https://scryfall.com/docs/api/images)
- [Scryfall Search Syntax Reference](https://scryfall.com/docs/syntax)
- [Scryfall Price Data FAQ](https://scryfall.com/docs/faqs/where-do-scryfall-prices-come-from-7)
- [Commander Spellbook Backend (GitHub)](https://github.com/SpaceCowMedia/commander-spellbook-backend)
- [Commander Spellbook Syntax Guide](https://commanderspellbook.com/syntax-guide/)
- [Commander Spellbook Find My Combos](https://commanderspellbook.com/find-my-combos/)
- [Commander Spellbook Swagger API](https://backend.commanderspellbook.com/schema/swagger/)
- [Moxfield Features Wiki (GitHub)](https://github.com/moxfield/moxfield-public/wiki/Features)
- [Moxfield Custom Tags Help](https://moxfield.com/help/managing-custom-tags)
- [Moxfield Collection Import Help](https://moxfield.com/help/importing-collection)
- [Archidekt Features Page](https://websockets.archidekt.com/features)
- [Archidekt Collection Tracker](https://archidekt.com/collection)
- [Deckbox Export/Import Help](https://deckbox.org/help/exports_and_imports)
- [Lifetap (App Store)](https://apps.apple.com/us/app/lifetap-life-counter-for-mtg/id1508241754)
- [Moxtopper Official Site](https://moxtopper.com/)
- [Mythic Track Official Site](https://www.mythictrack.com/)
- [TCGPlayer Price Data Access](https://help.tcgplayer.com/hc/en-us/articles/201577976-How-can-I-get-access-to-your-card-pricing-data)

### MEDIUM confidence (verified across multiple sources)
- [EDHREC Lift Score Article](https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era)
- [EDHREC Salt 2025 Scores](https://edhrec.com/articles/salt-2025-scores-are-here)
- [EDHREC FAQ](https://edhrec.com/faq)
- [GrimDeck MTG Tool Comparison 2026](https://grimdeck.com/blog/best-mtg-collection-tracker-deck-builder)
- [Draftsim Best MTG Deck Builder Review](https://draftsim.com/best-mtg-deck-builder/)
- [Draftsim Life Counter App Rankings](https://draftsim.com/best-mtg-life-counter-app/)

### LOW confidence (single source, undocumented)
- [EDHREC JSON API endpoints](https://github.com/sigiltenebrae/edhrec_scraper/issues/1) -- `json.edhrec.com` endpoints are undocumented and may change
- [pyedhrec library](https://pypi.org/project/pyedhrec/) -- third-party wrapper around undocumented EDHREC data
