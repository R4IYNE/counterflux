/**
 * Brew review — card-stack body (retune / upgrade swap mode).
 *
 * Replaces the old inline swap-pair list with a one-card-at-a-time stack:
 * the current swap (OUT → IN) is shown large, and the user applies or skips
 * it via on-card buttons, the arrow keys (→ apply, ← skip), or a touch swipe.
 * A running "n / total" counter sits above the card; tapping the card art
 * opens the card-flyout detail. When the user reaches the end, a commit
 * summary shows the approved count and a Commit button.
 *
 * Unlike brew-review-list.js (which runs inside the SHELL's x-data scope),
 * this component declares its OWN x-data because it owns local `idx` state.
 * That means the shell's cardName/cardImage helpers are NOT in scope here, so
 * a minimal copy lives on this component's x-data — hydrated the same way the
 * shell does (window.__cf_db → db.cards). Card art degrades gracefully to a
 * role-badge placeholder when no print metadata is cached locally.
 *
 * IMPORTANT (260614 x-data truncation guard): this whole object is the value
 * of a double-quoted x-data="..." attribute. ANY ASCII double-quote in here —
 * even inside a comment — truncates the attribute and breaks the component.
 * Single-quote everything; use U+2019 for in-word apostrophes.
 */
export function renderBrewReviewStack() {
  return `
    <div
      data-stack-root
      tabindex="0"
      x-data="{
        idx: 0,
        cardMetaCache: {},
        _touchX: null,
        cur() { return ($store.deckgen?.recommendations || [])[this.idx]; },
        total() { return ($store.deckgen?.recommendations || []).length; },
        async hydrateCardMeta() {
          const db = window.__cf_db;
          if (!db) return;
          const recs = $store.deckgen?.recommendations || [];
          const wanted = new Set();
          for (const r of recs) {
            if (r.scryfall_id) wanted.add(r.scryfall_id);
            if (r.swap_out) wanted.add(r.swap_out);
          }
          const ids = [...wanted].filter(id => !this.cardMetaCache[id]);
          if (ids.length === 0) return;
          try {
            const rows = await db.cards.where('id').anyOf(ids).toArray();
            for (const r of rows) {
              this.cardMetaCache = { ...this.cardMetaCache, [r.id]: r };
            }
          } catch {}
        },
        cardName(id) {
          const meta = this.cardMetaCache[id];
          return meta?.name || id || '';
        },
        cardImage(id) {
          const meta = this.cardMetaCache[id];
          return meta?.image_uris?.normal || meta?.image_uris?.small || meta?.card_faces?.[0]?.image_uris?.normal || '';
        },
        apply() { const c = this.cur(); if (c) $store.deckgen.setApproval(c.scryfall_id, true); this.idx++; },
        skip() { const c = this.cur(); if (c) $store.deckgen.setApproval(c.scryfall_id, false); this.idx++; },
        onTouchStart(e) { this._touchX = e.changedTouches?.[0]?.clientX ?? null; },
        onTouchEnd(e) {
          if (this._touchX === null) return;
          const endX = e.changedTouches?.[0]?.clientX ?? this._touchX;
          const dx = endX - this._touchX;
          this._touchX = null;
          if (Math.abs(dx) < 40) return;
          if (dx > 0) this.apply(); else this.skip();
        },
        openDetail() {
          const c = this.cur();
          if (!c) return;
          $dispatch('card-flyout', { card: this.cardMetaCache[c.scryfall_id] });
        },
        get approvedCount() {
          return ($store.deckgen?.recommendations || []).filter(r => r.approved).length;
        },
        async commit() {
          const result = await $store.deckgen.commitApproved();
          if (!result?.ok && result?.message) {
            $store.toast?.error?.(result.message);
          }
        }
      }"
      x-init="hydrateCardMeta()"
      x-effect="($store.deckgen?.status === 'reviewing') && hydrateCardMeta()"
      @keydown.window="if ($event.key === 'ArrowRight') { apply(); } else if ($event.key === 'ArrowLeft') { skip(); }"
      style="flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; outline: none;"
    >
      <!-- Current swap -->
      <template x-if="idx < total()">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 560px;">

          <!-- n / total counter -->
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.18em; color: #7A8498; text-transform: uppercase;">
            <span x-text="(idx + 1) + ' / ' + total()"></span>
          </div>

          <!-- Swap card -->
          <div
            @touchstart="onTouchStart($event)"
            @touchend="onTouchEnd($event)"
            style="position: relative; width: 100%; display: flex; align-items: stretch; gap: 16px; padding: 20px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.4);"
          >
            <!-- Source icon -->
            <template x-if="cur()?.source === 'combo'">
              <span class="combo-badge material-symbols-outlined" title="Combo piece">bolt</span>
            </template>
            <template x-if="cur()?.source === 'synergy'">
              <span class="material-symbols-outlined" title="Synergy" style="position: absolute; top: 8px; right: 8px; z-index: 10; color: #0D52BD; font-size: 18px;">hub</span>
            </template>

            <!-- OUT (card being removed) -->
            <template x-if="cur()?.swap_out">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; align-items: center;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #E23838; text-transform: uppercase;">OUT</span>
                <template x-if="cardImage(cur().swap_out)">
                  <img
                    :src="cardImage(cur().swap_out)"
                    :alt="cardName(cur().swap_out)"
                    class="cf-card-img"
                    style="width: 100%; max-width: 180px; aspect-ratio: 5 / 7; object-fit: cover; filter: grayscale(0.3) opacity(0.8);"
                    loading="lazy"
                    onerror="this.style.visibility='hidden'"
                  />
                </template>
                <template x-if="!cardImage(cur().swap_out)">
                  <div style="width: 100%; max-width: 180px; aspect-ratio: 5 / 7; background: #1C1F28; border: 1px solid #2A2D3A;"></div>
                </template>
                <span
                  style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #EAECEE; text-align: center; text-decoration: line-through; text-decoration-color: #E23838;"
                  x-text="cardName(cur().swap_out)"
                ></span>
              </div>
            </template>

            <!-- Arrow + role -->
            <template x-if="cur()?.swap_out">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0;">
                <span class="material-symbols-outlined" style="font-size: 24px; color: #0D52BD;">east</span>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; color: #4A5064; text-transform: uppercase;" x-text="(cur()?.role || '').replace(/_/g, ' ')"></span>
              </div>
            </template>

            <!-- IN (card being added) — tap for detail -->
            <div
              @click="openDetail()"
              :data-stack-card="cur()?.scryfall_id"
              style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; align-items: center; cursor: pointer;"
            >
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #2ECC71; text-transform: uppercase;">IN</span>
              <template x-if="cardImage(cur()?.scryfall_id)">
                <img
                  :src="cardImage(cur().scryfall_id)"
                  :alt="cardName(cur().scryfall_id)"
                  class="cf-card-img"
                  style="width: 100%; max-width: 180px; aspect-ratio: 5 / 7; object-fit: cover;"
                  loading="lazy"
                  onerror="this.style.visibility='hidden'"
                />
              </template>
              <template x-if="!cardImage(cur()?.scryfall_id)">
                <div style="width: 100%; max-width: 180px; aspect-ratio: 5 / 7; background: #1C1F28; border: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: center;">
                  <span class="material-symbols-outlined" style="font-size: 28px; color: #4A5064;">style</span>
                </div>
              </template>
              <span
                style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; text-align: center;"
                x-text="cardName(cur()?.scryfall_id)"
              ></span>
            </div>
          </div>

          <!-- Reasoning -->
          <span
            x-show="cur()?.reasoning"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #7A8498; line-height: 1.45; text-align: center; max-width: 480px;"
            x-text="cur()?.reasoning"
          ></span>

          <!-- APPLY / SKIP -->
          <div style="display: flex; gap: 12px; width: 100%; max-width: 360px;">
            <button
              type="button"
              @click="skip()"
              style="flex: 1; padding: 12px; background: transparent; color: #E23838; border: 1px solid #E23838; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            >✕ Skip</button>
            <button
              type="button"
              @click="apply()"
              style="flex: 1; padding: 12px; background: rgba(46,204,113,0.18); color: #2ECC71; border: 1px solid #2ECC71; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            >✓ Apply</button>
          </div>

          <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; color: #4A5064; text-transform: uppercase;">
            ← skip · apply → · swipe or use the buttons
          </div>
        </div>
      </template>

      <!-- Commit summary -->
      <template x-if="idx >= total() && total() > 0">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center;">
          <span class="material-symbols-outlined" style="font-size: 40px; color: #2ECC71;">done_all</span>
          <div style="font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #EAECEE; text-transform: uppercase;">REVIEW COMPLETE</div>
          <div
            style="font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase;"
            x-text="approvedCount + ' OF ' + total() + ' SWAP' + (approvedCount === 1 ? '' : 'S') + ' SELECTED'"
          ></div>
          <div style="display: flex; gap: 8px;">
            <button
              type="button"
              @click="idx = 0"
              style="padding: 12px 16px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            >REVIEW AGAIN</button>
            <button
              type="button"
              @click="commit()"
              :disabled="approvedCount === 0 || $store.deckgen?.status === 'committing' || !$store.deckgen?.streamComplete"
              :style="(approvedCount > 0 && $store.deckgen?.status !== 'committing' && $store.deckgen?.streamComplete)
                ? 'padding: 12px 16px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
                : 'padding: 12px 16px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'"
              x-text="$store.deckgen?.status === 'committing' ? 'WORKING…' : ('APPLY ' + approvedCount + ' SWAP' + (approvedCount === 1 ? '' : 'S'))"
            ></button>
          </div>
        </div>
      </template>
    </div>
  `;
}
