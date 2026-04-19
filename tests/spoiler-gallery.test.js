// tests/spoiler-gallery.test.js
// Phase 12 Plan 04 — RED contract for the spoiler-gallery rewrite.
//
// Pure string-assertion tests against the HTML returned by
// renderSpoilerGallery(). No DOM mount, no Alpine runtime — every assertion
// is a grep over the template string. Mirrors tests/spoiler-set-filter.test.js
// (Plan 02) and, for the static-grep gate, the Test 8 pattern in
// tests/settings-modal-auth.test.js.
//
// 11 assertions cover:
//   1. Custom set-filter component wired in (no native <select>)
//   2. Grouped grid iterates $store.market.groupedSpoilerCards
//   3. Day header format 'MMM DD, YYYY • N CARDS'
//   4. Fixed 2/3/4 column grid (D-06); legacy 6-col gone
//   5. NEW badge + isNew helper preserved
//   6. Bookmark calls addToWatchlist / removeFromWatchlist
//   7. bookmark_add ↔ bookmark icon swap via isWatching
//   8. is-watching class toggles via :class
//   9. Hover preview uses image_uris.normal + DFC fallback
//  10. flipLeft + window.innerWidth + 270 threshold
//  11. Source file contains no toast references (D-10)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderSpoilerGallery } from '../src/components/spoiler-gallery.js';

describe('renderSpoilerGallery (Phase 12 rewrite)', () => {
  it('imports and renders the set-filter component (no native <select>)', () => {
    const html = renderSpoilerGallery();
    // renderSpoilerSetFilter emits this exact iterator line — unique to that
    // component, so its presence proves the import landed.
    expect(html).toContain('x-for="set in $store.market.sets"');
    // The legacy native <select> opened with <option value="...
    expect(html).not.toContain('<option value=""');
  });

  it('uses groupedSpoilerCards for the grid', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('x-for="group in $store.market.groupedSpoilerCards"');
    expect(html).toContain(':key="group.date"');
  });

  it('day header format is "MMM DD, YYYY • N CARDS"', () => {
    const html = renderSpoilerGallery();
    // Inline helper named formatReleaseDate (matches release-calendar.js convention)
    expect(html).toContain('formatReleaseDate');
    // Exact separator + card-count suffix
    expect(html).toContain(" • ");
    expect(html).toContain("group.cards.length + ' CARDS'");
  });

  it('uses fixed 2/3/4 column grid (D-06)', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('grid-cols-2 lg:grid-cols-3 xl:grid-cols-4');
    // Legacy 6-col responsive scale must be gone
    expect(html).not.toContain('2xl:grid-cols-6');
  });

  it('preserves NEW badge (48h window) + isNew helper', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('isNew(card.released_at)');
    expect(html).toContain('class="badge-new');
  });

  it('bookmark button calls addToWatchlist / removeFromWatchlist', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('$store.market.addToWatchlist(card.id)');
    expect(html).toContain('$store.market.removeFromWatchlist(card.id)');
    expect(html).toContain('class="cf-spoiler-bookmark');
  });

  it('bookmark toggles between bookmark_add and bookmark icons via isWatching', () => {
    const html = renderSpoilerGallery();
    // Unfilled glyph (add)
    expect(html).toContain('bookmark_add');
    // Filled glyph — must appear at least once as a standalone word
    // (independent of 'bookmark_add' / 'cf-spoiler-bookmark')
    const filledMatches = html.match(/'bookmark'/g);
    expect(filledMatches).not.toBeNull();
    expect(filledMatches.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('isWatching');
  });

  it('bookmark has is-watching class when card is on watchlist', () => {
    const html = renderSpoilerGallery();
    // :class binding that toggles is-watching via the isWatching getter
    expect(html).toMatch(/'is-watching'\s*:\s*isWatching/);
  });

  it('hover preview uses image_uris.normal with DFC fallback', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('card.image_uris?.normal');
    expect(html).toContain('card.card_faces?.[0]?.image_uris?.normal');
    expect(html).toContain('class="cf-hover-preview');
  });

  it('hover preview flipLeft flag set by viewport-edge check (270px threshold)', () => {
    const html = renderSpoilerGallery();
    expect(html).toContain('flipLeft');
    expect(html).toContain('window.innerWidth');
    // 270 = preview width (250) + 8px margin + 12px safety
    expect(html).toContain('270');
  });

  it('does NOT dispatch any toast on bookmark click (D-10 static grep gate)', () => {
    // Read the source directly — mirrors tests/settings-modal-auth.test.js Test 8.
    const here = fileURLToPath(import.meta.url);
    const src = readFileSync(
      resolve(dirname(here), '..', 'src', 'components', 'spoiler-gallery.js'),
      'utf8'
    );
    expect(src).not.toMatch(/Alpine\.store\(['"]toast['"]\)/);
    expect(src).not.toMatch(/\$store\.toast/);
  });
});
