---
phase: 8
slug: treasure-cruise-rapid-entry
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-15
reviewed_at: 2026-04-15
---

# Phase 8 — UI Design Contract

> Visual and interaction contract for the four Treasure Cruise entry surfaces shipped in Phase 8: the LHS persistent add panel (COLLECT-06), precon browser (COLLECT-02), paper-printings picker (COLLECT-04), and the search-dropdown + mass-entry polish (COLLECT-01 / COLLECT-03 / COLLECT-05).
>
> Anchored to the canonical Neo-Occult Terminal design tokens declared in `src/styles/main.css` `@theme`. Every token below already exists — this spec maps them to new surfaces, not inventing new ones.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (manual, vanilla Tailwind v4 + Alpine.js) |
| Preset | not applicable — project is Vite + Alpine + Tailwind v4, shadcn would not be used (no React) |
| Component library | none — Alpine.js `x-data` x-templates, rendered as HTML strings from `src/components/*.js` |
| Icon library | Material Symbols (via `index.html` link) for UI chrome + **keyrune** (`ss ss-{code}`) for set icons + **mana-font** (`ms ms-{cost}`) for mana — keyrune is the workhorse for this phase |
| Font | `Syne` (display) / `Space Grotesk` (body) / `JetBrains Mono` (labels) / `Crimson Pro` (quotes only, unused in this phase) |

**Anchor file:** `src/styles/main.css` lines 3-40 declare `@theme` tokens. All colour, spacing, and font decisions below reference these CSS custom properties. **Do not hard-code hex values in new components** — use `var(--color-*)` via Tailwind utilities (`bg-background`, `bg-surface`, `border-border-ghost`, `text-text-primary`, etc.).

---

## Spacing Scale

Declared values (multiples of 4, already in `@theme`):

| Token | Value | Tailwind utility | Usage in Phase 8 |
|-------|-------|------------------|------------------|
| xs | 4px | `p-1` / `gap-1` | Icon-to-label gap inside printing-strip buttons; vertical gap inside stacked meta rows |
| sm | 8px | `p-2` / `gap-2` | Panel header internal gaps; search-row horizontal padding; printing-strip inter-icon gap |
| md | 16px | `p-4` / `gap-4` | Panel-section vertical rhythm (search → preview → printing strip → qty → foil → category → CTAs); thumbnail-to-name gap in dropdown rows |
| lg | 24px | `p-6` / `gap-6` | Panel outer padding (top/left/right/bottom); precon-browser section padding; modal inner padding |
| xl | 32px | `p-8` / `gap-8` | Precon-browser product-grid row gap; horizontal gap between product-grid and decklist preview columns |
| 2xl | 48px | `p-12` | Precon-browser empty-state vertical padding |
| 3xl | 64px | `p-16` | Not used in this phase |

**Layout constants (derived, not in `@theme`):**

| Constant | Value | Rationale |
|----------|-------|-----------|
| LHS panel width | **360px fixed** | D-02 — thumbnail + name + price + printing strip + controls without cramping. Leaves ≥1200px for grid on 1600px desktop. |
| Dropdown thumbnail | **40px tall** × ~28.6px wide | D-19 — 0.7:1 card aspect ratio. |
| Dropdown row height | **56px** (40 thumb + 8 top + 8 bottom) | D-19 — 16px total vertical padding. |
| Dropdown max-height | **280px** (5 rows) | Existing from add-card-modal.js; preserved. |
| Selected-card image | **96px tall** × ~68.6px wide | Larger than dropdown thumb to anchor the panel visually; 1.4× dropdown thumb (next stop on 8pt scale after 64). |
| Printing-icon button | **32px × 32px** hit target, 16px glyph centred | `gap-2` (8px) between icons; wraps to multiple rows within 360px (≥9 icons/row). |
| Precon product tile | **240px wide × 336px tall** | 240 = 60× 4pt (matches MTG card aspect 0.7:1 = 240×343, rounded to 8pt grid). Grid flows `repeat(auto-fill, minmax(240px, 1fr))`. |
| Precon decklist row | **56px tall** | Matches dropdown row — one pattern for "card row with thumb". |
| Panel/drawer enter/exit | **200ms ease-out** | Matches Phase 7 sidebar collapse (D-29 suggestion). |
| X close button (mass entry) | **32px × 32px** hit target, 20px `close` glyph | Matches panel chevron + all icon-only buttons in app. |

Exceptions: none. All values reduce to multiples of 4.

---

## Typography

Four-role scale. Sizes and weights map 1:1 to existing app conventions (visible in `add-card-modal.js` — reused, not redefined).

