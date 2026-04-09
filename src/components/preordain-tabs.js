/**
 * Tab bar component for the Preordain (Market Intel) screen.
 *
 * Three tabs: SPOILERS, WATCHLIST, MOVERS.
 * Active tab uses .tab-active class, inactive uses .tab-inactive.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderPreordainTabs() {
  const tabs = [
    { id: 'spoilers', label: 'SPOILERS' },
    { id: 'watchlist', label: 'WATCHLIST' },
    { id: 'movers', label: 'MOVERS' },
  ];

  const tabButtons = tabs.map(tab => `
    <button
      @click="$store.market.setTab('${tab.id}')"
      :class="$store.market.activeTab === '${tab.id}' ? 'tab-active' : 'tab-inactive'"
      class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
      style="border-top: none; border-left: none; border-right: none;"
    >${tab.label}</button>
  `).join('');

  return `
    <div x-data class="flex items-center gap-[16px] pb-[8px]"
         style="border-bottom: 1px solid #2A2D3A;">
      ${tabButtons}
    </div>
  `;
}
