// src/components/precon-browser.js
// COLLECT-02 / D-06: full-screen drawer (mirrors csv-import-modal mount pattern)
// that hosts the precon tile grid (VIEW A) and the decklist preview (VIEW B).
//
// Opens when $store.collection.preconBrowserOpen === true. Mounts inside the
// #tc-modals container via treasure-cruise.js. Escape key closes. The BROWSE
// PRECONS button in add-card-panel.js flips preconBrowserOpen + calls
// loadPrecons(). The ADD ALL N CARDS button calls addAllFromPrecon(code)
// which commits the whole deck in one transaction, fires one toast, and
// registers one undo entry.
//
// UI-SPEC §Component Anatomy 3: tile grid auto-fill with min 240px columns,
// 24px gap; tile aspect 240:336 (card ratio); keyrune glyph at 50% 50%,
// 96px, opacity 0.4; set-type badge top-left (COMMANDER | DUEL DECK);
// gradient fade overlay bottom with name + code + year.
// UI-SPEC §Copywriting Contract: exact strings preserved.
// UI-SPEC §Interaction & Motion: Escape closes; backdrop click closes;
// ADD ALL shows card count; workspace_premium badge marks commander row
// in preview.
//
// Name lookup: decklist entries have scryfall_id but no name. We expose a
// window.__cf_getPreconCardName(scryfall_id) helper that reads db.cards
// synchronously via the store cache (populated by searchCards or bulk data).
// If the name isn't in cache we fall back to the scryfall_id so the render
// never blanks out.

import { db } from '../db/schema.js';
import { isMultiDeckBundle, splitPreconIntoDecks } from '../services/precons.js';

/**
 * Render the Precon Browser drawer HTML.
 * @returns {string} HTML string
 */
