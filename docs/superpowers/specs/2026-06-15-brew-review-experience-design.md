# Brew Review Experience — Design Spec

- **Date:** 2026-06-15
- **Status:** Draft for review
- **Owner:** James Arnall
- **Area:** v1.3 "Brew with the Familiar" — deckgen review surface
- **Roadmap item:** punch-list #2 (brew-existing-deck experience)

## 1. Context & Problem

The "Brew" flow generates a Commander deck (or swaps) via a streaming Anthropic
call and then lets the user accept/reject the AI's picks. Today:

- During generation (`$store.deckgen.status === 'brewing'`) the brew modal shows
  only a **ticking card counter** — `api/deckgen.js` `emitProgress` counts
  `"scryfall_id"` occurrences in the accumulating JSON and emits
  `{type:'progress', cards:<count>}`. The actual cards arrive **only** in the
  final `{type:'done'}` payload.
- The review screen (`src/components/deckgen-review-screen.js`) renders **once**
  `status === 'reviewing'` — i.e. after the whole brew finishes. So when filling
  an existing deck (e.g. 27/99) you watch a number climb and see nothing until
  all cards land, then the post-brew list has a scroll bug (can't scroll/accept
  past the first block).
- Every recommended card is a flat tile with an Add/Skip button. No card-detail
  view, no per-card swipe, and no signal that a pick is a known synergy or combo
  piece — even though that data exists in the `intelligence` store.

### Goals

1. **Reveal cards live** as the brew streams them, not at the end.
2. **Per-card accept/reject** that fits the mode: a focused card-stack for the
   few-swap retune/upgrade flows, a streaming list for bulk build/fill.
3. **Tap a card → full detail.**
4. **Fold the rail's synergy/combo cards into the recommendations** and tag every
   matching pick with a synergy/combo icon (matching the deck view).
5. Fix the review-screen scroll bug.

### Non-goals

- No change to deck/card data model, the sync engine, or Supabase schema.
- No change to the brew **setup** modal (commander/power/mode selection) beyond
  what's needed to hand off into the new review.
