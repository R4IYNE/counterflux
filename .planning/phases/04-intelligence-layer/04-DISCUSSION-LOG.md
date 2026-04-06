# Phase 4: Intelligence Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 04-intelligence-layer
**Areas discussed:** EDHREC data sourcing, Intelligence UI placement, Category gap thresholds, Mila's daily insights

---

## EDHREC Data Sourcing

### Q1: How should we source EDHREC synergy and salt score data?

| Option | Description | Selected |
|--------|-------------|----------|
| Scrape EDHREC pages | Fetch EDHREC commander pages and parse synergy cards + salt scores from HTML/JSON | |
| EDHREC JSON endpoints | EDHREC serves internal JSON endpoints that power their frontend. Unofficial but stable, structured data. | |
| Static data bundle | Ship a pre-built JSON file of top commanders + synergy data. Fully offline, no API risk. | |
| Skip EDHREC, use alternatives | Use only Commander Spellbook API for combos and rely on oracle text heuristics for synergies. | |

**User's choice:** JSON endpoints as primary, scrape as fallback
**Notes:** Hybrid approach — try JSON endpoints first, fall back to HTML scraping if endpoints change.

### Q2: How should we source combo data for Commander Spellbook?

| Option | Description | Selected |
|--------|-------------|----------|
| Commander Spellbook API | Public API, fetch combos by card name, returns pieces + steps + results | ✓ |
| Static combo database | Download Commander Spellbook's data export and bundle it | |
| Skip combos for now | Defer INTEL-03 and INTEL-04 to a later phase | |

**User's choice:** Commander Spellbook API (Recommended)
**Notes:** None

### Q3: Should EDHREC data be fetched live per commander or cached locally?

| Option | Description | Selected |
|--------|-------------|----------|
| Cache in IndexedDB | First fetch hits EDHREC, stores in Dexie keyed by commander. Refresh after 7 days. | ✓ |
| Always fetch live | Hit EDHREC every time user selects a commander | |
| You decide | Claude picks caching strategy | |

**User's choice:** Cache in IndexedDB (Recommended)
**Notes:** None

### Q4: How should we handle EDHREC request failures?

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful degradation | Show message, fall back to oracle text heuristics, salt shows N/A | ✓ |
| Retry with backoff | Retry 2-3 times with exponential backoff before falling back | |
| You decide | Claude picks error handling approach | |

**User's choice:** Graceful degradation (Recommended)
**Notes:** None

---

## Intelligence UI Placement

### Q1: Where should EDHREC synergy suggestions appear?

| Option | Description | Selected |
|--------|-------------|----------|
| New analytics sidebar section | "SYNERGY SUGGESTIONS" section in right panel below existing charts. Top 10-15 cards with lift scores. | ✓ |
| Dedicated intelligence tab | Tab/toggle to switch right panel between Analytics and Intelligence | |
| Inline in search panel | "Suggested" section at top of left search panel | |

**User's choice:** New analytics sidebar section (Recommended)
**Notes:** None

### Q2: How should combo detection be surfaced?

| Option | Description | Selected |
|--------|-------------|----------|
| Badges on combo pieces | Small combo badge/icon on card tiles. Click for popover with details. Near-misses in sidebar. | ✓ |
| Combo list in sidebar | "COMBOS DETECTED" section in analytics sidebar | |
| Both badges + sidebar list | Badges on tiles AND sidebar section | |

**User's choice:** Badges on combo pieces (Recommended)
**Notes:** None

### Q3: Where should the salt score display?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace placeholder with gauge | Visual gauge (0-10, colour-coded green/yellow/red). Matches mockup design. | ✓ |
| Numeric with label only | Simple "SALT: 7.2 / 10" text display | |
| You decide | Claude picks within Organic Brutalism constraints | |

**User's choice:** Replace placeholder with gauge (Recommended)
**Notes:** None

### Q4: How should gap warnings be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline warnings in tag breakdown | Tags below threshold show warning icon + amber text in existing breakdown section | ✓ |
| Dedicated gap analysis section | New "DECK HEALTH" section with checklist | |
| Toast notifications | Pop toasts when dropping below threshold | |

**User's choice:** Inline warnings in tag breakdown (Recommended)
**Notes:** None

---

## Category Gap Thresholds

### Q1: How should thresholds be determined?

| Option | Description | Selected |
|--------|-------------|----------|
| Sensible defaults, user-editable | Community-standard defaults, adjustable per deck via settings popover | ✓ |
| EDHREC averages per commander | Pull average counts from EDHREC per commander | |
| Fixed defaults only | Hardcoded thresholds, no user configuration | |
| You decide | Claude picks threshold approach | |

**User's choice:** Sensible defaults, user-editable (Recommended)
**Notes:** None

### Q2: Which categories should have gap detection?

| Option | Description | Selected |
|--------|-------------|----------|
| Core three: Ramp, Draw, Removal | The universally agreed must-haves | |
| Core three + Lands + Board Wipes | Adds land count and board wipe minimum | ✓ |
| All default tags | Gap detection for every tag in DEFAULT_TAGS | |

**User's choice:** Core three + Lands + Board Wipes
**Notes:** None

---

## Mila's Daily Insights

### Q1: What kind of insights should Mila surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Deck upgrade suggestions | Suggest swapping a card for higher-synergy alternative from EDHREC | ✓ |
| Mixed: upgrades + stats + tips | Rotate between upgrades, collection stats, and general tips | |
| You decide | Claude picks content mix | |

**User's choice:** Deck upgrade suggestions (Recommended)
**Notes:** None

### Q2: Where should Mila's insights appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard panel only | Dedicated panel on Epic Experiment dashboard (DASH-04). Phase 4 builds service, Phase 6 wires UI. | ✓ |
| Sidebar tooltip | Hovering/clicking Mila shows today's insight as popover | |
| Both dashboard + sidebar | Dashboard gets full panel, sidebar gets indicator dot | |

**User's choice:** Dashboard panel only (Recommended)
**Notes:** None

---

## Claude's Discretion

- EDHREC JSON endpoint URL patterns and parsing strategy
- Commander Spellbook API query structure and response mapping
- Synergy card tile design within analytics sidebar
- Combo badge icon/styling
- Salt gauge visual design
- Gap threshold settings popover UX
- Insight generation algorithm
- Cache invalidation strategy details

## Deferred Ideas

None — discussion stayed within phase scope