export function renderPreconBrowser() {
  // Expose a name-lookup helper for the Alpine x-data template.
  // Uses an in-memory Map populated lazily — a single precon drill-in needs
  // ~100 card names; we batch-fetch from db.cards and cache in a module-level
  // map to avoid repeat reads.
  if (typeof window !== 'undefined' && !window.__cf_preconCardNames) {
    window.__cf_preconCardNames = new Map();
    window.__cf_hydratePreconNames = async (scryfallIds) => {
      const missing = scryfallIds.filter((id) => !window.__cf_preconCardNames.has(id));
      if (!missing.length) return;
      try {
        const rows = await db.cards.where('id').anyOf(missing).toArray();
        for (const r of rows) {
          window.__cf_preconCardNames.set(r.id, r.name);
        }
      } catch (err) {
        console.warn('[precon-browser] name hydration failed:', err);
      }
    };
    window.__cf_getPreconCardName = (scryfallId) => {
      return window.__cf_preconCardNames.get(scryfallId) || scryfallId;
    };
  }

  // FOLLOWUP-4B (Phase 08.1) — expose the bundle detector to the Alpine
  // x-data scope. The `isBundle` getter inside VIEW B reads it via window
  // (Alpine x-data string templates can't import ES modules directly).
  if (typeof window !== 'undefined' && !window.__cf_isMultiDeckBundle) {
    window.__cf_isMultiDeckBundle = isMultiDeckBundle;
  }
  // Phase 14.07c — expose the bundle splitter for the virtual-deck tile view.
  if (typeof window !== 'undefined' && !window.__cf_splitPreconIntoDecks) {
    window.__cf_splitPreconIntoDecks = splitPreconIntoDecks;
  }

  return `
    <div
      x-data="{
        async hydrateNames(decklist) {
          if (!decklist || !decklist.length) return;
          const ids = decklist.map(e => e.scryfall_id);
          if (window.__cf_hydratePreconNames) await window.__cf_hydratePreconNames(ids);
        }
      }"
      x-show="$store.collection.preconBrowserOpen"
      x-cloak
      @keydown.escape.window="$store.collection.closePreconBrowser()"
      x-effect="$store.collection.selectedPreconCode && hydrateNames(($store.collection.precons.find(p => p.code === $store.collection.selectedPreconCode))?.decklist)"
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
    >
      <!-- Backdrop -->
      <div
        @click="$store.collection.closePreconBrowser()"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"
      ></div>

      <!-- Drawer panel -->
      <div
        @click.stop
        style="position: relative; z-index: 10; background: var(--color-surface); border: 1px solid var(--color-border-ghost); width: 90vw; max-width: 1280px; height: 90vh; display: flex; flex-direction: column; padding: 24px; gap: 16px; overflow: hidden;"
      >
        <!-- Header: title + REFRESH + close -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0; text-transform: uppercase;">
            BROWSE PRECONS
          </h2>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              @click="$store.collection.refreshPrecons()"
              :disabled="$store.collection.preconsLoading"
              style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase;"
              x-text="$store.collection.preconsLoading ? 'REFRESHING…' : 'REFRESH'"
            ></button>
            <button
              @click="$store.collection.closePreconBrowser()"
              aria-label="Close precon browser"
              title="Close precon browser"
              style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); transition: all 120ms ease-out;"
              onmouseenter="this.style.color='var(--color-secondary)'; this.style.boxShadow='0 0 8px var(--color-glow-red)'"
              onmouseleave="this.style.color='var(--color-text-muted)'; this.style.boxShadow='none'"
            >
              <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
            </button>
          </div>
        </div>

        <!-- Body: VIEW A (tiles) or VIEW B (decklist preview) -->
        <div style="flex: 1; min-height: 0; overflow-y: auto;">

          <!-- Loading skeleton -->
          <template x-if="$store.collection.preconsLoading && !$store.collection.precons.length">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px;">
              <template x-for="i in 10" :key="i">
                <div class="animate-pulse" style="width: 100%; aspect-ratio: 240 / 336; background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost);"></div>
              </template>
            </div>
          </template>

          <!-- Error state -->
          <template x-if="$store.collection.preconsError && !$store.collection.precons.length">
            <div style="padding: 48px; text-align: center;">
              <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-secondary); text-transform: uppercase; margin: 0;">COULDN'T LOAD PRECONS</h3>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Check your connection and try again.</p>
              <button
                @click="$store.collection.refreshPrecons()"
                style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;"
              >TRY AGAIN</button>
            </div>
          </template>

          <!-- Empty state -->
          <template x-if="!$store.collection.preconsLoading && !$store.collection.preconsError && !$store.collection.precons.length">
            <div style="padding: 48px; text-align: center;">
              <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-text-primary); text-transform: uppercase; margin: 0;">NO PRECONS AVAILABLE</h3>
              <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Scryfall didn't return any commander or duel-deck products. Try refreshing.</p>
              <button
                @click="$store.collection.refreshPrecons()"
                style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;"
              >REFRESH</button>
            </div>
          </template>

          <!-- VIEW A: Tile grid -->
          <template x-if="$store.collection.precons.length && !$store.collection.selectedPreconCode">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px;">
              <template x-for="precon in $store.collection.precons" :key="precon.code">
                <button
                  @click="$store.collection.selectPrecon(precon.code)"
                  class="card-tile-hover"
                  style="width: 100%; aspect-ratio: 240 / 336; padding: 0; background: var(--color-surface); border: 1px solid var(--color-border-ghost); cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;"
                >
                  <!-- Background keyrune glyph (ss-fallback prevents blank on missing codes per Pitfall 4) -->
                  <i class="ss ss-fallback" :class="'ss-' + precon.code"
                     style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 96px; color: var(--color-text-dim); opacity: 0.4;"></i>

                  <!-- Set-type badge (top-left) -->
                  <span
                    style="position: absolute; top: 8px; left: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); background: var(--color-surface-hover); text-transform: uppercase;"
                    x-text="precon.set_type === 'commander' ? 'COMMANDER' : 'DUEL DECK'"
                  ></span>

                  <!-- Overlay strip (bottom) -->
                  <div style="position: relative; z-index: 2; padding: 16px; background: linear-gradient(to top, var(--color-background), transparent); text-align: left;">
                    <div
                      style="font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase;"
                      x-text="precon.name"
                    ></div>
                    <div
                      style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--color-text-muted); margin-top: 4px; text-transform: uppercase;"
                      x-text="precon.code.toUpperCase() + ' · ' + (precon.released_at ? precon.released_at.slice(0,4) : '—')"
                    ></div>
                  </div>
                </button>
              </template>
            </div>
          </template>

          <!-- VIEW B: Decklist preview -->
          <template x-if="$store.collection.selectedPreconCode">
            <div x-data="{
              selectedDeckKey: null,
              get precon() { return $store.collection.precons.find(p => p.code === $store.collection.selectedPreconCode); },
              get isBundle() { return window.__cf_isMultiDeckBundle ? window.__cf_isMultiDeckBundle(this.precon) : false; },
              // Phase 14.07e — manifest-driven deck tiles for known multi-deck
              // products (Final Fantasy, Doctor Who, etc.). Returns [] when no
              // manifest entry exists for this set code, falling back to the
              // 14-07d full-bundle banner + ADD ALL flow.
              get manifestDecks() {
                if (!this.isBundle) return [];
                if (!window.__cf_splitPreconIntoDecks) return [];
                return window.__cf_splitPreconIntoDecks(this.precon);
              },
              get hasManifest() { return this.manifestDecks.length > 0; },
              get selectedDeck() {
                if (!this.selectedDeckKey) return null;
                return this.manifestDecks.find(d => d.key === this.selectedDeckKey) || null;
              },
              get effectiveDecklist() {
                if (this.selectedDeck) return this.selectedDeck.cards || [];
                return this.precon?.decklist || [];
              },
              get effectiveTitle() {
                if (this.selectedDeck) return this.precon?.name + ' — ' + this.selectedDeck.name;
                return this.precon?.name || '';
              },
              addAllEffective() {
                if (this.selectedDeck) {
                  const ids = this.selectedDeck.cards.map(c => c.scryfall_id);
                  const label = (this.precon?.name || 'precon') + ' — ' + this.selectedDeck.name;
                  if ($store.collection.addCardsFromIds) {
                    $store.collection.addCardsFromIds(ids, { label });
                  } else {
                    $store.collection.addAllFromPrecon($store.collection.selectedPreconCode);
                  }
                } else {
                  $store.collection.addAllFromPrecon($store.collection.selectedPreconCode);
                }
              },
              addButtonLabel() {
                if (this.isBundle && this.hasManifest && !this.selectedDeck) return 'PICK A DECK BELOW';
                if (!this.effectiveDecklist.length) return 'LOADING…';
                return 'ADD ALL ' + this.effectiveDecklist.length + ' CARDS';
              },
              get addButtonEnabled() {
                if ($store.collection.preconDecklistLoading) return false;
                if (this.isBundle && this.hasManifest && !this.selectedDeck) return false;
                return !!this.effectiveDecklist.length;
              },
              get sortedDecklist() {
                const list = this.effectiveDecklist;
                return [...list].sort((a, b) => {
                  if (a.is_commander !== b.is_commander) return b.is_commander ? 1 : -1;
                  return 0;
                });
              },
              cardName(id) { return (window.__cf_getPreconCardName && window.__cf_getPreconCardName(id)) || id; }
            }">
              <!-- Preview header -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px;">
                <button
                  @click="selectedDeckKey ? selectedDeckKey = null : $store.collection.selectedPreconCode = null"
                  style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase;"
                  x-text="selectedDeckKey ? '← BACK TO DECKS' : '← BACK TO PRECONS'"
                ></button>

                <h3
                  style="flex: 1; font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 0; text-transform: uppercase;"
                  x-text="effectiveTitle"
                ></h3>

                <button
                  @click="addAllEffective()"
                  :disabled="!addButtonEnabled"
                  :style="addButtonEnabled
                    ? 'padding: 8px 16px; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-primary); border: 1px solid var(--color-primary); cursor: pointer; text-transform: uppercase;'
                    : 'padding: 8px 16px; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-dim); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: not-allowed; text-transform: uppercase; opacity: 0.5;'"
                  x-text="addButtonLabel()"
                ></button>
              </div>

              <!-- Phase 14.07e — manifest-driven deck tile grid (Final Fantasy,
                   Doctor Who, etc.). Drill into a tile to preview/import that
                   single deck; ADD ALL on the bundle product code is gated until
                   a deck is picked so the user can't accidentally dump 486 cards. -->
              <template x-if="!$store.collection.preconDecklistLoading && !$store.collection.preconDecklistError && isBundle && hasManifest && !selectedDeck">
                <div>
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: var(--color-text-muted); margin: 0 0 16px 0; max-width: 720px;">
                    Pick one of the <span x-text="manifestDecks.length"></span> decks in this product to preview its cards or add it to your collection. To import the whole boxed set instead, return to the precon list and use ADD ALL on a non-bundle product.
                  </p>
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">
                    <template x-for="deck in manifestDecks" :key="deck.key">
                      <button
                        @click="selectedDeckKey = deck.key"
                        class="card-tile-hover"
                        style="width: 100%; aspect-ratio: 220 / 308; padding: 0; background: var(--color-surface); border: 1px solid var(--color-border-ghost); cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;"
                      >
                        <span
                          style="position: absolute; top: 8px; left: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); background: var(--color-surface-hover); text-transform: uppercase;"
                          x-text="deck.identityLabel"
                        ></span>
                        <span
                          style="position: absolute; top: 8px; right: 8px; padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); background: var(--color-surface-hover);"
                          x-text="deck.total + ' CARDS'"
                        ></span>
                        <div style="position: relative; z-index: 2; padding: 16px; background: linear-gradient(to top, var(--color-background), transparent); text-align: left;">
                          <div
                            style="font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase;"
                            x-text="deck.name"
                          ></div>
                          <div
                            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--color-text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                            x-text="deck.commanders.map(c => c.name).join(' · ')"
                          ></div>
                        </div>
                      </button>
                    </template>
                  </div>
                </div>
              </template>

              <!-- Phase 14.07d/e — bundles WITHOUT a manifest entry get the
                   informational banner + full decklist + ADD ALL flow.
                   Manifest-backed bundles use the tile grid above; the banner
                   below only fires when no per-deck split is available. -->
              <template x-if="!$store.collection.preconDecklistLoading && !$store.collection.preconDecklistError && isBundle && !hasManifest">
                <div style="margin-bottom: 16px; padding: 12px 16px; background: var(--color-surface-hover); border-left: 2px solid var(--color-warning);">
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: var(--color-text-primary); margin: 0;">
                    <strong style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-warning); text-transform: uppercase; margin-right: 8px;">MULTI-DECK PRODUCT</strong>
                    This boxed set bundles multiple decks. Per-deck import isn't supported for this product yet — ADD ALL imports every card from every deck. Only do this if you own the whole product.
                  </p>
                </div>
              </template>

              <!-- Decklist loading -->
              <template x-if="$store.collection.preconDecklistLoading">
                <div style="padding: 48px; text-align: center; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;">LOADING DECKLIST…</div>
              </template>

              <!-- Decklist error -->
              <template x-if="$store.collection.preconDecklistError">
                <div style="padding: 24px; text-align: center;">
                  <h4 style="font-family: 'Syne', sans-serif; font-size: 20px; color: var(--color-secondary); text-transform: uppercase; margin: 0;">DECKLIST LOAD FAILED</h4>
                  <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: var(--color-text-muted); margin: 16px 0;">Something went wrong fetching this decklist. Try another product or refresh.</p>
                </div>
              </template>


              <!-- Decklist rows.
                   Phase 14.07e — when a manifest deck is selected the rows
                   filter to that deck's cards via effectiveDecklist;
                   otherwise the full bundle (or non-bundle precon) renders.
                   Hidden on manifest-backed bundles when no deck is selected
                   (the tile grid takes that slot). -->
              <template x-if="effectiveDecklist.length && !$store.collection.preconDecklistLoading && !(isBundle && hasManifest && !selectedDeck)">
                <div style="display: flex; flex-direction: column;">
                  <template x-for="entry in sortedDecklist" :key="entry.scryfall_id">
                    <div
                      style="display: flex; align-items: center; gap: 16px; padding: 8px 12px; min-height: 56px; border-bottom: 1px solid var(--color-border-ghost); transition: background 120ms ease-out, border-left 120ms ease-out;"
                      onmouseenter="this.style.background='var(--color-surface-hover)'; this.style.borderLeft='2px solid var(--color-primary)'"
                      onmouseleave="this.style.background='transparent'; this.style.borderLeft='none'"
                    >
                      <span
                        style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-text-muted); min-width: 32px;"
                        x-text="entry.quantity + '×'"
                      ></span>
                      <span
                        style="flex: 1; font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                        x-text="cardName(entry.scryfall_id)"
                      ></span>
                      <template x-if="entry.is_commander">
                        <span class="material-symbols-outlined" title="Commander" aria-label="Commander" style="font-size: 16px; color: var(--color-text-primary);">workspace_premium</span>
                      </template>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>

        </div>
      </div>
    </div>
  `;
}