| Role | Size | Weight | Line Height | Family | Letter spacing | Case | Usage in Phase 8 |
|------|------|--------|-------------|--------|----------------|------|------------------|
| Display | 48px | 700 | 1.1 | Syne | 0 | normal | **Not used in this phase** (reserved for screen hero titles — e.g. `TREASURE CRUISE` already rendered elsewhere) |
| Heading | 20px | 700 | 1.2 | Syne | 0.01em | UPPERCASE | Panel heading (`ADD TO COLLECTION`); precon browser heading (`BROWSE PRECONS`); decklist preview heading (`{PRECON NAME}`) |
| Body | 14px | 400 (regular) or 700 (bold names) | 1.5 | Space Grotesk | 0 | normal | Selected-card name (700); precon tile name (700); decklist row card name (400); empty-state body copy (400) |
| Label | 11px | 700 | 1.2 | JetBrains Mono | 0.15em | UPPERCASE | Every CTA (`ADD CARD`, `BROWSE PRECONS`, `ADD ALL N CARDS`, `REFRESH`, `CLOSE`); QTY/FOIL/CATEGORY field labels; price strings; set codes; collector numbers |

**Two weights only: 400 and 700.** No medium, no semibold. If a surface "needs more emphasis", upgrade to 700 or use colour — never introduce 500/600.

**Font loading:** all four variable fonts already declared in `main.css` `@font-face`. No new font assets this phase.

---

## Color

Neo-Occult Terminal 60/30/10 split, already established in `@theme`.

| Role | Token | Value | Tailwind utility | Usage |
|------|-------|-------|------------------|-------|
| Dominant (60%) | `--color-background` | `#0B0C10` | `bg-background` | App body, panel inset backgrounds (search input, QTY field), printing-icon button inactive background |
| Dominant (60%) | `--color-surface` | `#14161C` | `bg-surface` | LHS panel surface, precon browser surface, decklist preview surface, mass-entry terminal surface, dropdown surface |
| Secondary (30%) | `--color-surface-hover` | `#1C1F28` | `bg-surface-hover` | Dropdown row hover, precon tile hover, printing-icon button hover, secondary/close CTA button background |
| Secondary (30%) | `--color-border-ghost` | `#2A2D3A` | `border-border-ghost` | Every 1px border — panel edge, inputs, dropdown, precon tiles, decklist rows |
| Secondary (30%) | `--color-text-primary` | `#EAECEE` | `text-text-primary` | Card names, body copy, CTA text |
| Secondary (30%) | `--color-text-muted` | `#7A8498` | `text-text-muted` | Field labels (`QTY`, `FOIL`), helper text, secondary meta (collector number, rarity) |
| Secondary (30%) | `--color-text-dim` | `#4A5064` | `text-text-dim` | Inactive printing-icon glyphs, set-code glyphs in dropdown rows, disabled CTA text |
| **Accent (10%)** — Izzet blue | `--color-primary` | `#0D52BD` | `bg-primary` / `text-primary` / `border-primary` | **Primary CTA backgrounds only** (`ADD CARD`, `ADD ALL N CARDS`); active input focus border; selected printing-icon active state (border + glyph colour); price string colour; selected decklist row left edge (2px) |
| **Accent (10%)** — Izzet red | `--color-secondary` | `#E23838` | `bg-secondary` / `text-secondary` | **Destructive only** — mass-entry X close hover; panel-close chevron hover; precon browser close-X hover; hover-outline on precon tiles (card-tile-hover utility, already live); price-drop text if surfaced |
| Success | `--color-success` | `#2ECC71` | `text-success` | Not used in this phase |
| Warning | `--color-warning` | `#F39C12` | `text-warning` | Not used in this phase |
| Glow (blue) | `--color-glow-blue` | `rgba(13,82,189,0.3)` | `shadow-[0_0_12px_var(--color-glow-blue)]` | Active printing-icon button outer glow (12px blur) |
| Glow (red) | `--color-glow-red` | `rgba(226,56,56,0.25)` | `shadow-[0_0_12px_var(--color-glow-red)]` | X-close hover outer glow |

**Accent reserved for:**

- `#0D52BD` (blue) is reserved for:
  1. The primary "commit" CTA background (`ADD CARD` in the panel, `ADD ALL N CARDS` in the precon browser)
  2. The currently-selected printing icon in the printing strip (border + glyph)
  3. Live GBP price strings (`£2.40`, inherits from existing pattern)
  4. Active focus-within border on the search input
  5. The 2px left edge on the currently-hovered decklist row (precon browser preview pane)
