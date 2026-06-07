/**
 * Phase 18 (v1.3) — Brew review screen.
 *
 * Renders once $store.deckgen.status === 'reviewing'. Lists each recommended
 * card with its role label, Claude's reasoning paragraph, and an approve/
 * reject toggle. Defaults to all-approved (per PRD Open Question #1) so
 * the happy path is "click commit" — but the master REJECT ALL chip is
 * one click away if the user wants to flip the default.
 *
 * Commit fires $store.deckgen.commitApproved() which writes the approved
 * cards to the active deck atomically and triggers a single undo entry.
 *
 * Card thumbnails are best-effort — image lookups go through db.cards
 * (already populated for collection cards) and fall through to the role
 * badge as a placeholder when no print metadata exists locally.
 */

export function renderDeckgenReviewScreen() {
  return `
    <div
      x-data="{
        cardMetaCache: {},
        async hydrateCardMeta() {
          // Alpine x-data runs in global scope — dynamic ES imports with
          // relative paths don't resolve here. Use the window-exposed db
          // handle (main.js line 98: window.__cf_db = db) instead, matching
          // the precon-browser pattern from 260519-pct.
          const db = window.__cf_db;
          if (!db) return;
          const ids = ($store.deckgen?.recommendations || [])
            .map(r => r.scryfall_id)
            .filter(id => !this.cardMetaCache[id]);
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
          return meta?.name || id;
        },
        cardImage(id) {
          const meta = this.cardMetaCache[id];
          return meta?.image_uris?.small || meta?.card_faces?.[0]?.image_uris?.small || '';
        },
        cardManaCost(id) {
          const meta = this.cardMetaCache[id];
          return meta?.mana_cost || '';
        },
        get groupedByRole() {
          const recs = $store.deckgen?.recommendations || [];
          const groups = {};
          for (const r of recs) {
            const role = r.role || 'SUPPORT';
            if (!groups[role]) groups[role] = [];
            groups[role].push(r);
          }
          // Preserve a deterministic role order.
          const order = ['LAND', 'RAMP', 'DRAW', 'REMOVAL_SINGLE', 'REMOVAL_SWEEP', 'WIN_CON', 'SUPPORT'];
          return order
            .filter(o => groups[o])
            .map(o => ({ role: o, cards: groups[o] }));
        },
        get approvedCount() {
          return ($store.deckgen?.recommendations || []).filter(r => r.approved).length;
        },
        get rejectedCount() {
          return ($store.deckgen?.recommendations || []).filter(r => !r.approved).length;
        },
        async commit() {
          const result = await $store.deckgen.commitApproved();
          if (!result?.ok && result?.message) {
            $store.toast?.error?.(result.message);
          }
        }
      }"
      x-show="$store.deckgen?.status === 'reviewing' || $store.deckgen?.status === 'committing'"
      x-effect="
        ($store.deckgen?.status === 'reviewing') && hydrateCardMeta()
      "
      x-cloak
      @keydown.escape.window="$store.deckgen.reset()"
      style="position: fixed; inset: 0; z-index: 9000; display: flex; flex-direction: column; background: #0B0C10;"
    >
      <!-- Header -->
      <div style="flex-shrink: 0; padding: 24px 32px; border-bottom: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="material-symbols-outlined" style="color: #0D52BD; font-size: 28px;">auto_awesome</span>
          <div>
            <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; margin: 0; text-transform: uppercase; letter-spacing: 0.01em;">
              MILA'S BREW
            </h2>
            <div
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase; margin-top: 4px;"
              x-text="\`\${$store.deckgen?.recommendations?.length || 0} CARDS RECOMMENDED · \${approvedCount} APPROVED · \${rejectedCount} REJECTED\`"
            ></div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <template x-if="$store.deckgen?.cacheHit">
            <span
              style="padding: 4px 10px; background: rgba(13,82,189,0.15); color: #0D52BD; border: 1px solid #0D52BD; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
              title="Same parameters returned a cached brew — no credits spent."
            >CACHED</span>
          </template>
          <button
            @click="$store.deckgen.approveAll()"
            style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            onmouseenter="this.style.color='#EAECEE'; this.style.borderColor='#0D52BD'"
            onmouseleave="this.style.color='#7A8498'; this.style.borderColor='#2A2D3A'"
          >APPROVE ALL</button>
          <button
            @click="$store.deckgen.rejectAll()"
            style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            onmouseenter="this.style.color='#E23838'; this.style.borderColor='#E23838'"
            onmouseleave="this.style.color='#7A8498'; this.style.borderColor='#2A2D3A'"
          >REJECT ALL</button>
          <button
            @click="$store.deckgen.reset()"
            style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px dashed #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
          >DISCARD</button>
          <button
            @click="commit()"
            :disabled="approvedCount === 0 || $store.deckgen?.status === 'committing'"
            :style="approvedCount > 0 && $store.deckgen?.status !== 'committing'
              ? 'padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
              : 'padding: 8px 16px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'"
            x-text="$store.deckgen?.status === 'committing' ? 'ADDING…' : ('ADD ' + approvedCount + ' CARDS')"
          ></button>
        </div>
      </div>

      <!-- Body -->
      <div style="flex: 1; min-height: 0; overflow-y: auto; padding: 24px 32px;">
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
                <div
                  :style="rec.approved
                    ? 'display: flex; gap: 12px; padding: 12px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.4); cursor: pointer;'
                    : 'display: flex; gap: 12px; padding: 12px; background: transparent; border: 1px solid #2A2D3A; cursor: pointer; opacity: 0.5;'"
                  @click="$store.deckgen.toggleApproval(rec.scryfall_id)"
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
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: flex-start; gap: 8px;">
                      <span
                        style="flex: 1; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; overflow: hidden; text-overflow: ellipsis;"
                        x-text="cardName(rec.scryfall_id)"
                      ></span>
                      <span
                        @click.stop="$store.deckgen.toggleApproval(rec.scryfall_id)"
                        :style="rec.approved
                          ? 'flex-shrink: 0; padding: 2px 6px; background: rgba(46,204,113,0.15); color: #2ECC71; border: 1px solid #2ECC71; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;'
                          : 'flex-shrink: 0; padding: 2px 6px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;'"
                        x-text="rec.approved ? 'APPROVED' : 'REJECTED'"
                      ></span>
                    </div>
                    <span
                      style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.45;"
                      x-text="rec.reasoning"
                    ></span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  `;
}
