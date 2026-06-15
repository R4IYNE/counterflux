# Brew Review Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI brew reveal cards live as they stream, let the user accept/reject each (streaming list for build/fill, card-stack for retune/upgrade), tap any card for full detail, and fold the rail's synergy/combo cards into the recommendations with icons.

**Architecture:** The server already streams Anthropic deltas; we emit each completed card object (not just a count). The client appends streamed cards to `recommendations` live and shows the review surface on the first card. The review component splits into a shell + a streaming-list body + a card-stack body. A client-side enrichment helper merges EDHREC synergies + Spellbook combo pieces from the `intelligence` store and tags matches.

**Tech Stack:** Vanilla JS + Alpine.js, Dexie (IndexedDB), Vercel serverless (`api/`), `@anthropic-ai/sdk` streaming, Vitest + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-06-15-brew-review-experience-design.md`

---

## File Structure

**Create**
- `src/services/deckgen-stream-parse.js` — pure helper `extractRecommendedCards(buffer)` that pulls complete card objects out of a partial NDJSON/JSON buffer. Used server-side via copy (Vercel `api/` can't import `src/`), and unit-tested on the client.
- `src/services/deckgen-enrich.js` — pure helper `enrichWithIntelligence({ recommendations, synergies, combos, deckScryfallIds })` returning the merged+tagged list.
- `src/components/brew-review-list.js` — streaming-list body (build/fill).
- `src/components/brew-review-stack.js` — card-stack body (retune/upgrade).

**Modify**
- `api/deckgen.js` — emit `{type:'card', card}` events as cards complete in the buffer.
- `src/services/deckgen.js` — `readNdjsonStream` gains a `card` branch + `onCard` callback.
- `src/stores/deckgen.js` — `startBrew` appends streamed cards live, adds `streamComplete`, flips review surface on first card, runs enrichment on done.
- `src/components/deckgen-review-screen.js` — becomes the shell: mode switch + header + footer; delegates body to the two new components; scroll fix.
- `src/components/deckgen-brew-modal.js` — the `BREWING…` state yields to the review surface once the first card arrives.

> **Note:** `api/` (Vercel functions) and `src/` (Vite bundle) are separate build roots and cannot import each other. The parse helper is authored in `src/services/deckgen-stream-parse.js` (so it has unit tests), and the same function body is inlined into `api/deckgen.js`. Keep them identical; the test guards the logic.

---

## Task 1: Incremental card-parse helper (pure, shared logic)

**Files:**
- Create: `src/services/deckgen-stream-parse.js`
- Test: `tests/deckgen-stream-parse.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/deckgen-stream-parse.test.js
import { describe, it, expect } from 'vitest';
import { extractRecommendedCards } from '../src/services/deckgen-stream-parse.js';

