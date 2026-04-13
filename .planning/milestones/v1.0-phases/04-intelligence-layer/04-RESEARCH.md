# Phase 4: Intelligence Layer - Research

**Researched:** 2026-04-06
**Domain:** External API integration (EDHREC, Commander Spellbook), deck analytics, caching
**Confidence:** HIGH

## Summary

Phase 4 adds data-driven deck intelligence by integrating two external APIs -- EDHREC for synergy suggestions and salt scores, and Commander Spellbook for combo detection -- and extending the existing deck analytics with category gap detection. Both APIs are verified accessible from browser environments with CORS enabled. EDHREC uses unofficial but stable JSON endpoints served from a CDN (`json.edhrec.com`), while Commander Spellbook has a proper documented REST API with a `find-my-combos` POST endpoint that returns exactly the data structure needed (included combos + near-miss combos). Salt scores are per-card values available from EDHREC's card summary endpoint (`json.edhrec.com/cards/{name}`) and must be aggregated client-side.

The existing codebase provides strong integration points: `deck-analytics.js` for gap detection, `deck-analytics-panel.js` with a salt score placeholder at line 359-369, `deck-card-tile.js` for combo badges, and the Dexie schema ready for version 4 with cache tables. The rate-limited API queue pattern from ScryfallService should be replicated for EDHREC requests.

**Primary recommendation:** Build two new service modules (`edhrec.js` and `spellbook.js`) with Dexie-backed caching, extend `deck-analytics.js` with gap detection, add an intelligence Alpine store to orchestrate data flow, then wire UI changes into the existing analytics panel and card tiles.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Primary data source is EDHREC's internal JSON endpoints (e.g. `/json/commanders/{commander}.json`). HTML scraping as fallback if JSON endpoints fail or change format.
- **D-02:** EDHREC data cached in IndexedDB (Dexie) keyed by commander name/ID. First fetch hits EDHREC, subsequent views use cache. Cache refreshes on demand or after 7 days.
- **D-03:** Graceful degradation on EDHREC failure -- show "Intelligence unavailable -- using local heuristics" message. Fall back to existing oracle text tag heuristics from `tag-heuristics.js`. Salt score shows "N/A". No crash, no blocking.
- **D-04:** Rate limiting on EDHREC requests -- respect their servers, batch requests, add delays between fetches.
- **D-05:** Use Commander Spellbook's public API to fetch combos by card name. Returns pieces, steps, and results.
- **D-06:** Combo data also cached in IndexedDB per deck/commander for offline access after first fetch.
- **D-07:** Synergy suggestions appear as a new "SYNERGY SUGGESTIONS" section in the right analytics sidebar below existing charts. Shows top 10-15 synergy cards with lift scores. Clicking a suggestion adds it to deck. Three-panel layout stays intact.
- **D-08:** Combo detection uses badges on combo piece card tiles in the 99. Clicking the badge shows a popover with combo name, all pieces, and steps. Near-miss combos (1 piece missing) shown in analytics sidebar with the missing piece highlighted.
- **D-09:** Salt score replaces the existing placeholder in the analytics panel with a visual gauge (0-10 scale, colour-coded green/yellow/red). Matches mockup's "SALT: 7/10 CRITICAL" design.
- **D-10:** Gap warnings displayed inline in the tag/category breakdown section -- tags below threshold show a warning icon + amber text.
- **D-11:** Sensible defaults, user-editable per deck. Ship with community-standard defaults.
- **D-12:** Default thresholds (100-card Commander): Ramp: 10, Draw: 10, Removal: 8, Board Wipes: 3, Lands: 36. Scale proportionally for 60-card formats.
- **D-13:** Gap detection covers five categories: Ramp, Draw, Removal, Board Wipes, and Lands.
- **D-14:** Insight content focused on deck upgrade suggestions -- Mila suggests swapping a card for a higher-synergy alternative from EDHREC data.
- **D-15:** Insight appears on the Epic Experiment dashboard only (DASH-04 panel). Phase 4 builds the insight generation service; Phase 6 wires it to the dashboard UI.
- **D-16:** One insight per day, rotated. Insight generation service picks the most impactful suggestion across all user decks.

