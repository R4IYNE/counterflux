# Plan 3 Spike: keyrune duel_deck coverage

**Date:** 2026-04-16
**Keyrune version:** 3.18.0 (per package.json)
**Total `.ss-*` classes found:** 432 (via `grep -oE '\.ss-[a-z0-9]+' | sort -u`)
**Duel-deck codes audited:** 20 (dd1, dd2, ddc..ddu per historic Scryfall set codes)
**Duel-deck codes covered:** 19/20
**Missing codes:** dd1

## Detail

All 20 candidate duel-deck codes were checked against `node_modules/keyrune/css/keyrune.css`:

| Code | Keyrune class present? | Notes |
|------|------------------------|-------|
| dd1 | **MISSING** | "Duel Decks: Elves vs. Goblins" actually uses Scryfall code `evg`, not `dd1`. `dd1` is the TCGPlayer code. `evg` IS present in keyrune (verified `.ss-evg:before` exists), so this is a non-issue in practice. |
| dd2 | FOUND | Duel Decks: Jace vs. Chandra |
| ddc | FOUND | Duel Decks: Divine vs. Demonic |
| ddd | FOUND | Duel Decks: Garruk vs. Liliana |
| dde | FOUND | Duel Decks: Phyrexia vs. The Coalition |
| ddf | FOUND | Duel Decks: Elspeth vs. Tezzeret |
| ddg | FOUND | Duel Decks: Knights vs. Dragons |
| ddh | FOUND | Duel Decks: Ajani vs. Nicol Bolas |
| ddi | FOUND | Duel Decks: Venser vs. Koth |
| ddj | FOUND | Duel Decks: Izzet vs. Golgari |
| ddk | FOUND | Duel Decks: Sorin vs. Tibalt |
| ddl | FOUND | Duel Decks: Heroes vs. Monsters |
| ddm | FOUND | Duel Decks: Jace vs. Vraska |
| ddn | FOUND | Duel Decks: Speed vs. Cunning |
| ddo | FOUND | Duel Decks Anthology: Elves vs. Goblins |
| ddp | FOUND | Duel Decks: Zendikar vs. Eldrazi |
| ddq | FOUND | Duel Decks: Blessed vs. Cursed |
| ddr | FOUND | Duel Decks: Nissa vs. Ob Nixilis |
| dds | FOUND | Duel Decks: Mind vs. Might |
| ddt | FOUND | Duel Decks: Merfolk vs. Goblins |
| ddu | FOUND | Duel Decks: Elves vs. Inventors |

All 20 `dd*` codes queried resolve in keyrune 3.18.0 **except `dd1`**, which was never a real Scryfall code for any released set. The Scryfall code for "Duel Decks: Elves vs. Goblins" (released 2007) is `evg`, which IS covered by keyrune (`.ss-evg:before` exists).

## Recommendation

**Ship the `.ss-fallback` rule in Task 6 anyway.**

Rationale:
1. Although every currently-released duel_deck code is covered, keyrune is a third-party font with release cadence independent of Scryfall. When a NEW set drops (e.g., Commander 2026), there's a window — possibly weeks — during which keyrune has no glyph for that code.
2. The precon browser iterates every precon Scryfall returns, so any new-release code will surface as a blank tile until keyrune updates. A `?` fallback prevents users seeing blank squares for new sets.
3. Same argument applies to the printing strip (Plan 2) — any future expansion code missing from keyrune would render blank. Defence-in-depth across both surfaces.

The rule is decorative today (no missing glyphs for current duel_deck codes) but load-bearing for future set releases. Implementation:

```css
/* Phase 8 Plan 3 — keyrune fallback for missing set glyphs (Pitfall 4) */
.ss.ss-fallback::before {
  content: '?';
}
```

The rule only activates when the keyrune CSS for `.ss-<code>` doesn't override `::before content`. Real keyrune icons set their own `::before { content: ... }`, which wins via CSS cascade.

## Conclusion

Coverage is effectively 100% for currently-released duel-deck codes. The `.ss-fallback` rule ships as insurance against future set releases. Task 6 applies the class to both precon tiles and printing strip icons.
