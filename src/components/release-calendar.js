/**
 * Release calendar component for the Preordain screen.
 *
 * Renders a vertical timeline of upcoming and recently released MTG sets
 * using data from $store.market.sets.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderReleaseCalendar() {
  return `
    <div x-data="{
      formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        return day + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
      },
      isReleased(dateStr) {
        if (!dateStr) return false;
        return new Date(dateStr).getTime() <= Date.now();
      },
      get sortedSets() {
        // Phase 14.07b — newest-first throughout the release calendar.
        // Upcoming list reads top-down as furthest-future → soonest; released
        // list reads top-down as most-recent → oldest. Matches the dropdown
        // ordering and matches the v1.2-merged direction.
        return [...$store.market.sets].sort((a, b) =>
          new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
        );
      },
      get releasedSets() {
        return this.sortedSets.filter(s => this.isReleased(s.released_at));
      },
      get upcomingSets() {
        return this.sortedSets.filter(s => !this.isReleased(s.released_at));
      }
    }" class="flex flex-col gap-[8px]">

      <!-- Header -->
      <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
            style="color: #7A8498;">UPCOMING RELEASES</span>

      <!-- Timeline container -->
      <div class="overflow-y-auto flex flex-col" style="max-height: 200px;">

        <!-- Released sets (dimmed) -->
        <template x-for="(set, idx) in releasedSets" :key="'r-' + set.code">
          <div class="flex items-center gap-[16px] py-[8px] pl-[8px] relative"
               style="border-left: 2px solid #2A2D3A;">
            <!-- Date column -->
            <span class="font-mono text-[11px] tracking-[0.15em] shrink-0 w-[100px]"
                  style="color: #4A5064;"
                  x-text="formatDate(set.released_at)"></span>
            <!-- Set info -->
            <div class="flex items-center gap-[8px] min-w-0">
              <i :class="'ss ss-' + set.code.toLowerCase() + ' ss-2x ss-default'"
                 style="color: #4A5064;"></i>
              <div class="flex flex-col min-w-0">
                <span class="text-[14px] leading-[1.3] truncate"
                      style="font-family: 'Space Grotesk', sans-serif; color: #4A5064;"
                      x-text="set.name"></span>
                <span class="font-mono uppercase text-[11px] tracking-[0.15em]"
                      style="color: #4A5064;"
                      x-text="(set.set_type || '').toUpperCase()"></span>
              </div>
            </div>
          </div>
        </template>

        <!-- Divider between released and upcoming -->
        <template x-if="releasedSets.length > 0 && upcomingSets.length > 0">
          <div class="flex items-center gap-[8px] py-[4px]">
            <div class="flex-1 h-px" style="background: #2A2D3A;"></div>
            <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold shrink-0"
                  style="color: #7A8498;">UPCOMING</span>
            <div class="flex-1 h-px" style="background: #2A2D3A;"></div>
          </div>
        </template>

        <!-- Upcoming sets (bright) -->
        <template x-for="(set, idx) in upcomingSets" :key="'u-' + set.code">
          <div class="flex items-center gap-[16px] py-[8px] pl-[8px] relative"
               style="border-left: 2px solid #2A2D3A;">
            <!-- Date column -->
            <span class="font-mono text-[11px] tracking-[0.15em] shrink-0 w-[100px]"
                  style="color: #EAECEE;"
                  x-text="formatDate(set.released_at)"></span>
            <!-- Set info -->
            <div class="flex items-center gap-[8px] min-w-0">
              <i :class="'ss ss-' + set.code.toLowerCase() + ' ss-2x ss-default'"
                 style="color: #EAECEE;"></i>
              <div class="flex flex-col min-w-0">
                <span class="text-[14px] leading-[1.3] truncate"
                      style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;"
                      x-text="set.name"></span>
                <span class="font-mono uppercase text-[11px] tracking-[0.15em]"
                      style="color: #7A8498;"
                      x-text="(set.set_type || '').toUpperCase()"></span>
              </div>
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <template x-if="$store.market.sets.length === 0">
          <div class="py-[16px] text-center">
            <span class="font-mono text-[11px] tracking-[0.15em]"
                  style="color: #7A8498;">Loading set data...</span>
          </div>
        </template>

      </div>
    </div>
  `;
}