describe('extractRecommendedCards', () => {
  it('returns only the cards whose JSON object has fully closed', () => {
    const buffer =
      '{"recommended":[' +
      '{"scryfall_id":"a1","role":"RAMP","reasoning":"fast mana"},' +
      '{"scryfall_id":"b2","role":"DRAW","reasoning":"card adv"},' +
      '{"scryfall_id":"c3","role":"WIN'; // <- last object still streaming
    const cards = extractRecommendedCards(buffer);
    expect(cards.map(c => c.scryfall_id)).toEqual(['a1', 'b2']);
    expect(cards[0]).toEqual({ scryfall_id: 'a1', role: 'RAMP', reasoning: 'fast mana' });
  });

  it('returns [] when no complete card object exists yet', () => {
    expect(extractRecommendedCards('{"recommended":[{"scryfall_id":"a1"')).toEqual([]);
  });

  it('ignores text before the recommended array', () => {
    expect(extractRecommendedCards('blah {"recommended":[{"scryfall_id":"a1","role":"X"}]'))
      .toEqual([{ scryfall_id: 'a1', role: 'X', reasoning: undefined }]);
  });

  it('tolerates a brace inside a string value', () => {
    const buffer = '{"recommended":[{"scryfall_id":"a1","role":"X","reasoning":"uses {0} mana"}]';
    expect(extractRecommendedCards(buffer)[0].reasoning).toBe('uses {0} mana');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-stream-parse.test.js`
Expected: FAIL — `extractRecommendedCards is not a function`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/services/deckgen-stream-parse.js
//
// Pulls fully-formed card objects out of a partial NDJSON/JSON buffer so the
// brew can reveal cards as Anthropic streams them. Brace-balanced scan with
// string-awareness (so a `{` inside a reasoning string doesn't fool it). Each
// candidate object is JSON.parsed; only objects that parse AND carry a
// scryfall_id are returned. Pure + deterministic — unit tested. The same body
// is inlined in api/deckgen.js (separate Vercel build root).

export function extractRecommendedCards(buffer) {
  const out = [];
  if (!buffer) return out;
  const arrStart = buffer.indexOf('"recommended"');
  if (arrStart === -1) return out;
  const bracket = buffer.indexOf('[', arrStart);
  if (bracket === -1) return out;

  let i = bracket + 1;
  const n = buffer.length;
  while (i < n) {
    // skip to next object start
    while (i < n && buffer[i] !== '{') {
      if (buffer[i] === ']') return out; // array closed
      i++;
    }
    if (i >= n) break;
    // brace-balanced, string-aware scan for the matching '}'
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < n; j++) {
      const ch = buffer[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end === -1) break; // object still streaming
    try {
      const obj = JSON.parse(buffer.slice(i, end + 1));
      if (obj && obj.scryfall_id) {
        out.push({ scryfall_id: obj.scryfall_id, role: obj.role, reasoning: obj.reasoning });
      }
    } catch { /* malformed slice — stop, wait for more */ break; }
    i = end + 1;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/deckgen-stream-parse.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/deckgen-stream-parse.js tests/deckgen-stream-parse.test.js
git commit -m "feat(brew): card-parse helper for incremental brew streaming"
```

---

## Task 2: Server emits `card` events

**Files:**
- Modify: `api/deckgen.js` (the `emitProgress` closure near line 235 + the `stream.on('text')` near line 260)
- Test: covered by Task 1 (the parse logic) + Task 3 (the client consumes `card` events). `api/` has no unit harness here; the logic guard is Task 1.

- [ ] **Step 1: Read the current streaming block**

Run: read `api/deckgen.js` lines 230–264 to confirm the `emitProgress`/`accumulated`/`stream.on('text')` anchors are unchanged from this plan.

- [ ] **Step 2: Inline the parse helper + emit new cards**

Replace the `emitProgress` closure (currently count-only) so it ALSO emits one `card` event per newly-completed card. Paste the body of `extractRecommendedCards` from Task 1 as a local function `extractRecommendedCards` at the top of the handler module (Vercel `api/` cannot import `src/`). Then:

```javascript
let lastCardCount = -1;
let emittedCards = 0;               // how many card events already sent
const emitProgress = () => {
  const complete = extractRecommendedCards(accumulated);
  // stream any newly-completed cards
  for (let k = emittedCards; k < complete.length; k++) {
    writeEvent(res, { type: 'card', card: complete[k] });
  }
  emittedCards = complete.length;
  // keep the count event for the footer + back-compat
  const cards = (accumulated.match(/"scryfall_id"/g) || []).length;
  if (cards !== lastCardCount) {
    lastCardCount = cards;
    writeEvent(res, { type: 'progress', cards });
  }
};
```

`stream.on('text', (delta) => { accumulated += delta; emitProgress(); });` stays as-is. The final `{type:'done'}` payload (the validated full list) is unchanged — it remains authoritative and the client reconciles against it.

- [ ] **Step 3: Manual verification note**

`api/deckgen.js` has no local unit test harness. Verify by deploying to a Vercel preview and running one brew, OR by asserting in Task 3 that the client correctly handles a `card`-event stream (the contract this task produces). No code path other than `emitProgress` changes.

- [ ] **Step 4: Commit**

```bash
git add api/deckgen.js
git commit -m "feat(brew): stream individual card events from the deckgen endpoint"
```

---

## Task 3: Client stream parser — `card` branch + `onCard`

**Files:**
- Modify: `src/services/deckgen.js` — `readNdjsonStream` (lines ~164-209) + the `generateDeck` call site that passes callbacks
- Test: `tests/deckgen-client.test.js` (reuse `streamRes` helper at top of file)

- [ ] **Step 1: Write the failing test**

```javascript
// add to tests/deckgen-client.test.js
import { readNdjsonStream } from '../src/services/deckgen.js';

describe('readNdjsonStream — card events', () => {
  it('invokes onCard for each {type:card} line and onProgress for counts', async () => {
    const res = streamRes([
      JSON.stringify({ type: 'progress', cards: 1 }),
      JSON.stringify({ type: 'card', card: { scryfall_id: 'a1', role: 'RAMP', reasoning: 'r' } }),
      JSON.stringify({ type: 'card', card: { scryfall_id: 'b2', role: 'DRAW' } }),
      JSON.stringify({ type: 'done', recommended: [{ scryfall_id: 'a1' }, { scryfall_id: 'b2' }] }),
    ]);
    const cards = [];
    const counts = [];
    const result = await readNdjsonStream(res, (n) => counts.push(n), (c) => cards.push(c));
    expect(cards.map(c => c.scryfall_id)).toEqual(['a1', 'b2']);
    expect(counts).toContain(1);
    expect(result.done.recommended).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-client.test.js -t "card events"`
Expected: FAIL — `onCard` not wired; `cards` is empty.

- [ ] **Step 3: Implement the `card` branch**

In `src/services/deckgen.js`, change the signature to `readNdjsonStream(res, onProgress, onCard)` and add the branch inside `handleLine`:

```javascript
} else if (evt.type === 'card') {
  if (typeof onCard === 'function' && evt.card) { try { onCard(evt.card); } catch { /* ignore */ } }
} else if (evt.type === 'done') {
```

Thread `onCard` through `generateDeck` (where it calls `readNdjsonStream(res, onProgress)`): accept an `onCard` option on `generateDeck` and pass it through: `readNdjsonStream(res, onProgress, onCard)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/deckgen-client.test.js -t "card events"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/deckgen.js tests/deckgen-client.test.js
git commit -m "feat(brew): readNdjsonStream surfaces per-card events to onCard"
```

---

## Task 4: Store — live append, streamComplete, review-on-first-card

**Files:**
- Modify: `src/stores/deckgen.js` — `startBrew` (lines ~125-209), store state (add `streamComplete`)
- Test: `tests/deckgen-store.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// add to tests/deckgen-store.test.js — assumes the store's existing test setup
it('appends streamed cards live, dedupes, and flips review on first card', async () => {
  const store = Alpine.store('deckgen');
  // mock generateDeck so onCard fires before the promise resolves
  vi.spyOn(deckgenService, 'generateDeck').mockImplementation(async ({ onCard }) => {
    onCard({ scryfall_id: 'a1', role: 'RAMP', reasoning: 'r1' });
    onCard({ scryfall_id: 'a1', role: 'RAMP', reasoning: 'r1' }); // dup
    onCard({ scryfall_id: 'b2', role: 'DRAW' });
    return { ok: true, response: { recommended: [
      { scryfall_id: 'a1', role: 'RAMP' }, { scryfall_id: 'b2', role: 'DRAW' },
      { scryfall_id: 'c3', role: 'WIN_CON' }, // arrived only in done
    ] } };
  });
  await store.startBrew({ commanderId: 'cmdr', powerLevel: 5, mode: 'build', deckId: 'd1' });
  const ids = store.recommendations.map(r => r.scryfall_id);
  expect(ids).toEqual(['a1', 'b2', 'c3']); // deduped live + reconciled from done
  expect(store.streamComplete).toBe(true);
  expect(store.recommendations.every(r => r.approved)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-store.test.js -t "appends streamed cards live"`
Expected: FAIL — `streamComplete` undefined / cards not appended live.

- [ ] **Step 3: Implement**

In the store state add `streamComplete: false`. In `startBrew`, before the `generateDeck` call: `this.recommendations = []; this.streamComplete = false;`. Add the `onCard` option to the `generateDeck` call:

```javascript
onCard: (card) => {
  if (this.recommendations.some(r => r.scryfall_id === card.scryfall_id)) return;
  this.recommendations.push({ ...card, approved: true });
  if (this.status === 'brewing' && this.recommendations.length === 1) {
    // first card — review surface takes over from the spinner
    this.status = 'reviewing';
  }
},
```

After a successful result, reconcile + mark complete (replace the existing `this.recommendations = (result.response?.recommended || [])...` block):

```javascript
const seen = new Set(this.recommendations.map(r => r.scryfall_id));
for (const r of (result.response?.recommended || [])) {
  if (!seen.has(r.scryfall_id)) this.recommendations.push({ ...r, approved: true });
}
this.streamComplete = true;
this.status = 'reviewing';
```

On the error path and in `reset()`, set `this.streamComplete = false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/deckgen-store.test.js -t "appends streamed cards live"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/deckgen.js tests/deckgen-store.test.js
git commit -m "feat(brew): live-append streamed cards + streamComplete in deckgen store"
```

---

## Task 5: Synergy/combo enrichment helper + tagging

**Files:**
- Create: `src/services/deckgen-enrich.js`
- Test: `tests/deckgen-enrich.test.js`
- Modify: `src/stores/deckgen.js` — call enrichment after `streamComplete = true`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/deckgen-enrich.test.js
import { describe, it, expect } from 'vitest';
import { enrichWithIntelligence } from '../src/services/deckgen-enrich.js';

describe('enrichWithIntelligence', () => {
  const recs = [{ scryfall_id: 'a1', role: 'RAMP', approved: true }];
  it('tags an existing rec that is a known synergy/combo', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [{ scryfall_id: 'a1' }],
      combos: { almostIncluded: [] },
      deckScryfallIds: new Set(),
    });
    expect(out.find(r => r.scryfall_id === 'a1').source).toBe('synergy');
  });
  it('appends a missed combo piece as an opt-in extra (approved:false)', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [],
      combos: { almostIncluded: [{ scryfall_id: 'z9' }] },
      deckScryfallIds: new Set(),
    });
    const z = out.find(r => r.scryfall_id === 'z9');
    expect(z).toMatchObject({ source: 'combo', approved: false });
  });
  it('does not append a synergy already in the deck or recs', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [{ scryfall_id: 'a1' }, { scryfall_id: 'inDeck' }],
      combos: { almostIncluded: [] },
      deckScryfallIds: new Set(['inDeck']),
    });
    expect(out.filter(r => r.scryfall_id === 'inDeck')).toHaveLength(0);
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-enrich.test.js`
Expected: FAIL — `enrichWithIntelligence is not a function`.

- [ ] **Step 3: Implement**

```javascript
// src/services/deckgen-enrich.js
//
// Merge the commander's EDHREC synergies + Spellbook "almost-included" combo
// pieces (from the intelligence store) into the brew recommendations:
//   - tag any existing rec that matches a synergy/combo (combo wins ties)
//   - append missed synergy/combo cards as opt-in extras (approved:false),
//     skipping anything already in the deck or recs
// Pure + deterministic. Cap appended extras so the list isn't flooded.

