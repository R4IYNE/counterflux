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
          const recs = $store.deckgen?.recommendations || [];
          // 260608-swp: hydrate BOTH the new card and its swap_out
          // counterpart (when present in retune/upgrade modes) so the
          // swap-pair row template can render real names + thumbnails
          // on both sides of the arrow.
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
        get isSwapMode() {
          // True iff every recommendation carries a swap_out — i.e.
          // we're in retune or upgrade mode. Mixed responses fall back
          // to the plain add-row template so swap rows aren't shown for
          // cards that lack a swap_out target.
          const recs = $store.deckgen?.recommendations || [];
          if (recs.length === 0) return false;
          return recs.every(r => !!r.swap_out);
        },
        get titleText() {
          // Single-quoted strings only. This whole object is the value of a
          // double-quoted x-data attribute, so ANY ASCII double-quote in here
          // (even inside a comment) truncates the attribute and breaks the
          // component. The apostrophe below is U+2019 so the single-quoted
          // string is not cut mid-word. (Guarded by deckgen-review-screen.test.js.)
          if (this.isSwapMode) {
            return $store.deckgen?.mode === 'retune' ? 'YOUR RETUNE' : 'YOUR UPGRADE';
          }
          return 'YOUR BREW';
        },
        get commitButtonText() {
          const count = this.approvedCount;
          if ($store.deckgen?.status === 'committing') return 'WORKING…';
          if (this.isSwapMode) return 'APPLY ' + count + ' SWAP' + (count === 1 ? '' : 'S');
          return 'ADD ' + count + ' CARDS';
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
        // Per-card ADD / SKIP button styling. The active choice is filled,
        // the other is a muted outline — so the current state is unambiguous.
        btnAdd(approved) {
          const base = 'flex: 1; padding: 6px 10px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid;';
          return approved
            ? base + ' background: rgba(46,204,113,0.18); color: #2ECC71; border-color: #2ECC71;'
            : base + ' background: transparent; color: #4A5064; border-color: #2A2D3A;';
        },
        btnSkip(approved) {
          const base = 'flex: 1; padding: 6px 10px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid;';
          return !approved
            ? base + ' background: rgba(226,56,56,0.15); color: #E23838; border-color: #E23838;'
            : base + ' background: transparent; color: #4A5064; border-color: #2A2D3A;';
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
          <span class="material-symbols-outlined" style="color: #0D52BD; font-size: 28px;" x-text="isSwapMode ? 'tune' : 'auto_awesome'"></span>
          <div>
            <h2
              style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; margin: 0; text-transform: uppercase; letter-spacing: 0.01em;"
              x-text="titleText"
            ></h2>
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
            x-text="commitButtonText"
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

            <!-- 260608-swp: swap-pair row template (retune/upgrade modes)
                 — shows the card being removed on the left, an arrow, the
                 card being added on the right. Plain add-row template
                 below is unchanged for plain brew mode. -->
            <div class="grid grid-cols-1 gap-[12px]" x-show="isSwapMode">
              <template x-for="rec in group.cards" :key="rec.scryfall_id">
                <div
                  :style="rec.approved
                    ? 'display: flex; align-items: stretch; gap: 12px; padding: 12px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.4);'
                    : 'display: flex; align-items: stretch; gap: 12px; padding: 12px; background: transparent; border: 1px solid #2A2D3A; opacity: 0.55;'"
                >
                  <!-- Swap-out side (current card) -->
                  <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #E23838; text-transform: uppercase;">
                      OUT
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <template x-if="cardImage(rec.swap_out)">
                        <img
                          :src="cardImage(rec.swap_out)"
                          :alt="cardName(rec.swap_out)"
                          class="cf-card-img"
                          style="width: 36px; height: 50px; object-fit: cover; flex-shrink: 0; filter: grayscale(0.3) opacity(0.8);"
                          loading="lazy"
                          onerror="this.style.visibility='hidden'"
                        />
                      </template>
                      <template x-if="!cardImage(rec.swap_out)">
                        <div style="width: 36px; height: 50px; flex-shrink: 0; background: #1C1F28; border: 1px solid #2A2D3A;"></div>
                      </template>
                      <span
                        style="flex: 1; min-width: 0; font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: line-through; text-decoration-color: #E23838; text-decoration-thickness: 1px;"
                        x-text="cardName(rec.swap_out)"
                      ></span>
                    </div>
                  </div>

                  <!-- Arrow + role between the two cards -->
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; padding: 0 4px;">
                    <span class="material-symbols-outlined" style="font-size: 20px; color: #0D52BD;">east</span>
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; color: #4A5064; text-transform: uppercase;" x-text="(rec.role || '').replace(/_/g, ' ')"></span>
                  </div>

                  <!-- Swap-in side (new card) -->
                  <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: #2ECC71; text-transform: uppercase;">
                      IN
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <template x-if="cardImage(rec.scryfall_id)">
                        <img
                          :src="cardImage(rec.scryfall_id)"
                          :alt="cardName(rec.scryfall_id)"
                          class="cf-card-img"
                          style="width: 36px; height: 50px; object-fit: cover; flex-shrink: 0;"
                          loading="lazy"
                          onerror="this.style.visibility='hidden'"
                        />
                      </template>
                      <template x-if="!cardImage(rec.scryfall_id)">
                        <div style="width: 36px; height: 50px; flex-shrink: 0; background: #1C1F28; border: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: center;">
                          <span class="material-symbols-outlined" style="font-size: 14px; color: #4A5064;">style</span>
                        </div>
                      </template>
                      <span
                        style="flex: 1; min-width: 0; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                        x-text="cardName(rec.scryfall_id)"
                      ></span>
                    </div>
                    <span
                      x-show="rec.reasoning"
                      style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.45; margin-top: 4px;"
                      x-text="rec.reasoning"
                    ></span>
                    <!-- Explicit APPLY / SKIP — replaces the old click-to-toggle card -->
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                      <button type="button" @click="$store.deckgen.setApproval(rec.scryfall_id, true)" :style="btnAdd(rec.approved)">✓ Apply</button>
                      <button type="button" @click="$store.deckgen.setApproval(rec.scryfall_id, false)" :style="btnSkip(rec.approved)">✕ Skip</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- Plain add-row template (brew + fill modes) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-[12px]" x-show="!isSwapMode">
              <template x-for="rec in group.cards" :key="rec.scryfall_id">
                <div
                  :style="rec.approved
                    ? 'display: flex; gap: 12px; padding: 12px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.4);'
                    : 'display: flex; gap: 12px; padding: 12px; background: transparent; border: 1px solid #2A2D3A; opacity: 0.55;'"
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
                    <span
                      style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: #EAECEE; overflow: hidden; text-overflow: ellipsis;"
                      x-text="cardName(rec.scryfall_id)"
                    ></span>
                    <span
                      x-show="rec.reasoning"
                      style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.45;"
                      x-text="rec.reasoning"
                    ></span>
                    <!-- Explicit ADD / SKIP — replaces the old click-to-toggle card -->
                    <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 4px;">
                      <button type="button" @click="$store.deckgen.setApproval(rec.scryfall_id, true)" :style="btnAdd(rec.approved)">✓ Add</button>
                      <button type="button" @click="$store.deckgen.setApproval(rec.scryfall_id, false)" :style="btnSkip(rec.approved)">✕ Skip</button>
                    </div>
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