### Claude's Discretion
- EDHREC JSON endpoint URL patterns and parsing strategy
- Commander Spellbook API query structure and response mapping
- Synergy card tile design within the analytics sidebar
- Combo badge icon/styling within Organic Brutalism
- Salt gauge visual design (bar vs radial vs linear)
- Gap threshold settings popover UX
- Insight generation algorithm (how to rank upgrade suggestions)
- Cache invalidation strategy details (7-day default, on-demand refresh UX)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEL-01 | EDHREC synergy suggestions surfaced on commander selection (top synergy cards filtered by colour identity with lift scores) | Verified EDHREC JSON endpoint at `json.edhrec.com/pages/commanders/{name}.json` returns `highsynergycards` cardlist with `synergy` decimal (lift score) and `inclusion` count. Cards pre-filtered by commander's colour identity. |
| INTEL-02 | Category gap detection: prompt when deck has fewer than threshold ramp/removal/draw cards | Existing `computeDeckAnalytics()` already computes `tagBreakdown`. Gap detection adds threshold comparison against the 5 categories (Ramp, Draw, Removal, Board Wipes, Lands). |
| INTEL-03 | Commander Spellbook combo detection: surface known combos in current 99 with badge, pieces, and steps | Verified `POST /find-my-combos` endpoint returns `results.included` array with combo `uses` (pieces with card details), `description` (steps), and `produces` (results/effects). |
| INTEL-04 | Near-miss combo suggestions where only 1 piece is missing | Same endpoint returns `results.almostIncluded` array with identical structure -- combos where the deck is 1 card away. |
| INTEL-05 | Salt score aggregate for deck (from EDHREC data) | Salt available per-card at `json.edhrec.com/cards/{name}` as a decimal. Aggregate by averaging across all 99 cards. Must batch-fetch with rate limiting. |
| INTEL-06 | Mila's daily insights: upgrade suggestions | EDHREC synergy data enables comparing current deck cards against higher-synergy alternatives. Service layer only in Phase 4; dashboard UI in Phase 6. |
</phase_requirements>

## Standard Stack

### Core (existing -- no new npm packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.4.x | IndexedDB cache for EDHREC/Spellbook data | Already in project, schema versioning handles new tables |
| Alpine.js | 3.15.x | Intelligence store, reactive UI updates | Already in project, follows established store pattern |
| Chart.js | 4.x | Salt gauge visualisation (reuse existing tree-shaken setup) | Already registered and configured |

### Supporting (no new dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mana-font | existing | Mana cost rendering on synergy suggestion tiles | Already loaded globally |
| Material Symbols | existing | Warning icons for gap detection, combo badge icon | Already loaded |

### Why No New Dependencies
Both external APIs return JSON over standard `fetch()`. No SDK or wrapper library exists for either API that would be worth adding. The project's existing rate-limited queue pattern (from ScryfallService) provides the template for EDHREC rate limiting. Commander Spellbook's API is a single POST endpoint.

## Architecture Patterns

### New File Structure
```
src/
├── services/
│   ├── edhrec.js           # EDHREC API client + Dexie cache
│   └── spellbook.js        # Commander Spellbook API client + Dexie cache
├── stores/
│   └── intelligence.js     # Alpine.store('intelligence') orchestration
├── utils/
│   ├── deck-analytics.js   # EXTEND: add gap detection
│   ├── gap-detection.js    # Gap threshold logic + defaults
│   └── insight-engine.js   # Mila insight generation service
├── components/
│   ├── deck-analytics-panel.js  # EXTEND: synergy section, salt gauge, gap warnings
│   ├── deck-card-tile.js        # EXTEND: combo badge overlay
│   ├── combo-popover.js         # New: combo detail popover on badge click
│   ├── synergy-card.js          # New: synergy suggestion mini-card tile
│   └── salt-gauge.js            # New: salt score visual gauge component
└── db/
    └── schema.js           # EXTEND: version 4 with edhrec_cache + combo_cache tables
```

