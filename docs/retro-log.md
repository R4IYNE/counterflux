# Retro log

One line per landed session. `/retro` harvests these at milestones.

2026-07-08 | build-gate fix | deck-builder (thousand-year) screen chunk was 4.2 KB gz over its 42 KB budget on deployed HEAD since v1.3, so build:check had been red for ~6 weeks. Root cause: v1.3 statically imported the whole editor subtree (three-panel + deckgen AI) into a screen that first-renders only the landing grid. Fix: dynamic-import the editor in renderEditor(). Lesson: a newly-split lazy chunk needs a real budget category (component/100 KB), not the loose 500 KB default, or it silently re-drifts. | candidate: the v1.3 build should have caught this — /land now runs build:check, which is what surfaced it this cycle.