- `#E23838` (red) is reserved for:
  1. Destructive / dismiss icon-button hover states only (X close on mass entry; chevron close on LHS panel; X close on precon browser)
  2. `card-tile-hover` outline (already live from Phase 7 POLISH-02 — applies to precon tiles + dropdown rows via the existing utility; do **not** add a separate red treatment)
  3. Batch-discard confirmation dialog accent (if surfaced — the existing `confirm()` call at mass-entry-panel.js:82 stays)

**Never use accent for:**
- Field labels (stay `text-muted`)
- Panel borders (stay `border-border-ghost`)
- Thumbnail frames (stay `cf-card-img` rounded, no border colour change)
- Decklist row text (stays `text-primary`)
- Set-icon default glyph colour in dropdown (stays `text-text-dim`)
- Close / cancel / secondary CTA backgrounds (stay `bg-surface-hover` with `border-border-ghost`)

Distribution audit — after Phase 8 ships, the Treasure Cruise screen should be roughly 60% `#0B0C10` + `#14161C` (background + surface), 30% border-ghost + text-muted + surface-hover (frames, labels, dropdown hover), 10% `#0D52BD` (primary CTA, active printing, prices) + sprinkled `#E23838` (hover accents, card-tile-hover outlines).

---

## Component Anatomy

### 1. LHS Add Panel (`src/components/add-card-panel.js`) — COLLECT-06 + COLLECT-04

```
┌─ 360px fixed width ────────────────────┐
│ 24px padding                           │
│ ┌──────────────────────────────────┐   │
│ │ ADD TO COLLECTION            [‹] │   │ ← heading row: Syne 20/700, chevron 32×32 icon button
│ │ [BROWSE PRECONS]     [⋯ overflow]│   │ ← action row: label 11/mono, overflow = MASS ENTRY / CSV IMPORT
│ ├──────────────────────────────────┤   │   (16px gap between header rows)
│ │ SEARCH CARD NAME…                │   │ ← 312px × 32px input, JetBrains Mono 11/700
│ │ ├─ dropdown ─────────────────┤   │   │
│ │ │ [thumb] Lightning Bolt {ss}│   │   │ ← 56px row; thumb 40×28; name 14/700/Space Grotesk
│ │ │ [thumb] Lightning Helix    │   │   │
│ │ └─────────────────────────────┘   │   │
│ ├──────────────────────────────────┤   │
│ │ [img 96×69]  LIGHTNING BOLT      │   │ ← Selected card preview: image left, meta right
│ │              £2.40               │   │   name 14/700; price 11/mono/primary
│ │              LEA · 001 · R       │   │   identity row 11/mono/text-muted
│ ├──────────────────────────────────┤   │
│ │ PRINTINGS                         │   │ ← 11/mono/text-muted label
│ │ [●][○][○][○][○][○]                │   │ ← 32×32 keyrune buttons, wraps on overflow
│ │ [○][○][○][○][○][○]                │   │   active = bg-primary + glow-blue
│ ├──────────────────────────────────┤   │
│ │ QTY  [   1   ]                    │   │ ← label + 80×32 number input
│ │ ☐ FOIL                             │   │
│ │ CATEGORY  ○ OWNED  ○ WISHLIST      │   │
│ ├──────────────────────────────────┤   │
│ │ [       ADD CARD       ][ CLOSE ] │   │ ← primary (flex:1, bg-primary) + secondary (flex:1, bg-surface-hover)
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**State machine (unchanged from existing add-card-modal.js, lines 16-97):** `searchQuery, searchResults, selectedCard, quantity, foil, category, searching, _debounce, _searchId` plus **new**: `printings: []`, `printingsLoading: false`, `activePrintingId: null`.

**States:**

| State | Visible surfaces | Notes |
|-------|------------------|-------|
| `idle` (no query) | Heading, action row, empty search input, QTY/FOIL/CATEGORY disabled, CTAs disabled | Mila empty-state line (see Copywriting) below search input when no selectedCard AND searchQuery is empty |
| `searching` (query ≥ 2 chars, debounce in flight) | Dropdown shows skeleton rows (3 rows of pulsing `bg-surface-hover`, 40px thumb placeholder) | Reuses Tailwind `animate-pulse` (built-in). Debounce 50ms already established. |
| `results` | Dropdown visible, up to 8 rows with thumbnail + name + set icon (D-20) | Row hover = `bg-surface-hover`. Keyboard nav: `ArrowDown/ArrowUp` + `Enter` (Claude's discretion during planning — recommended). |
| `no-results` | Dropdown shows single row "NO CARDS MATCH {QUERY}" in `text-muted`, 11/mono | Same 56px row height as results. |
| `selected` (selectedCard set) | Preview panel + printing strip + controls all enabled | Printing strip renders after `loadPrintings(selectedCard)` resolves — show 32×32 skeletons inline until then. |
| `printings-loading` | Printings strip renders 6 `bg-surface-hover animate-pulse` squares (32×32) | Max 1s before scryfall queue resolves; show skeleton to avoid layout jump. |
| `adding` (post addCard click, optimistic) | `ADD CARD` button shows spinning Material Symbols `progress_activity`, disabled | <150ms usually; reuse existing `addCard()` |
| `added` (toast fires) | Toast top-right (existing pattern); **panel state resets** (selectedCard = null, quantity = 1, foil = false); **panel STAYS OPEN** (D-01) | Search input auto-focuses — primary rapid-entry gesture |
| `panel-closed` | Panel element `display: none` via `x-show`; grid column reflows to full width; re-open affordance (32×32 icon button with `chevron_right` glyph, `bg-surface` + `border-border-ghost`, top-left of grid) renders | Transition: panel slides out -360px over 200ms ease-out; grid width transitions concurrently. |

**Close chevron `‹`** — 32×32 icon button, Material Symbols `chevron_left` at 20px glyph, `text-muted` default, `text-secondary` on hover with `shadow-[0_0_8px_var(--color-glow-red)]`. Clicking persists `tc_panel_open: false` to `localStorage` (D-28).

### 2. Printing Strip (inlined in panel, D-13..D-18)

Below the selected-card preview; 16px gap above, 16px gap below.

```
PRINTINGS                                  (11/mono/text-muted label)
┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐     (32×32 square buttons, 8px gap, wraps)
│ss││ss││ss││ss││ss││ss││ss││ss││ss│     (keyrune glyph 16px centred, text-dim inactive)
└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘
│●││○││○││○│                              (second row, wraps naturally)
```

| State | Background | Border | Glyph colour | Shadow |
|-------|------------|--------|--------------|--------|
| Inactive | `bg-background` (`#0B0C10`) | `border-border-ghost` (1px) | `text-text-dim` (`#4A5064`) | none |
| Hover (inactive) | `bg-surface-hover` | `border-border-ghost` | `text-text-muted` | none |
| Active (selected) | `bg-primary` (`#0D52BD`) | `border-primary` | `#EAECEE` (primary text) | `0 0 12px var(--color-glow-blue)` |
| Focus-visible (keyboard) | inherited state | `border-primary` | inherited | `0 0 0 2px var(--color-primary)` (outline offset 0) |