### Pattern 1: Service + Cache Layer (EDHREC)
**What:** Service module that wraps fetch calls, manages rate limiting, and reads/writes Dexie cache.
**When to use:** Every EDHREC data access goes through this service.
**Example:**
```javascript
// src/services/edhrec.js
import { db } from '../db/schema.js';

const EDHREC_BASE = 'https://json.edhrec.com';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_DELAY_MS = 200; // Rate limit: 5 req/sec max

let lastRequestTime = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Counterflux/1.0' }
  });
  if (!res.ok) throw new Error(`EDHREC ${res.status}`);
  return res.json();
}

export async function getCommanderSynergies(commanderName) {
  const sanitized = commanderName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Check cache
  const cached = await db.edhrec_cache.get(sanitized);
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    return cached.data;
  }
  
  // Fetch fresh
  const data = await rateLimitedFetch(
    `${EDHREC_BASE}/pages/commanders/${sanitized}.json`
  );
  
  // Extract high synergy cards
  const cardlists = data.container?.json_dict?.cardlists || [];
  const synergies = cardlists
    .find(cl => cl.tag === 'highsynergycards')
    ?.cardviews || [];
  
  const result = {
    synergies: synergies.map(cv => ({
      name: cv.name,
      synergy: cv.synergy,        // lift score decimal (0.63 = +63%)
      inclusion: cv.inclusion,     // deck count
      num_decks: cv.num_decks,
      url: cv.url,
      sanitized: cv.sanitized,
    })),
    allCards: cardlists,           // full categorised lists
    commanderSalt: data.container?.json_dict?.card?.salt || null,
  };
  
  // Cache
  await db.edhrec_cache.put({
    commander: sanitized,
    data: result,
    fetched_at: Date.now(),
  });
  
  return result;
}
```

### Pattern 2: Commander Spellbook Integration
**What:** POST deck card list to find-my-combos, parse included + almostIncluded results.
**When to use:** When deck cards change or on first load of deck builder.
```javascript
// src/services/spellbook.js
const SPELLBOOK_BASE = 'https://backend.commanderspellbook.com';

export async function findDeckCombos(commanderNames, cardNames) {
  const body = {
    commanders: commanderNames.map(name => ({ card: name })),
    main: cardNames.map(name => ({ card: name })),
  };
  
  const res = await fetch(`${SPELLBOOK_BASE}/find-my-combos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) throw new Error(`Spellbook ${res.status}`);
  const data = await res.json();
  
  return {
    included: (data.results?.included || []).map(mapCombo),
    almostIncluded: (data.results?.almostIncluded || []).map(mapCombo),
  };
}

function mapCombo(raw) {
  return {
    id: raw.id,
    pieces: raw.uses.map(u => ({
      name: u.card.name,
      cardId: u.card.id,
      image: u.card.imageUriFrontNormal || u.card.imageUriFrontSmall,
    })),
    produces: raw.produces.map(p => p.feature.name),
    description: raw.description,       // step-by-step text
    manaNeeded: raw.manaNeeded,
    identity: raw.identity,
    prerequisites: raw.easyPrerequisites || '',
  };
}
```

### Pattern 3: Gap Detection (Pure Function)
**What:** Compare tag breakdown against configurable thresholds, return warnings.
**When to use:** Called from `computeDeckAnalytics()` or as a separate utility.
```javascript
// src/utils/gap-detection.js
export const DEFAULT_THRESHOLDS = {
  'Ramp': 10,
  'Draw': 10,
  'Removal': 8,
  'Board Wipe': 3,
  'Lands': 36,  // special: count from typeBreakdown.Land, not tags
};

