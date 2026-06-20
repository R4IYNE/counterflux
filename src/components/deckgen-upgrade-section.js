/**
 * Phase 19 (v1.3) — Preordain "Upgrade Available" section.
 *
 * Slots above the existing Spoilers / Watchlist / Movers tabs on the
 * Preordain (Market Intel) screen. Surfaces undismissed upgrade
 * recommendations from counterflux.deckgen_recommendations — same data
 * source as the Dashboard widget, different presentation (denser,
 * commerce-oriented framing).
 *
 * Visible only when at least one undismissed recommendation exists.
 * Empty state collapses to nothing — Preordain is information-dense and
 * we don't want to add empty noise.
 */

export function renderDeckgenUpgradeSection() {
  return `
    <div
      x-data="{
        loading: true,
        recommendations: [],
        async load() {
          this.loading = true;
          try {
            const { fetchUndismissedRecommendations } = await import('../services/deckgen-recommendations.js');
            this.recommendations = await fetchUndismissedRecommendations();
          } catch {
            this.recommendations = [];
          }
          this.loading = false;
        },
        async dismiss(id) {
          const { dismissRecommendation } = await import('../services/deckgen-recommendations.js');
          const ok = await dismissRecommendation(id);
          if (ok) {
            this.recommendations = this.recommendations.filter(r => r.id !== id);
          }
        }
      }"
      x-init="load()"
      x-show="!loading && recommendations.length > 0"
      x-cloak
      style="background: #14161C; border: 1px solid #2A2D3A; padding: 16px 20px; margin-bottom: 24px;"
    >
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="material-symbols-outlined" style="color: var(--color-primary-text, #5B9BF5); font-size: 18px;">auto_awesome</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-primary-text, #5B9BF5); text-transform: uppercase;">
            UPGRADE AVAILABLE
          </span>
          <span
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase;"
            x-text="recommendations.length + ' DECK' + (recommendations.length === 1 ? '' : 'S')"
          ></span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <template x-for="rec in recommendations.slice(0, 3)" :key="rec.id">
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid #2A2D3A;">
            <div style="flex: 1; min-width: 0;">
              <div
                style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                x-text="rec.recommendations?.message || 'New cards available.'"
              ></div>
              <div
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase; margin-top: 2px;"
                x-text="(rec.recommendations?.trigger_sets || []).slice(0, 4).map(s => (s.code || '').toUpperCase()).join(' · ')"
              ></div>
            </div>
            <button
              @click="
                $store.deckgen?.queueAction({ deckId: rec.deck_id, action: 'upgrade' });
                if (window.__counterflux_router) window.__counterflux_router.navigate('/thousand-year-storm');
              "
              style="padding: 4px 10px; background: transparent; color: var(--color-primary-text, #5B9BF5); border: 1px solid #0D52BD; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;"
            >REVIEW</button>
            <button
              @click="dismiss(rec.id)"
              style="padding: 4px 10px; background: transparent; color: #7A8498; border: 1px dashed #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;"
            >DISMISS</button>
          </div>
        </template>
      </div>

      <template x-if="recommendations.length > 3">
        <div
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase; margin-top: 12px;"
          x-text="'+' + (recommendations.length - 3) + ' MORE — VIEW ALL ON DASHBOARD'"
        ></div>
      </template>
    </div>
  `;
}
