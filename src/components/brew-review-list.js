/**
 * Brew review — streaming list body (plain / non-swap mode).
 *
 * Extracted from deckgen-review-screen.js so the post-brew add list can grow
 * independently of the swap-pair card-stack. This function returns an HTML
 * string that is interpolated DIRECTLY into the review shell's template, so it
 * runs inside the SAME Alpine x-data scope and can reference the shell's
 * helpers (cardName, cardImage, btnAdd, btnSkip, groupedByRole, cardMetaCache)
 * and $store.deckgen.* without re-declaring them.
 *
 * Each row:
 *  - carries :data-brew-card="rec.scryfall_id"
 *  - dispatches a bubbling `card-flyout` CustomEvent on @click (row-level) so a
 *    parent listener can open card detail; Add/Skip buttons .stop the click so
 *    tapping them never opens detail.
 *  - shows a combo/synergy badge when rec.source is set.
 *
 * A final "ALSO WORTH IT" group lists enrichment extras — recs whose source is
 * set AND approved === false — so they read as a distinct opt-in section.
 */
export function renderBrewReviewList() {
  // Reusable single-card row. Interpolated into both the per-role groups and
  // the trailing ALSO WORTH IT group so the markup stays in one place.
  const cardRow = `
    <div
      :data-brew-card="rec.scryfall_id"
      @click="cardMetaCache[rec.scryfall_id] && $store.search.selectResult(cardMetaCache[rec.scryfall_id])"
      :style="rec.approved
        ? 'display: flex; gap: 12px; padding: 12px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.4); cursor: pointer;'
        : 'display: flex; gap: 12px; padding: 12px; background: transparent; border: 1px solid #2A2D3A; opacity: 0.55; cursor: pointer;'"
    >
      <!-- Thumbnail -->
      <template x-if="cardImage(rec.scryfall_id)">
        <img
          :src="cardImage(rec.scryfall_id)"
          :alt="cardName(rec.scryfall_id)"
          class="cf-card-img"
          style="width: 48px; height: 67px; object-fit: cover; flex-shrink: 0;"
          loading="lazy"
          onerror="this.style.visibility='hidden'"
        />
      </template>
      <template x-if="!cardImage(rec.scryfall_id)">
        <div style="width: 48px; height: 67px; flex-shrink: 0; background: #1C1F28; border: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: center;">
          <span class="material-symbols-outlined" style="font-size: 20px; color: #4A5064;">style</span>
        </div>
      </template>

      <!-- Text body -->
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px;">
        <span style="display: flex; align-items: center; gap: 6px; min-width: 0;">
          <span
            style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
            x-text="cardName(rec.scryfall_id)"
          ></span>
          <template x-if="rec.source === 'combo'">
            <span class="combo-badge material-symbols-outlined" title="Combo piece">bolt</span>
          </template>
          <template x-if="rec.source === 'synergy'">
            <span class="material-symbols-outlined" title="Synergy" style="color:#0D52BD; font-size:16px;">hub</span>
          </template>
        </span>
        <span
          x-show="rec.reasoning"
          style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.45;"
          x-text="rec.reasoning"
        ></span>
        <!-- Explicit ADD / SKIP — immediate: ADD writes the card to the deck
             and drops it from the list; SKIP just drops it. .stop so tapping
             a button never opens the card preview. -->
        <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 4px;">
          <button type="button" @click.stop="$store.deckgen.addRecommendation(rec.scryfall_id)" :style="btnAdd(true)">✓ Add</button>
          <button type="button" @click.stop="$store.deckgen.skipRecommendation(rec.scryfall_id)" :style="btnSkip(false)">✕ Skip</button>
        </div>
      </div>
    </div>
  `;

  return `
    <template x-for="group in groupedByRole" :key="group.role">
      <div style="margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; font-weight: 700; color: #0D52BD; text-transform: uppercase;"
            x-text="group.role.replace(/_/g, ' ')"
          ></span>
          <span
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498;"
            x-text="\`(\${group.cards.length})\`"
          ></span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <template x-for="rec in group.cards" :key="rec.scryfall_id">
            ${cardRow}
          </template>
        </div>
      </div>
    </template>

    <!-- ALSO WORTH IT — enrichment extras (source set, not auto-approved). -->
    <template x-if="($store.deckgen?.recommendations || []).some(r => r.source && r.approved === false)">
      <div style="margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; font-weight: 700; color: #0D52BD; text-transform: uppercase;"
          >ALSO WORTH IT</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <template x-for="rec in ($store.deckgen?.recommendations || []).filter(r => r.source && r.approved === false)" :key="rec.scryfall_id">
            ${cardRow}
          </template>
        </div>
      </div>
    </template>
  `;
}
