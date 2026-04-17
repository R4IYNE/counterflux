# GAME-04 Material Symbols Icon Confirmation

**Plan:** 09-02 Task 4
**Purpose:** Visual UAT artefact for the three counter glyphs introduced by GAME-04.
**Pin:** `material-symbols@0.44.0` (per `package.json`, RESEARCH §4)

This is a deferred-screenshot placeholder. Per Plan 09-02 Task 4 acceptance criteria:
> If a screenshot tool isn't readily available, ASCII-art a description in
> `tests/fixtures/screenshots/game-04-icons.png.md` instead — the artefact's role
> is human-UAT proof, so a textual placeholder noting which glyphs rendered
> correctly is acceptable for v1.1.

A real PNG capture should be taken during the Phase 09 HUMAN-UAT walk per
CONTEXT D-00 ("single HUMAN-UAT walk covering all 15 requirements at the end").

## Glyphs to Confirm

The expanded player card in Vandalblast contains three rows that received
Material Symbols Outlined glyphs in `src/components/player-card.js`. The
font ships as a single variable woff2 with the `liga` feature on, so any
valid icon name written as text content renders as the icon.

### Row 1 — Poison

```
┌──────────────────────────────────────────────────┐
│  [vaccines glyph 16px]  POISON         [-]  0  [+] │
└──────────────────────────────────────────────────┘
```

- **Glyph:** `vaccines` (clean lab vial outline, lighter visual weight than `science`)
- **Source:** `src/components/player-card.js` line ~239 (`>vaccines<`)
- **Fallback if rendered as tofu (□):** swap to `science` (atom-cluster)

### Row 2 — Tax

```
┌──────────────────────────────────────────────────┐
│  [paid glyph 16px]  TAX: 0 (0)        [-]    [+]   │
└──────────────────────────────────────────────────┘
```

- **Glyph:** `paid` (currency-pile, semantically aligned with "paying" the commander tax)
- **Source:** `src/components/player-card.js` line ~268 (`>paid<`)
- **Fallback if tofu:** swap to `payments` (multi-card stack)

### Row 3 — Commander Damage (in expanded section)

```
┌──────────────────────────────────────────────────┐
│  [shield_with_heart 16px]  COMMANDER DAMAGE        │
│  ────────────────────────────────────────────────  │
│  Niv-Mizzet                          [-]  0  [+]   │
└──────────────────────────────────────────────────┘
```

- **Glyph:** `shield_with_heart` (commander = leader / heart of the deck)
- **Source:** `src/components/player-card.js` line ~316 (`>shield_with_heart<`)
- **Fallback if tofu:** swap to `military_tech` (medal)

## Confirmation Procedure (for the Phase 9 HUMAN-UAT walk)

1. `npm run dev`
2. Navigate to Vandalblast (Game Tracker)
3. Start a 2-player game with default life = 40
4. Tap to expand player 2
5. Verify each row shows its expected icon (NOT a tofu □ box)
6. Capture the screenshot to replace this `.md` placeholder with `game-04-icons.png`

## Status

- **Glyph names locked in source:** `vaccines` / `paid` / `shield_with_heart`
- **Test contract:** `tests/player-card.test.js` asserts each glyph name is
  rendered inside a `material-symbols-outlined` span — the rendering itself
  requires the font to be loaded (browser, not jsdom)
- **Visual capture:** deferred to Phase 9 HUMAN-UAT walk

If any fallback is needed, update the corresponding glyph name in
`src/components/player-card.js` AND record the swap in `09-02-SUMMARY.md`
under "Material Symbols glyph picks confirmed (or fallback used)".