export function detectGaps(analytics, thresholds = DEFAULT_THRESHOLDS, deckSize = 100) {
  const scale = deckSize / 100;
  const gaps = [];
  
  for (const [category, threshold] of Object.entries(thresholds)) {
    const scaledThreshold = Math.round(threshold * scale);
    let count;
    
    if (category === 'Lands') {
      count = analytics.typeBreakdown?.Land || 0;
    } else {
      count = analytics.tagBreakdown?.[category] || 0;
    }
    
    if (count < scaledThreshold) {
      gaps.push({
        category,
        count,
        threshold: scaledThreshold,
        severity: count < scaledThreshold * 0.5 ? 'critical' : 'warning',
      });
    }
  }
  
  return gaps;
}
```

### Pattern 4: Intelligence Store (Orchestrator)
**What:** Alpine store that coordinates fetching, caching, and exposing intelligence data to UI.
**When to use:** Central state for all intelligence features, reactive to deck changes.
```javascript
// src/stores/intelligence.js
Alpine.store('intelligence', {
  synergies: [],
  combos: { included: [], almostIncluded: [] },
  gaps: [],
  saltScore: null,
  loading: false,
  error: null,
  
  async fetchForDeck(deck, cards) { /* orchestrate all fetches */ },
  async refreshEDHREC(commanderName) { /* force cache refresh */ },
});
```

### Anti-Patterns to Avoid
- **Fetching salt per-card in parallel:** EDHREC has no batch salt endpoint. Fetching 99 individual card salt scores would be 99 HTTP requests. Instead, use the commander page's `card.salt` as the commander's salt, then for the 99, fetch salt lazily or use a reasonable heuristic (average of cards that have cached salt data).
- **Blocking deck builder on API responses:** Intelligence data must load asynchronously. The deck builder remains fully functional without intelligence. Show loading skeletons, then populate when data arrives.
- **Storing raw API responses:** Trim EDHREC/Spellbook responses to essential fields before caching in Dexie. Raw responses include full image URIs and pricing data (hundreds of KB) that the app doesn't need for intelligence features.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Commander name sanitization | Custom slug generator | Replicate EDHREC's pattern: `toLowerCase().replace(/[^a-z0-9]+/g, '-')` | Must match EDHREC's URL slugs exactly |
| Combo detection algorithm | Local combo database | Commander Spellbook API `find-my-combos` | Maintains 30,000+ combos, updated daily |
| Synergy scoring | Custom synergy calculator | EDHREC pre-computed synergy scores | Based on analysis of 500K+ decks |
| Rate limiting queue | Custom promise queue | Copy pattern from existing ScryfallService | Already battle-tested in the project |

## Common Pitfalls

### Pitfall 1: EDHREC Name Sanitization Mismatch
**What goes wrong:** Commander name doesn't match EDHREC's URL slug format, resulting in 404s.
**Why it happens:** EDHREC uses a specific sanitization: lowercase, non-alphanumeric replaced with hyphens, trailing hyphens stripped. Special characters (commas, apostrophes) are removed.
**How to avoid:** Use the `sanitized` field from Scryfall data if available, or implement exact sanitization: `name.toLowerCase().replace(/[',]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')`. Test with edge cases: "Prossh, Skyraider of Kher" -> "prossh-skyraider-of-kher", "Zur the Enchanter" -> "zur-the-enchanter".
**Warning signs:** 404 responses from EDHREC, especially on commanders with punctuation.

### Pitfall 2: Commander Spellbook Request Format
**What goes wrong:** API returns error or echoes back the request instead of combos.
**Why it happens:** The `find-my-combos` endpoint requires cards as arrays of `{ card: "Name" }` objects, NOT plain strings. Sending `["Sol Ring"]` fails; must send `[{"card": "Sol Ring"}]`.
**How to avoid:** Always wrap card names: `cardNames.map(name => ({ card: name }))`.
**Warning signs:** Response with `nonFieldErrors: ["Invalid data. Expected a dictionary, but got str."]`.

### Pitfall 3: Salt Score Aggregation Strategy
**What goes wrong:** Trying to fetch individual salt for all 99 cards creates 99+ HTTP requests to EDHREC.
**Why it happens:** EDHREC has no batch salt endpoint. The `/cards/{name}` endpoint returns salt per-card.
**How to avoid:** Two-tier approach: (1) Commander's own salt from the commander page JSON (`container.json_dict.card.salt`), (2) For aggregate deck salt, fetch card salt data lazily -- when a card's EDHREC summary is already cached from other interactions, use it. For uncached cards, queue fetches with rate limiting over time, not all at once. Show partial/estimated salt while loading.
**Warning signs:** Rate limiting errors from EDHREC, slow initial load.

### Pitfall 4: CORS on EDHREC
**What goes wrong:** Browser blocks EDHREC requests.
**Why it happens:** Possible CORS misconfiguration on certain endpoints.
**How to avoid:** Verified that `json.edhrec.com` returns `Access-Control-Allow-Origin: *` on OPTIONS preflight. The `User-Agent` header may cause a preflight; if blocked, omit it (CORS simple request). Test from actual browser early.
**Warning signs:** CORS errors in console. Fallback: use Vite proxy in dev, and for production, the app is local-first so this is a dev concern.

### Pitfall 5: Dexie Schema Version Conflicts
**What goes wrong:** Users on previous schema versions get upgrade errors.
**Why it happens:** Dexie requires careful version management. Version 4 must include ALL tables from versions 1-3 plus new ones.
**How to avoid:** Copy all existing stores from version 3 and add new tables. Never modify existing table indexes in a new version without an upgrade function.
**Warning signs:** `UpgradeError` or missing tables after update.

### Pitfall 6: Stale Intelligence Data After Deck Edit
**What goes wrong:** User adds/removes cards but combo detection and gap analysis don't update.
**Why it happens:** Intelligence store not reactive to deck card changes.
**How to avoid:** Use Alpine.effect() watching `Alpine.store('deck').activeCards` to trigger re-computation of gaps (instant, local) and debounced re-fetch of combos (network, expensive). EDHREC synergies don't need re-fetch on card changes (they're commander-specific).
**Warning signs:** Stale combo badges, incorrect gap warnings after editing deck.

## Code Examples

### Dexie Schema Version 4
```javascript
// src/db/schema.js -- add version 4
db.version(4).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  edhrec_cache: 'commander',       // keyed by sanitized commander name
  combo_cache: 'deck_id',          // keyed by deck ID
  card_salt_cache: 'sanitized',    // keyed by sanitized card name
});
```

### Salt Gauge Rendering (Organic Brutalism)
```javascript
// Replaces the "COMING IN PHASE 4" placeholder at line 359-369
function renderSaltGauge(container, saltScore) {
  container.innerHTML = '';
  
  if (saltScore === null || saltScore === undefined) {
    const na = document.createElement('div');
    na.style.cssText = "font: 400 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase; color: #4A5064;";
    na.textContent = 'SALT: N/A';
    container.appendChild(na);
    return;
  }
  
  // Clamp 0-4 (most decks fall in this range, display as 0-10 scale)
  const display = Math.min(10, Math.round(saltScore * 2.5)); // normalize to 0-10
  const color = display <= 3 ? '#2ECC71' : display <= 6 ? '#F39C12' : '#E23838';
  const label = display <= 3 ? 'MILD' : display <= 6 ? 'SPICY' : 'CRITICAL';
  
  // Score text
  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = "font: 700 20px/1.2 'Syne', sans-serif; letter-spacing: 0.01em;";
  scoreEl.style.color = color;
  scoreEl.textContent = `SALT: ${display}/10 ${label}`;
  container.appendChild(scoreEl);
  
  // Bar gauge
  const bar = document.createElement('div');
  bar.style.cssText = 'height: 8px; background: #1C1F28; margin-top: 8px; position: relative;';
  const fill = document.createElement('div');
  fill.style.cssText = `height: 100%; width: ${display * 10}%; background: ${color}; transition: width 300ms ease-out;`;
  bar.appendChild(fill);
  container.appendChild(bar);
}
```

### Combo Badge on Card Tile
```javascript
// Added to renderGridTile() in deck-card-tile.js
function addComboBadge(tile, comboCount) {
  if (!comboCount) return;
  const badge = document.createElement('div');
  badge.className = 'combo-badge';
  badge.style.cssText = `
    position: absolute; top: 4px; right: 4px; z-index: 10;
    width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
    background: #0D52BD; cursor: pointer;
    font: 700 11px/1 'JetBrains Mono', monospace; color: #EAECEE;
  `;
  badge.textContent = comboCount > 1 ? comboCount : '';
  badge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">bolt</span>`;
  badge.title = `Part of ${comboCount} combo${comboCount > 1 ? 's' : ''}`;
  tile.appendChild(badge);
}
```

### EDHREC Commander JSON Response Shape (Verified)
```javascript
// GET https://json.edhrec.com/pages/commanders/{sanitized-name}.json
{
  avg_price: 1394.0,                  // average deck price in cents
  creature: 27, instant: 9, /* ... */ // type distribution
  num_decks_avg: 6504,                // total decks analyzed
  similar: [/* similar commanders with salt */],
  container: {
    json_dict: {
      card: {
        name: "Prossh, Skyraider of Kher",
        salt: 0.8,                    // commander's salt score
        color_identity: ["B","R","G"],
        // ... prices, image_uris, etc.
      },
      cardlists: [
        { header: "New Cards", tag: "newcards", cardviews: [/*...*/] },
        { header: "High Synergy Cards", tag: "highsynergycards", cardviews: [
          {
            name: "Impact Tremors",
            synergy: 0.63,            // +63% lift score
            inclusion: 4477,          // decks containing this card
            num_decks: 4477,
            potential_decks: 6504,
            url: "/cards/impact-tremors",
            sanitized: "impact-tremors",
          }
        ]},
        { header: "Top Cards", tag: "topcards", cardviews: [/*...*/] },
        { header: "Game Changers", tag: "gamechangers", cardviews: [/*...*/] },
        { header: "Creatures", tag: "creatures", cardviews: [/*...*/] },
        // ... Instants, Sorceries, Utility Artifacts, Enchantments,
        //     Planeswalkers, Utility Lands, Mana Artifacts, Lands
      ],
    },
  },
}
```

### Commander Spellbook find-my-combos Response Shape (Verified)
```javascript
// POST https://backend.commanderspellbook.com/find-my-combos
// Body: { commanders: [{card:"Name"}], main: [{card:"Name"}, ...] }
{
  count: null,
  results: {
    identity: "BRG",                  // deck's colour identity
    included: [                       // FULL combos found in deck
      {
        id: "3519-3705",
        uses: [                       // combo pieces
          {
            card: { id: 3705, name: "Squee, the Immortal", /* images */ },
            quantity: 1,
            zoneLocations: ["B"],     // B=battlefield, C=command zone
          },
          { card: { id: 3519, name: "Food Chain", /* ... */ }, /* ... */ },
        ],
        produces: [                   // combo effects
          { feature: { id: 463, name: "Infinite colored mana...", uncountable: true } },
          { feature: { id: 4, name: "Infinite ETB" } },
        ],
        description: "Activate Food Chain by exiling Squee...",  // step-by-step
        manaNeeded: "...",
        identity: "RG",
        easyPrerequisites: "",
        notablePrerequisites: "",
      }
    ],
    almostIncluded: [                 // NEAR-MISS combos (1 piece away)
      // Same structure as included -- missing piece is in uses but not in deck
    ],
    includedByChangingCommanders: [], // combos if commander was different
    almostIncludedByAddingColors: [], // combos needing out-of-identity cards
  }
}
```

### EDHREC Card Salt Endpoint (Verified)
```javascript
// GET https://json.edhrec.com/cards/{sanitized-name}
{
  name: "Sol Ring",
  salt: 1.46268656716418,            // salt score decimal
  color_identity: [],
  oracle_text: "...",
  tags: ["Ramp", "Mana Rock"],       // EDHREC's tag classification
  // ... prices, image_uris, sets, etc.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Commander Spellbook Google Sheets API | REST API at backend.commanderspellbook.com | ~2023 | Proper paginated REST with POST find-my-combos |
| EDHREC scraping HTML | EDHREC JSON CDN endpoints | Stable since ~2020 | Reliable structured JSON, no parsing needed |
| Manual salt score tracking | EDHREC per-card salt values | Ongoing | Decimal values updated with community voting |

## Open Questions

1. **EDHREC Salt Normalization**
   - What we know: Salt scores are decimals (e.g. Sol Ring = 1.46, Prossh = 0.8). Most cards fall between 0 and 4.
   - What's unclear: The exact scale and distribution. The mockup shows "SALT: 7/10 CRITICAL" suggesting a 0-10 display scale.
   - Recommendation: Normalize by multiplying raw salt by ~2.5 and capping at 10 for display. Average all cards' salt in deck for aggregate. Test with real data to calibrate the multiplier. Can also use the commander's salt from the commander page as a quick shortcut while individual card salt loads.

2. **EDHREC Rate Limits**
   - What we know: No documented rate limit. The JSON endpoints are CDN-hosted (likely Cloudflare/S3).
   - What's unclear: Exact threshold before throttling/blocking.
   - Recommendation: Use 200ms minimum between requests (5 req/sec max). Cache aggressively (7-day TTL). Never fetch more than needed per user action.

3. **Insight Ranking Algorithm**
   - What we know: Need to pick the "most impactful" upgrade suggestion across all decks.
   - What's unclear: How to rank "impact" -- synergy delta? Price efficiency? Missing category coverage?
   - Recommendation: Score = (EDHREC synergy of suggestion - synergy of current card in same slot) weighted by category need (e.g. if deck is low on removal, weight removal suggestions higher). Pick highest-scored suggestion. Start simple, iterate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | vitest.config implied in package.json |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTEL-01 | EDHREC synergy fetch + cache + parse | unit | `npx vitest run tests/edhrec-service.test.js -t "synergy"` | Wave 0 |
| INTEL-02 | Gap detection thresholds + scaling | unit | `npx vitest run tests/gap-detection.test.js` | Wave 0 |
| INTEL-03 | Spellbook combo detection + mapping | unit | `npx vitest run tests/spellbook-service.test.js -t "included"` | Wave 0 |
| INTEL-04 | Near-miss combo detection | unit | `npx vitest run tests/spellbook-service.test.js -t "almostIncluded"` | Wave 0 |
| INTEL-05 | Salt score aggregation + display | unit | `npx vitest run tests/salt-score.test.js` | Wave 0 |
| INTEL-06 | Insight generation ranking | unit | `npx vitest run tests/insight-engine.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/edhrec-service.test.js` -- covers INTEL-01, INTEL-05 (mock fetch, verify cache, parse synergy)
- [ ] `tests/spellbook-service.test.js` -- covers INTEL-03, INTEL-04 (mock fetch, verify combo mapping)
- [ ] `tests/gap-detection.test.js` -- covers INTEL-02 (pure function, threshold comparison)
- [ ] `tests/salt-score.test.js` -- covers INTEL-05 (aggregation, normalization, edge cases)
- [ ] `tests/insight-engine.test.js` -- covers INTEL-06 (ranking algorithm, daily rotation)
- [ ] `tests/fixtures/edhrec-prossh.json` -- sample EDHREC response fixture
- [ ] `tests/fixtures/spellbook-combos.json` -- sample Spellbook response fixture

## Sources

### Primary (HIGH confidence)
- EDHREC JSON API -- live-tested `json.edhrec.com/pages/commanders/prossh-skyraider-of-kher.json` on 2026-04-06, verified response structure, cardlist tags, synergy scores
- EDHREC Card Salt -- live-tested `json.edhrec.com/cards/sol-ring` on 2026-04-06, confirmed salt field as decimal
- Commander Spellbook API -- live-tested `POST backend.commanderspellbook.com/find-my-combos` on 2026-04-06, verified request/response format with real deck data
- CORS verification -- both APIs confirmed CORS-enabled via OPTIONS preflight testing

### Secondary (MEDIUM confidence)
- [EDHREC JSON APIs issue](https://github.com/sigiltenebrae/edhrec_scraper/issues/1) -- documents endpoint patterns
- [Commander Spellbook Backend](https://github.com/SpaceCowMedia/commander-spellbook-backend) -- open source, MIT licensed
- [pyedhrec on PyPI](https://pypi.org/project/pyedhrec/) -- Python wrapper confirming EDHREC endpoint patterns

### Tertiary (LOW confidence)
- EDHREC rate limits -- no official documentation found, 200ms delay is conservative estimate
- Salt score normalization scale -- inferred from observed data range, needs calibration with more samples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, extending existing patterns
- Architecture: HIGH - follows established project patterns (services, stores, Dexie)
- API integration: HIGH - live-tested both APIs, verified request/response formats
- Salt normalization: MEDIUM - scale inferred from limited samples, needs calibration
- Pitfalls: HIGH - discovered through actual API testing (especially Spellbook dict format)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (APIs are community-maintained, endpoints may change)
