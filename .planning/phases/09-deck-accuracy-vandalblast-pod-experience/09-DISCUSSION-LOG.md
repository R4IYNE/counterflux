# Phase 09 — Discuss-Phase Audit Log

**Date:** 2026-04-16
**Format:** Audit trail of /gsd:discuss-phase Q&A. Not consumed by downstream agents (researcher / planner / executor) — for human review and compliance only.

---

## Q1: Phase shape

**Question:** Phase 9 is 15 requirements across 2 distinct domains (deck-builder + game-tracker). How should we shape it?

**Options presented:**
- Split: 9a + 9b (Recommended) — 9a = DECK-01..05, 9b = GAME-01..10. Cleaner verification, smaller HUMAN-UAT walks.
- One fat phase, 3-4 plans — single goal, single verification, 15-item HUMAN-UAT.
- Defer one half — pick deck-only OR vandalblast-only, push the other to 9.1.

**User selected:** One fat phase, 3-4 plans.

---

## Q2: Areas to deep-dive

**Question:** Which areas to deep-dive before planning? (Multi-select.)

**Options presented:**
- Deck accuracy fixes (DECK-02, DECK-03, DECK-04)
- Vandalblast layout (GAME-02, GAME-04)
- Pod-play visual feel (GAME-07, GAME-08)
- Post-game stats display (GAME-09)

**User selected:** ALL FOUR.

---

## Q3: DECK-02 reference decks (initial)

**Question:** Which 3 decks should serve as the canonical hand-calculated reference for mana curve + colour distribution validation?

**Options presented:**
- I'll name them now
- Use the 3 most-played EDH commanders (Recommended) — fetched from EDHREC during research
- Use 3 of my decks already in Counterflux

**User response:** "explain where the validation lives" — needed clarification before committing.

**Claude clarification:** Explained the validation pipeline (research-time hand-calc → fixtures in `tests/fixtures/decks/` → vitest assertions in `tests/intelligence.test.js` → gsd-verifier confirms). Re-asked.

---

## Q3a: DECK-02 reference decks (re-ask after clarification)

**Question:** Which 3 reference decks for DECK-02 hand-validation? (They'll become test fixtures in tests/fixtures/decks/.)

**Options presented:**
- I'll name 3 decks now
- Researcher picks 3 — mono / 2-colour / 5-colour (Recommended)
- Use 3 of my own decks already in Counterflux

**User selected:** Researcher picks 3 — mono / 2-colour / 5-colour (Recommended).

---

## Q4: DECK-04 salt-score data source

**Question:** Where does the salt-score data come from? (Salt = how 'unfun' a card is reputed to be in EDH meta.)

**Options presented:**
- EDHREC salt API live (Recommended) — via existing edhrec.js service, Vite dev proxy
- Curated static table in src/data/salt-scores.js — ~50-100 cards, zero network
- Both — EDHREC primary, fallback table

**User selected:** EDHREC salt API live (Recommended).

---

## Q5: DECK-03 RAG thresholds

**Question:** Gap warning RAG thresholds — what card-count gaps trigger red / amber / green?

**Options presented:**
- Red >10, Amber 5-10, Green <5 missing (Recommended) — standard EDH heuristic
- Red >5, Amber 3-5, Green <3 missing — stricter, more red badges
- Per-category dynamic — different thresholds per category, derived from EDHREC averages

**User selected:** Per-category dynamic.

---

## Q6: GAME-02 3-player layout

**Question:** How should the 3-player Vandalblast layout arrange the player cards?

**Options presented (with ASCII previews):**
- T-shape: 1 top full-width, 2 bottom side-by-side (Recommended)
- L-shape: 1 left tall, 2 right stacked
- Triangle: 1 top centred, 2 bottom side-by-side

**User selected:** T-shape: 1 top full-width, 2 bottom side-by-side (Recommended).

---

## Q7: GAME-04 counter icons

**Question:** Which icon set for the poison/tax/commander-damage expansion widgets?

**Options presented:**
- Material Symbols (existing) (Recommended) — biotech/science for poison, paid for tax, military_tech/shield_with_heart for commander damage
- Custom MTG-style SVGs — hand-crafted thematic icons, ~30 min design + sprite
- Mix: Material for poison/tax + keyrune-style commander icon

**User selected:** Material Symbols (existing) (Recommended).

---

## Q8: GAME-07 first-player coin-flip

**Question:** First-player coin-flip animation — what's the visual treatment?

**Options presented:**
- Slot-machine spinner (Recommended) — names cycle vertically with deceleration, ~2-3s
- Coin-toss (3D) — animated 3D coin, only works for 2-player
- Cyberpunk scramble — Matrix-style char swapping
- Simple fade-reveal — 'PICKING FIRST PLAYER...' then pulse

**User selected:** Slot-machine spinner (Recommended).

---

## Q9: GAME-08 active-player highlight

**Question:** Active-player highlight — how does the current player visually stand out?

**Options presented:**
- Border-glow + box-shadow (Recommended) — matching cf-panel-reopen treatment from Phase 8.1
- Pulse animation — subtle CSS @keyframes on border, may distract during long turns
- Background tint — subtle surface-colour shift, may not be obvious enough alone
- Border-glow + animated counter ring — highest impact, most code (SVG ring + RAF loop)

**User selected:** Border-glow + box-shadow (Recommended).

---

## Q10: GAME-09 post-game stats display

**Question:** Where should longest-turn / avg-turn / per-player-avg render in post-game-overlay.js?

**Options presented:**
- New 'Turn Pacing' section below winner card (Recommended) — three stat tiles in a row
- Tab inside post-game overlay — adds nav complexity
- Inline with existing player cards — info-dense per player but may overload card layout
- New collapsed-by-default detail panel — keeps overlay clean but hides feature behind interaction

**User selected:** New 'Turn Pacing' section below winner card (Recommended).

---

## Q11: Final check — more or done?

**Question:** We've covered the 4 deep-dive areas. Anything else to discuss before writing CONTEXT.md?

**Options presented:**
- Ready for context (Recommended)
- Explore more gray areas
- Revisit a decision

**User selected:** Ready for context (Recommended).

---

## Summary

| Decision | Outcome |
|----------|---------|
| Phase shape | One fat phase, 3 plans |
| DECK-02 reference decks | Researcher picks 3 (mono/2-colour/5-colour); fixtures in tests/fixtures/decks/ |
| DECK-03 RAG thresholds | Per-category dynamic, researcher derives from EDHREC averages |
| DECK-04 salt source | EDHREC API live via existing edhrec.js service |
| GAME-02 3-player layout | T-shape (1 top full-width + 2 bottom side-by-side) |
| GAME-04 counter icons | Material Symbols (existing) — `science`/`biotech`, `paid`, `shield_with_heart`/`military_tech` |
| GAME-07 coin-flip | Slot-machine spinner (~2-3s, JetBrains Mono primary blue) |
| GAME-08 active player | Border-glow + box-shadow (matching Phase 8.1 cf-panel-reopen) |
| GAME-09 stats display | New 'Turn Pacing' section below winner card, three stat tiles |

**Total questions:** 11 (1 mid-question clarification on Q3 → re-asked as Q3a)
**Scope creep deflected:** None — user stayed within phase boundary.
**Deferred ideas captured:** 4 (mobile Vandalblast polish, new analytics like Pareto/synergy/archetype, bespoke 2-player coin-flip, EDHREC production CORS proxy).