**Hover tooltip:** native `title="{Set Name} ({YYYY}) · £{price}"` — e.g. `Commander Masters (2023) · £2.40`. No custom tooltip component this phase.

**Sort:** newest paper printing first (D-16). Default-selected = index 0 (D-14). All paper printings visible, no truncation (D-15).

### 3. Precon Browser (`src/components/precon-browser.js`) — COLLECT-02

Full-screen drawer mounted to `document.body`, mirrors `csv-import-modal.js` pattern.

```
┌─ 100vw × 100vh — z-index 9999 ─────────────────────────────┐
│ glass backdrop rgba(0,0,0,0.6)                             │
│                                                             │
│   ┌─ surface panel, 1280px max-width, 90vh, centred ─┐     │
│   │ 24px padding                                       │     │
│   │ BROWSE PRECONS    [REFRESH]              [X close]│     │ ← header row: Syne 20/700 + labels + icon-btn
│   │ ────────────────────────────────────────────────  │     │
│   │ ┌─ VIEW A: tile grid (default) ──────────────┐   │     │
│   │ │ [tile][tile][tile][tile][tile]              │   │     │  240×336 tiles, auto-fill, 24px gap
│   │ │ [tile][tile][tile][tile][tile]              │   │     │  tile: box art + name + set code + release year
│   │ └─────────────────────────────────────────────┘   │     │
│   │                                                    │     │
│   │ ── OR (after tile click) ─────────────────────────│     │
│   │                                                    │     │
│   │ ┌─ VIEW B: decklist preview ─────────────────┐   │     │
│   │ │ [← back]  {PRECON NAME}        [ADD ALL 99]│   │     │  header: back chevron + name + primary CTA
│   │ │ ──────────────────────────────────────────  │   │     │
│   │ │ ┌─ 2-col scroll list ──────────────────┐   │   │     │
│   │ │ │ [thumb] 1× Commander Name ♛          │   │   │     │  56px rows, commander first + ♛ icon
│   │ │ │ [thumb] 1× Sol Ring                   │   │   │     │
│   │ │ │ [thumb] 1× Arcane Signet              │   │   │     │
│   │ │ │ [thumb] 1× …                          │   │   │     │
│   │ │ └──────────────────────────────────────┘   │   │     │
│   │ └──────────────────────────────────────────────┘   │     │
│   └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**Tile anatomy (240×336):**

```
┌─ border-border-ghost, bg-surface ─────┐
│ [Scryfall product image, 240×336*]    │  * image aspect locked to card ratio; grow/crop as needed
│                                       │
│                                       │
│                                       │
│ ─ overlay strip, bottom ────────────  │
│ COMMANDER MASTERS                     │  Syne 14/700, 1 line, truncate
│ CMM · 2023                            │  JetBrains Mono 11/700/text-muted
└───────────────────────────────────────┘
```

Hover (via existing `card-tile-hover` utility): `#E23838` 2px outline + subtle lift (via box-shadow). Already live in `main.css`. Do not re-implement.