const MAX_EXTRAS = 8;

export function enrichWithIntelligence({ recommendations, synergies = [], combos = {}, deckScryfallIds = new Set() }) {
  const comboIds = new Set((combos.almostIncluded || []).map(c => c.scryfall_id).filter(Boolean));
  const synergyIds = new Set((synergies || []).map(s => s.scryfall_id).filter(Boolean));
  const tagFor = (id) => (comboIds.has(id) ? 'combo' : synergyIds.has(id) ? 'synergy' : null);

  // 1. tag existing recs
  const out = recommendations.map(r => {
    const tag = tagFor(r.scryfall_id);
    return tag ? { ...r, source: tag } : r;
  });

  // 2. append missed extras (combos first — higher signal)
  const present = new Set(out.map(r => r.scryfall_id));
  const candidates = [
    ...[...comboIds].map(id => ({ id, source: 'combo' })),
    ...[...synergyIds].map(id => ({ id, source: 'synergy' })),
  ];
  let added = 0;
  for (const { id, source } of candidates) {
    if (added >= MAX_EXTRAS) break;
    if (!id || present.has(id) || deckScryfallIds.has(id)) continue;
    present.add(id);
    out.push({ scryfall_id: id, role: source === 'combo' ? 'WIN_CON' : 'SUPPORT', source, approved: false });
    added++;
  }
  return out;
}
```

In `src/stores/deckgen.js`, after `this.streamComplete = true;`, call enrichment (guard against a missing intelligence store):

```javascript
try {
  const intel = Alpine.store('intelligence');
  const deckCards = Alpine.store('deck')?.activeCards || [];
  const deckIds = new Set(deckCards.map(c => c.scryfall_id));
  const { enrichWithIntelligence } = await import('../services/deckgen-enrich.js');
  this.recommendations = enrichWithIntelligence({
    recommendations: this.recommendations,
    synergies: intel?.synergies || [],
    combos: intel?.combos || {},
    deckScryfallIds: deckIds,
  });
} catch { /* intelligence cold — brew works without enrichment */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/deckgen-enrich.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/deckgen-enrich.js tests/deckgen-enrich.test.js src/stores/deckgen.js
git commit -m "feat(brew): enrich recommendations with synergy/combo tags + extras"
```

---

## Task 6: Streaming-list review body + shell + scroll fix + detail

**Files:**
- Create: `src/components/brew-review-list.js`
- Modify: `src/components/deckgen-review-screen.js` (shell: header/footer + mode switch + scroll fix)
- Test: `tests/deckgen-review-screen.test.js`

- [ ] **Step 1: Read the current component**

Run: read `src/components/deckgen-review-screen.js` in full (335 lines) — keep the `x-data` helpers (`cardName`, `cardImage`, `groupedByRole`, `approvedCount`, `btnAdd`, `btnSkip`, `commit`, `hydrateCardMeta`). They are reused by the list body.

- [ ] **Step 2: Write the failing test**

```javascript
// add to tests/deckgen-review-screen.test.js
it('build mode shows the streaming list, a brewing footer until complete, and an owned/role row per rec', () => {
  const store = Alpine.store('deckgen');
  store.mode = 'build';
  store.streamComplete = false;
  store.recommendations = [{ scryfall_id: 'a1', role: 'RAMP', approved: true }];
  store.status = 'reviewing';
  document.body.innerHTML = renderDeckgenReviewScreen();
  Alpine.initTree(document.body);
  // brewing footer visible while !streamComplete
  expect(document.body.textContent.toLowerCase()).toContain('brewing');
  // a row exists for the rec, with an Add and a Skip action
  expect(document.body.textContent).toMatch(/add/i);
  expect(document.body.textContent).toMatch(/skip/i);
});

it('scroll container declares min-height:0 so overflow scrolls', () => {
  document.body.innerHTML = renderDeckgenReviewScreen();
  expect(document.body.innerHTML).toMatch(/overflow-y:\s*auto/);
  expect(document.body.innerHTML).toMatch(/min-height:\s*0/);
});

it('tapping a card row dispatches card-flyout', () => {
  const store = Alpine.store('deckgen');
  store.mode = 'build'; store.status = 'reviewing';
  store.recommendations = [{ scryfall_id: 'a1', role: 'RAMP', approved: true }];
  document.body.innerHTML = renderDeckgenReviewScreen();
  Alpine.initTree(document.body);
  let fired = false;
  document.addEventListener('card-flyout', () => { fired = true; });
  document.querySelector('[data-brew-card="a1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(fired).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-review-screen.test.js`
Expected: FAIL — no brewing footer, no `min-height:0`, no `data-brew-card` hook.

- [ ] **Step 4: Implement the shell + list body**

In `deckgen-review-screen.js`:
- Add `min-height: 0;` to the scrollable Body `<div>` (the `flex: 1; ... overflow-y: auto;` container near line 187) — **the scroll-bug fix**.
- Add a footer shown while `!$store.deckgen.streamComplete`: `<div ...>Brewing… <span x-text="$store.deckgen.recommendations.length"></span> so far</div>`.
- Gate the Commit button additionally on `streamComplete` (`:disabled="approvedCount === 0 || !$store.deckgen.streamComplete || status === 'committing'"`).
- Replace the inline plain-add template with `brew-review-list` when `!isSwapMode`, and (Task 7) `brew-review-stack` when `isSwapMode`.

Create `src/components/brew-review-list.js` exporting `renderBrewReviewList()` returning the grouped streaming list. Each card row:
- carries `:data-brew-card="rec.scryfall_id"`,
- `@click` (not on a button) dispatches `new CustomEvent('card-flyout', { detail: { card: cardMetaCache[rec.scryfall_id] }, bubbles: true })`,
- shows the synergy/combo icon when `rec.source` is set: combo → `<span class="combo-badge material-symbols-outlined">bolt</span>`, synergy → `<span class="material-symbols-outlined">hub</span>` (confirm glyph against deck view),
- reuses `btnAdd`/`btnSkip` for Add/Skip,
- on touch, a left-swipe sets approval false (basic `touchstart`/`touchend` deltaX handler; keep it minimal — buttons remain the primary control).

Append a final "Also worth it" group for recs where `rec.source && rec.approved === false` (the opt-in extras), so enrichment extras read as a distinct section.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/deckgen-review-screen.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/brew-review-list.js src/components/deckgen-review-screen.js tests/deckgen-review-screen.test.js
git commit -m "feat(brew): streaming-list review body + scroll fix + tap-to-detail + icons"
```

---

## Task 7: Card-stack body (retune/upgrade) + brew-modal handoff

**Files:**
- Create: `src/components/brew-review-stack.js`
- Modify: `src/components/deckgen-review-screen.js` (use the stack when `isSwapMode`), `src/components/deckgen-brew-modal.js` (yield to review on first card)
- Test: `tests/deckgen-review-stack.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/deckgen-review-stack.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { renderBrewReviewStack } from '../src/components/brew-review-stack.js';
// (reuse the test file's existing Alpine + store bootstrap pattern)

it('shows one card at a time with apply/skip and an n/total counter', () => {
  const store = Alpine.store('deckgen');
  store.mode = 'retune';
  store.recommendations = [
    { scryfall_id: 'a1', swap_out: 'x1', role: 'RAMP', approved: false },
    { scryfall_id: 'b2', swap_out: 'x2', role: 'DRAW', approved: false },
  ];
  document.body.innerHTML = renderBrewReviewStack();
  Alpine.initTree(document.body);
  expect(document.body.textContent).toMatch(/1\s*\/\s*2/);
  expect(document.body.textContent).toMatch(/apply/i);
  expect(document.body.textContent).toMatch(/skip/i);
});

it('right-arrow applies the current card and advances', () => {
  const store = Alpine.store('deckgen');
  store.mode = 'retune';
  store.recommendations = [{ scryfall_id: 'a1', swap_out: 'x1', approved: false }];
  document.body.innerHTML = renderBrewReviewStack();
  Alpine.initTree(document.body);
  document.querySelector('[data-stack-root]')
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(store.recommendations[0].approved).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/deckgen-review-stack.test.js`
Expected: FAIL — `renderBrewReviewStack is not a function`.

- [ ] **Step 3: Implement the stack**

Create `src/components/brew-review-stack.js` exporting `renderBrewReviewStack()`. `x-data` holds `idx: 0`. Renders `recommendations[idx]` as a large card (reuse `cardImage`/`cardName`/swap-pair OUT→IN markup from the current component), with:
- `@keydown.window` on a `[data-stack-root]` element: `ArrowRight` → `setApproval(cur.scryfall_id, true); idx++`, `ArrowLeft` → `setApproval(cur.scryfall_id, false); idx++`,
- on-card **Apply** / **Skip** buttons doing the same,
- `touchstart`/`touchend` deltaX → right=apply, left=skip,
- tap on the art dispatches `card-flyout`,
- the synergy/combo icon when `cur.source` is set,
- a "n / total" counter; when `idx >= recommendations.length`, show the commit summary (count + Commit button gated on `streamComplete`).

In `deckgen-review-screen.js`, render `renderBrewReviewStack()` when `isSwapMode`, else `renderBrewReviewList()`.

In `deckgen-brew-modal.js`, the brewing block (`x-show="$store.deckgen?.status === 'brewing'"`) already yields because the store flips `status` to `reviewing` on the first card (Task 4) and the review screen's `x-show` includes `reviewing`. Confirm the brew modal's `x-show` for the *form* is hidden once `status !== 'idle'` so the review surface is unobstructed; if not, add `&& $store.deckgen.recommendations.length === 0` to keep the spinner only until the first card.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/deckgen-review-stack.test.js`
Expected: PASS.

- [ ] **Step 5: Full suite + build**

Run: `npx vitest run` (expect 0 failures beyond the pre-existing Alpine-teardown unhandled-error noise) and `npm run build` (expect `✓ built`).

- [ ] **Step 6: Commit**

```bash
git add src/components/brew-review-stack.js src/components/deckgen-review-screen.js src/components/deckgen-brew-modal.js tests/deckgen-review-stack.test.js
git commit -m "feat(brew): card-stack review for retune/upgrade + modal handoff"
```

---

## Self-Review (completed by author)

- **Spec coverage:** live streaming (T1–T4), adaptive list/stack (T6/T7), scroll fix (T6), synergy/combo enrich+tag (T5/T6/T7), tap-to-detail (T6/T7), commit-after-complete (T4/T6). All spec sections map to a task.
- **Type consistency:** `extractRecommendedCards` (T1) reused verbatim in T2; `onCard(card)` (T2) → store append (T3) → `enrichWithIntelligence` (T5) → `rec.source` consumed in T6/T7. `streamComplete` set in T4, read in T6. Card shape `{scryfall_id, role, reasoning, approved, source}` consistent throughout.
- **Placeholders:** none — every code step shows code; UI tasks include the concrete new markup/handlers and a read-the-file step for the existing helpers (not a code placeholder).
- **Manual-only gap:** `api/deckgen.js` (T2) has no local unit harness; its logic is guarded by T1 and its contract by T3. Flagged for preview verification.
