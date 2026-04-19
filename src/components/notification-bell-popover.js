/**
 * Notification bell + dropdown popover -- Phase 12 SYNC-08.
 *
 * Unifies sync errors (from market.syncErrorCount, polled every 2s by
 * src/stores/market.js) and price alerts (from market.pendingAlerts)
 * into a single 320px popover anchored below-right of the bell icon.
 *
 * Sync error actions delegate to window.openSyncErrorsModal() -- no
 * inline retry/discard (D-03). Price alert section links to /preordain +
 * switches to watchlist tab via Alpine store setTab.
 *
 * Dismissal contract (Pattern 2):
 *   - @click on bell toggles open flag
 *   - @click.outside on popover surface closes it
 *   - @keydown.escape.window closes it (guarded by `if (open)` per Pitfall 4
 *     to avoid swallowing Escape for other consumers when already closed)
 *
 * Initial-render flash mitigation (Pitfall 6): x-cloak on the popover
 * surface so it stays hidden until Alpine attaches.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderNotificationBellPopover() {
  return `
    <div x-data="{ open: false }" class="relative">
      <button
        @click="open = !open"
        class="text-text-muted hover:text-text-primary transition-colors relative"
        aria-label="Notifications"
        :aria-expanded="open"
      >
        <span class="material-symbols-outlined text-2xl">notifications</span>
        <span
          x-show="$store.market && $store.market.unifiedBadgeCount > 0"
          x-text="$store.market?.unifiedBadgeCount"
          class="absolute -top-1 -right-1 cf-badge-alert flex items-center justify-center font-mono text-text-primary"
          style="font-size: 9px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 50%; padding: 0 2px;"
        ></span>
      </button>

      <div
        x-cloak
        x-show="open"
        x-transition.origin.top.right
        @click.outside="open = false"
        @keydown.escape.window="if (open) open = false"
        class="cf-bell-popover absolute right-0 top-full mt-[8px] w-[320px] max-h-[480px] overflow-y-auto"
        style="background: var(--color-surface); border: 1px solid var(--color-border-ghost); z-index: 50;"
        role="menu"
        aria-label="Notifications"
      >
        <!-- SYNC ERRORS section -- gated on polled count; delegates to Phase 11 modal -->
        <div
          x-show="$store.market.syncErrorCount > 0"
          class="px-[16px] py-[12px]"
          style="border-bottom: 1px solid var(--color-border-ghost);"
        >
          <span
            class="font-mono uppercase text-[11px] tracking-[0.15em]"
            style="color: #7A8498;"
          >SYNC ERRORS</span>
          <div class="mt-[8px] flex items-center justify-between">
            <span
              class="text-[14px]"
              style="color: var(--color-text-primary);"
              x-text="\`\${$store.market.syncErrorCount} operation\${$store.market.syncErrorCount === 1 ? '' : 's'} failed\`"
            ></span>
            <button
              @click="open = false; window.openSyncErrorsModal && window.openSyncErrorsModal()"
              class="font-mono uppercase text-[11px] tracking-[0.15em] cursor-pointer"
              style="color: var(--color-primary); background: transparent; border: none;"
            >VIEW SYNC ERRORS →</button>
          </div>
        </div>

        <!-- PRICE ALERTS section -- lists pending alerts with watchlist navigation footer -->
        <div x-show="$store.market.pendingAlerts.length > 0" class="px-[16px] py-[12px]">
          <span
            class="font-mono uppercase text-[11px] tracking-[0.15em]"
            style="color: #7A8498;"
          >PRICE ALERTS</span>
          <ul class="mt-[8px] flex flex-col gap-[8px]">
            <template
              x-for="alert in $store.market.pendingAlerts"
              :key="alert.card_name + alert.threshold_eur"
            >
              <li class="flex flex-col gap-[2px]">
                <span
                  class="text-[14px]"
                  style="color: var(--color-text-primary);"
                  x-text="alert.card_name"
                ></span>
                <span
                  class="font-mono text-[11px] tracking-[0.15em]"
                  style="color: #7A8498;"
                  x-text="\`dropped to €\${alert.current_eur} — below €\${alert.threshold_eur}\`"
                ></span>
              </li>
            </template>
          </ul>
          <div class="mt-[12px] text-right">
            <button
              @click="open = false; window.__counterflux_router && window.__counterflux_router.navigate('/preordain'); $store.market.setTab('watchlist')"
              class="font-mono uppercase text-[11px] tracking-[0.15em] cursor-pointer"
              style="color: var(--color-primary); background: transparent; border: none;"
            >GO TO WATCHLIST →</button>
          </div>
        </div>

        <!-- Empty state -- rendered when both sources are zero -->
        <div
          x-show="$store.market.unifiedBadgeCount === 0"
          class="px-[16px] py-[32px] text-center"
        >
          <span
            class="font-mono uppercase text-[11px] tracking-[0.15em]"
            style="color: #7A8498;"
          >All clear</span>
        </div>
      </div>
    </div>
  `;
}