- Unified add/in-deck filtering (#7) and the home animation (#4) are separate.

## 2. Decisions (locked in brainstorming)

- **Adaptive review:** card-stack for `retune`/`upgrade` (`isSwapMode`), streaming
  list for `build`/`fill`.
- **Synergy/combo (#2d):** NOT a new panel. Merge the commander's EDHREC
  synergies + Spellbook "almost-included" combo pieces into the recommendation
  set (when the brew missed them) and tag matching cards with icons.
- **Enrichment is client-side** (merge from the live `intelligence` store), with
  a server-side path left as a future option.
- **Card detail** reuses the existing `card-flyout` event/component.

## 3. Design

### 3.1 Live streaming (server + client)

**Server — `api/deckgen.js`:** replace the count-only `emitProgress` with
incremental card emission. The accumulated buffer is a growing JSON document
with a `recommended: [...]` array; parse out **completed** card objects (those
whose `{...}` has closed) and emit one event per newly-completed card:

```
writeEvent(res, { type: 'card', card: { scryfall_id, role, reasoning } })
```

Keep emitting `{type:'progress', cards}` (count) for back-compat and the
generation footer. The final `{type:'done'}` still carries the authoritative
full list (used to reconcile any cards missed by incremental parsing).

**Client — `src/services/deckgen.js` (`readNdjsonStream`):** add a `card` event
branch and a new `onCard(card)` callback alongside the existing `onProgress`
(count). On `done`, reconcile: any card in the final list not already streamed is
appended (covers parser edge cases).

**Client — `src/stores/deckgen.js` (`startBrew`):**
- Pass `onCard` that **appends** to `this.recommendations` (default `approved:
  true`), de-duped by `scryfall_id`.
- Flip to the review surface on the **first** streamed card. Introduce a
  `streamComplete` boolean (false while streaming, true on `done`/error).
- On `done`, reconcile the full list and set `streamComplete = true`.

State: keep `status` (`idle|brewing|reviewing|committing|error`). The review
surface shows while `status === 'brewing' && recommendations.length > 0` OR
`status === 'reviewing'`. Commit stays **disabled until `streamComplete`** — the
user can accept/reject as cards arrive, but the deck write happens once.

### 3.2 Adaptive review UI — rewrite `deckgen-review-screen.js`

Shared shell (header with counts + Approve/Reject All + Discard + Commit, a
"brewing… N so far" footer while `!streamComplete`). Body switches on mode:

**Streaming list (`build`/`fill`)**
- Cards grouped by role (`groupedByRole`), appearing as they stream.
- Each row: thumbnail, name, role, reasoning, synergy/combo icon (3.3), Add/Skip
  (default approved). On touch, swipe-left = skip. Tap (not on a button) = detail.
- **Scroll fix:** the scroll container needs `min-height: 0` on the flex chain so
  `overflow-y: auto` actually scrolls (the current bug — a flex child without
  `min-height:0` refuses to shrink, so only the first block is reachable).

**Card-stack (`retune`/`upgrade`)**
- One card at a time, large art, OUT→IN swap context (reuse current swap-pair
  data), reasoning, synergy/combo icon.
- Swipe-right / `→` = apply, swipe-left / `←` = skip, tap = detail. Counter
  "n / total". Advancing past the last card lands on the commit summary.
- Desktop: arrow keys + on-card Apply/Skip buttons (swipe is touch-only sugar).

Mode detection reuses `isSwapMode`. Commit path is unchanged
(`commitApproved()`), which already writes approved cards atomically with one
undo entry.

### 3.3 Synergy/combo enrichment + tagging (#2d)

Source data already exists in `$store.intelligence`:
- `synergies` — EDHREC synergy cards (pre-filtered to paper-legal printings).
- `combos.almostIncluded` — Spellbook combos where the deck/recs hold some but
  not all pieces.

**Enrichment (client-side):** when the stream completes, compute the set of
synergy/combo cards that are (a) legal adds and (b) not already in the
recommendations or the current deck. Append them to `recommendations` tagged
`source: 'synergy' | 'combo'` (default `approved: false` so they're opt-in
extras, visually separated from the AI's core picks).

**Tagging:** every recommendation that matches a synergy or combo gets an icon.
Combos reuse the deck-view **combo bolt badge** (`combo-badge`,
`intelligence.getComboCount`) verbatim. Synergies get a distinct marker — a small
material-symbol (candidate: `hub` or `linked_services`); the exact glyph is
confirmed against existing deck-view conventions during planning so the two
states read as clearly different. Applies in both list and stack.

### 3.4 Card detail (#2c)

Tap a card (outside an action button) dispatches the existing `card-flyout`
event with the hydrated card object — no new detail component.

## 4. Data flow

```
api/deckgen.js  --(NDJSON: progress|card|done|error)-->  readNdjsonStream
   parse completed card objects from the Anthropic delta buffer
        |
        v  onCard / onProgress / done
src/stores/deckgen.js startBrew
   recommendations[] (append live, de-dupe) + streamComplete
        |  (on done) enrich from $store.intelligence (synergy/combo) + reconcile
        v
deckgen-review-screen.js
   mode === swap ? card-stack : streaming-list
   per-card accept/reject (swipe/keys/buttons) · tap -> card-flyout
        |
        v  commitApproved()  (unchanged) -> deck write + undo entry
```

## 5. Files

**Create**
- (optional) `src/components/brew-review-stack.js` — card-stack body, if
  `deckgen-review-screen.js` grows too large to hold both modes cleanly.

**Modify**
- `api/deckgen.js` — incremental `card` events from `emitProgress`.
- `src/services/deckgen.js` — `readNdjsonStream` `card` branch + `onCard`.
- `src/stores/deckgen.js` — `startBrew` live append, `streamComplete`,
  enrichment merge.
- `src/components/deckgen-review-screen.js` — adaptive list/stack rewrite,
  scroll fix, synergy/combo icons, tap-to-detail.
- `src/components/deckgen-brew-modal.js` — hand off into the review on first card
  (the modal's `BREWING…` state yields to the review surface).

## 6. Error handling & edge cases

- **Mid-stream error** (`{type:'error'}`): keep cards already streamed, surface
  the error in the review footer, allow commit of what arrived (once the user
  has triaged) or discard.
- **Incremental parse gaps:** the `done` reconciliation is the safety net — the
  final list is authoritative; anything missed is appended before commit unlocks.
- **Commit before `streamComplete`:** disabled by design.
- **Intelligence not loaded** (EDHREC/Spellbook cold or failed): enrichment is a
  no-op; the brew still works (graceful per existing `intelligence` degradation).
- **De-dupe:** a synergy/combo card the AI also picked is shown once, tagged.

## 7. Testing (vitest)

- `readNdjsonStream`: emits `card` events from an NDJSON fixture; `onCard` fires
  per card; `done` reconciliation appends missed cards.
- `deckgen` store: `startBrew` appends streamed cards live, de-dupes, flips the
  review surface on first card, sets `streamComplete` on done; enrichment merges
  synergy/combo and tags `source`.
- `deckgen-review-screen`: renders list for build/fill and stack for
  retune/upgrade; default approval; scroll container has `min-height:0`;
  synergy/combo icon renders for tagged recs; tap dispatches `card-flyout`.
- `api/deckgen.js`: `emitProgress` emits a `card` event when a new complete card
  object appears in the buffer (unit-test the buffer-parse helper in isolation).

## 8. Scope & sequencing

1. Server incremental emission + `readNdjsonStream` `card` branch (+ tests).
2. Store live-append + `streamComplete` (+ tests).
3. Streaming-list review body + scroll fix + tap-to-detail (+ tests).
4. Card-stack body for swap modes (+ tests).
5. Synergy/combo enrichment + icon tagging (+ tests).

Steps 1–3 deliver the core fix (live reveal + acceptable list + detail); 4–5 are
additive.

## 9. Open questions

- **Enrichment volume:** cap the number of appended synergy/combo extras (e.g.
  top N) so the list isn't flooded? Default: cap at a small N, surfaced in a
  separate "Also worth it" group at the end of the list.
- **Server-side enrichment** (biasing the candidate pool toward synergy/combo
  cards) is deferred; revisit if client-side merge feels bolted-on.