**Product sort:** `released_at` DESC, tiebreak `name` ASC (D-12).

**Set-type badge:** top-left corner of tile, 11/mono/bg-surface-hover/text-muted, `COMMANDER` or `DUEL DECK` — visible so the user knows which class of product they're looking at.

**Decklist row anatomy (56px, matches dropdown row):**

```
┌─ 56px row, border-bottom border-border-ghost ──┐
│ [thumb 40×29]  1×  Atraxa, Praetors' Voice  ♛ │  thumb | qty (11/mono/text-muted) | name (14/700)
│                                                 │  ♛ = Material Symbols crown icon, text-primary, right-aligned, shown when is_commander
└─────────────────────────────────────────────────┘
```

Commander rows render first in the list (sorted by `is_commander` DESC, then by name ASC). Hover: `bg-surface-hover` + 2px `border-primary` left edge.

**States:**

| State | Visible | Notes |
|-------|---------|-------|
| `loading` | Full-screen skeleton: 10× tile-shaped `bg-surface-hover animate-pulse` at 240×336, 24px gap | While `loadPrecons()` resolves first-time |
| `loaded` | Tile grid (VIEW A) | Default |
| `selected` | VIEW B decklist preview | From tile click |
| `adding-batch` | `ADD ALL {N} CARDS` button disabled + spinner glyph (`progress_activity`); rows un-interactive | <2s typically |
| `added` | Toast fires `Added {N} cards from {Precon Name} to collection.`; browser **closes** back to Treasure Cruise (panel still open) | D-08 |
| `empty` (no precons returned — shouldn't happen) | Centred `text-muted` message "No precon products available. Try REFRESH." | Rare; needs fallback |
| `error` (fetch fail AND no cache) | Centred `text-secondary` message + `TRY AGAIN` button | Reuses Phase 7 migration-blocked pattern for tone |

**Close interactions:** X icon button in header (32×32, chevron_right hover → secondary red), `Escape` key, clicking backdrop — all three acceptable (D-implicit from csv-import pattern).

### 4. Dropdown Thumbnail (COLLECT-03, D-19..D-21)

Replaces the current name-only row in `add-card-panel.js` search dropdown:

```
┌─ 56px row, hover bg-surface-hover ───────────────────┐
│  [img 40×29]    Lightning Bolt              {ss-lea} │
│  cf-card-img    14/700/Space Grotesk/text-primary    │  set icon: 14px/text-text-dim
│  (flex-shrink)  (flex:1, truncate)                   │
└───────────────────────────────────────────────────────┘
```

Image source: `card.image_uris.small` (already in bulk cards). Class: `cf-card-img` (Phase 7 POLISH-04 — rounded corners percentage-based). `loading="lazy"`, `onerror="this.style.display='none'"` fallback.

**No mana cost** (COLLECT-01 audit — D-22). Current implementation is already compliant; confirm in Plan 1 audit, do not reintroduce.

### 5. Mass Entry X Close (COLLECT-05, D-23)

Adds a 32×32 icon button to the right of the `MASS ENTRY TERMINAL` heading row in `mass-entry-panel.js:99-100`:

```
┌─ header row, flex justify-between ──────────────────┐
│  MASS ENTRY TERMINAL                            [X] │
│  Syne 20/700/text-primary                    32×32 │
└──────────────────────────────────────────────────────┘
```

- Glyph: Material Symbols `close`, 20px centred
- Default: `text-text-muted`, `bg-transparent`
- Hover: `text-text-primary`, `bg-surface-hover`
- Active press: `text-secondary` (red feedback for destructive dismiss)
- Focus-visible: 2px `outline-primary`
- Click: fires existing `discard()` method (line 80) — preserves the existing `confirm()` guard for unparsed entries

---

## Interaction & Motion

| Surface | Transition | Duration | Easing |
|---------|------------|----------|--------|
| Panel open/close (slide) | `transform: translateX(-360px → 0)` + grid `margin-left: 360px → 0` | 200ms | ease-out |
| Panel re-open affordance fade | `opacity: 0 → 1` | 150ms | ease-out |
| Dropdown appear | `opacity: 0 → 1`, `translateY(-4px → 0)` | 120ms | ease-out |
| Printing icon active swap | `background-color` + `box-shadow` | 150ms | ease-out |
| Precon browser drawer | `opacity: 0 → 1` backdrop, `scale(0.98 → 1)` panel | 180ms | ease-out |
| Precon tile hover | `box-shadow` (via existing `card-tile-hover`) | 150ms | ease-out (already declared) |
| X close / chevron hover glow | `box-shadow` | 120ms | ease-out |

**Reduced motion:** honour `@media (prefers-reduced-motion: reduce)` by setting all durations to 0.01ms. Apply once in `main.css` near the existing `cf-pulse` keyframe block.

**Keyboard shortcuts (Claude's discretion — recommended defaults):**

- `/` while Treasure Cruise is active AND panel is open: focus the panel search input
- `Escape` while in the panel's search input: clear results + query (does NOT close the panel)
- `Escape` while the precon browser is open: close the browser
- `Escape` while nothing focused inside Treasure Cruise: no-op (the panel is persistent — do not close on Escape)

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Panel heading | `ADD TO COLLECTION` |
| Panel search placeholder | `SEARCH CARD NAME…` |
| Panel browse-precons CTA | `BROWSE PRECONS` |
| Panel overflow menu (if used per D-27) | `MASS ENTRY` / `CSV IMPORT` |
| Panel primary CTA | `ADD CARD` |
| Panel secondary CTA | `CLOSE PANEL` (keeps the existing v1.0 copy; differentiates from the chevron affordance) |
| Panel chevron tooltip | `Collapse panel` |
| Panel re-open affordance tooltip | `Open add panel` |
| Panel empty state (no card selected) | Heading: `READY TO ARCHIVE` · Body: `Search for a card, or browse a precon to add one hundred at once.` (Mila-flavoured; sets expectation for both flows) |
| Panel no-results | `NO CARDS MATCH "{QUERY}"` |
| Panel PRINTINGS label | `PRINTINGS` |
| Panel printings-loading shimmer caption | *(none — skeleton only)* |
| Panel QTY label | `QTY` |
| Panel FOIL label | `FOIL` |
| Panel CATEGORY label | `CATEGORY` / options `OWNED` / `WISHLIST` |
| Primary CTA disabled tooltip | `Select a card first` |
| Add-success toast (owned) | `{Card name} added to collection.` |
| Add-success toast (wishlist) | `{Card name} added to wishlist.` (POLISH-11 wording preserved) |
| Precon browser heading | `BROWSE PRECONS` |
| Precon browser refresh CTA | `REFRESH` |
| Precon browser close tooltip | `Close precon browser` |
| Precon tile set-type badge | `COMMANDER` or `DUEL DECK` |
| Precon empty state (no products — rare) | Heading: `NO PRECONS AVAILABLE` · Body: `Scryfall didn't return any commander or duel-deck products. Try refreshing.` · CTA: `REFRESH` |
| Precon error state (fetch fail + no cache) | Heading: `COULDN'T LOAD PRECONS` · Body: `Check your connection and try again.` · CTA: `TRY AGAIN` |
| Precon decklist preview back CTA | `← BACK TO PRECONS` |
| Precon decklist preview heading | `{PRECON NAME}` (upper-cased) |
| Precon decklist preview commander badge tooltip | `Commander` |
| Precon "add all" primary CTA | `ADD ALL {N} CARDS` (pluralises: `ADD COMMANDER + 99 CARDS` stays as `ADD ALL 100 CARDS`; no singular path since precons always have ≥50 cards) |
| Precon add-all progress (if surfaced) | `Adding {N} cards…` (11/mono, inside disabled CTA) |
| Precon add-success toast | `Added {N} cards from {Precon Name} to collection.` |
| Precon add-all undo toast action | `UNDO` (existing toast pattern) |
| Precon refresh loading | CTA text becomes `REFRESHING…` during in-flight fetch |
| Mass entry X close tooltip | `Close mass entry` |
| Mass entry X close discard confirm (existing) | `Discard {N} unparsed entries?` (preserved, not changed this phase) |
| Dropdown no-results row | `NO CARDS MATCH "{QUERY}"` |
| Dropdown thumbnail load failure | image hides; row collapses to name-only (graceful fallback) |

**Voice rules (inherit from project):**

- UPPERCASE + JetBrains Mono for terminal actions and labels (keeps Neo-Occult Terminal identity intact)
- Sentence-case for toast body copy (conversational confirmation, not shouted)
- Numbers rendered as digits (`100`, not `one hundred`) in every CTA
- Prices always in GBP with `£` prefix, no decimal rounding ("£2.40" not "£2.4"; two decimals always)

**Destructive actions in this phase:**

| Action | Confirmation approach |
|--------|----------------------|
| Mass entry X close with unparsed entries | `window.confirm("Discard {N} unparsed entries?")` (existing; preserved) |
| Panel close (chevron) | No confirmation — state is non-destructive (nothing unsaved; re-open restores default-open flag = true on next mount) |
| Precon browser close | No confirmation — no destructive change held in preview state |
| Precon add-all (100 cards committed) | **Preview is the confirmation.** The decklist must be viewed before the `ADD ALL` button is reachable (D-10). Undo toast covers accidental fires. |

---

## Accessibility

| Dimension | Contract |
|-----------|----------|
| Colour contrast | All text meets WCAG AA: `#EAECEE` on `#14161C` (15.7:1), `#7A8498` on `#14161C` (4.6:1 — AA body), `#4A5064` on `#14161C` (2.7:1 — AA large only; used only on 11px set codes which are decorative). Primary CTA white on `#0D52BD` = 7.0:1. |
| Keyboard navigation | Every interactive surface reachable via `Tab`. Search input → dropdown rows (`ArrowDown`/`Up` + `Enter`) → selected-card preview (not focusable) → printing icons (tab-stop per icon; `Enter` / `Space` activates) → QTY → FOIL → CATEGORY radios → ADD CARD → CLOSE PANEL → chevron. |
| Focus ring | 2px `outline: var(--color-primary) solid` with `outline-offset: 2px` on every focusable element. Never suppress. |
| Screen reader labels | Chevron close: `aria-label="Collapse add panel"`. X close (precon + mass entry): `aria-label="Close {surface}"`. Printing icons: `aria-label="{Set Name} printing, {YYYY}"` + `aria-pressed="{true if active}"`. Dropdown rows: render as `<button>` with `aria-label="{Card name}, {set code}"`. |
| ARIA live regions | Toast container (existing) stays `aria-live="polite"`. The printings-loading skeleton should NOT be announced (decorative). |
| Focus restoration | Precon browser opens: focus lands on the first tile. Browser closes: focus returns to the `BROWSE PRECONS` button in the panel header. Panel re-opens from collapsed: focus lands on the search input. |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` forces all Phase 8 transitions to 0.01ms. |

---

## Empty States

| Surface | State | Heading | Body | CTA |
|---------|-------|---------|------|-----|
| Panel (idle, no card selected) | Empty | `READY TO ARCHIVE` | `Search for a card, or browse a precon to add one hundred at once.` | (none — in-situ affordances are enough) |
| Panel (search, no results) | No match | *(inline in dropdown)* `NO CARDS MATCH "{QUERY}"` | *(none)* | *(none)* |
| Precon browser (no products — rare) | Empty | `NO PRECONS AVAILABLE` | `Scryfall didn't return any commander or duel-deck products. Try refreshing.` | `REFRESH` |
| Precon decklist (selected product has zero cards — data bug guard) | Empty | `DECKLIST UNAVAILABLE` | `This precon has no cards on Scryfall yet. Try another product.` | `← BACK TO PRECONS` |

---

## Error States

| Surface | Trigger | Heading | Body | CTA |
|---------|---------|---------|------|-----|
| Precon browser | Fetch failed, no cached fallback | `COULDN'T LOAD PRECONS` | `Check your connection and try again.` | `TRY AGAIN` |
| Precon decklist | Decklist fetch failed | `DECKLIST LOAD FAILED` | `Something went wrong fetching this decklist. Try another product or refresh.` | `REFRESH` + `← BACK TO PRECONS` |
| Panel printing strip | `prints_search_uri` fetch failed | *(inline, replaces strip)* `Could not load alternative printings.` in 11/mono/text-muted — selected card still adds successfully using its current printing | *(none — silent degradation)* |
| Panel add-card | `addCard` throws | Existing error toast (`$store.toast.error`) — `Could not add {Card name}. Try again.` | *(toast only — button re-enables)* |
| Precon add-all | `addBatch` partial failure | `PARTIAL ADD` toast — `Added {M} of {N} cards. Some failed — check console.` | (undo still inverts whatever landed) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — project does not use shadcn (Alpine.js stack, not React) |
| Third-party | none | not applicable |

Phase 8 ships zero third-party UI registry imports. All new components are authored in `src/components/*.js` as Alpine.js `x-data` x-templates, consistent with the existing v1.0 + Phase 7 codebase.

---

## Component Inventory (files touched)

| File | Disposition | Reason |
|------|-------------|--------|
| `src/components/add-card-modal.js` | **Rename** → `add-card-panel.js`; state machine preserved; chrome swapped (drop backdrop + fixed-center; add LHS column styles) | COLLECT-06 (D-04a) |
| `src/components/add-card-panel.js` | **New** (renamed above) | Panel body |
| `src/components/printing-picker.js` | **New file OR inlined x-template** (Claude's discretion during planning — if ≥80 lines, extract) | COLLECT-04 (D-13..D-18) |
| `src/components/precon-browser.js` | **New** — full-screen drawer, mirror `csv-import-modal.js` mount pattern | COLLECT-02 (D-05..D-12) |
| `src/components/mass-entry-panel.js` | **Edit** — add X close button to header (lines 99-100) | COLLECT-05 (D-23) |
| `src/screens/treasure-cruise.js` | **Edit** — mount wrapper becomes `[LHS panel column | grid column]` flex row; mount precon-browser into `#tc-modals`; re-open affordance top-left of grid | COLLECT-06 |
| `src/stores/collection.js` | **Extend** — new state: `panelOpen`, `preconBrowserOpen`, `selectedPreconCode`, `printingsByCardId`; new methods: `loadPrecons()`, `selectPrecon(code)`, `addAllFromPrecon(code)`, `loadPrintings(cardId)`, `selectPrinting(cardId, printingId)` | COLLECT-02, COLLECT-04, COLLECT-06 |
| `src/services/precons.js` | **New** — mirrors `sets.js` pattern with `precons_cache` Dexie table (7-day TTL) | COLLECT-02 (D-07, D-11) |
| `src/db/schema.js` | **Extend** — append `db.version(9).stores({ precons_cache: 'code, set_type, released_at, updated_at' })` | D-24 |
| `src/workers/bulk-data.worker.js` | **Mirror** — same v9 declaration | D-26 |
| `src/styles/main.css` | **Extend** — add `@media (prefers-reduced-motion: reduce)` block; optionally add `cf-printing-icon` + `cf-panel-column` utility classes if inline styles feel verbose | Phase 8 motion contract |
| `src/styles/utilities.css` | **Optional extend** — housing for `cf-panel-column` / `cf-printing-icon` if extracted | Optional |

**Do NOT touch in this phase:** `src/components/csv-import-modal.js` (stays modal per D-04), `src/components/sidebar.js`, `src/components/topbar.js`, `src/components/toast.js`, `src/stores/search.js`, deck-builder surfaces, game-tracker surfaces.

---

## Visual Regression Anchors

For the executor + auditor: these are the six QA anchors the finished Phase 8 must visibly demonstrate.

1. **Push, don't overlay** — Treasure Cruise grid starts at x = 360px, not x = 0. Resize browser to 1200px wide and confirm the grid still renders without horizontal scroll.
2. **Panel stays open across adds** — Select a card, click `ADD CARD`, toast fires, panel remains visible, search input re-focused, QTY resets to 1.
3. **Printing strip wraps** — Select Lightning Bolt (40+ paper printings); the strip wraps into multiple rows inside 360px; active icon visibly has `bg-primary` + glow.
4. **Precon browser full-screen** — Click `BROWSE PRECONS`; the drawer covers 100vw × 100vh; backdrop dims the Treasure Cruise behind it; X close, Escape, and backdrop click all dismiss.
5. **Precon add-all single toast** — Select a precon, click `ADD ALL N CARDS`; a single toast with the precon name appears (not N individual toasts); collection count increases by exactly N.
6. **Dropdown row thumbnail** — Type "lightning" in the panel search; each dropdown row renders a 40px thumbnail left of the name; no mana cost anywhere in the row; set icon right-aligned.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Generated by gsd-ui-researcher 2026-04-15. Anchored to `src/styles/main.css` `@theme` tokens. All decisions pre-populated from `08-CONTEXT.md` D-01..D-29 + `07-CONTEXT.md` POLISH-02/04/09 utilities — no new user input required.*
