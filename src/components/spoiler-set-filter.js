/**
 * Spoiler set-filter custom dropdown — Phase 12 MARKET-01.
 *
 * Replaces the native <select> in spoiler-gallery.js with an Alpine-driven
 * custom dropdown so each option can render a Keyrune set icon (glyphs
 * cannot live inside <option> elements).
 *
 * Design contract (see 12-RESEARCH.md §Pattern 4, 12-CONTEXT.md D-11):
 *   - Pure template-returning function; no imports, no side effects.
 *   - Root element owns `x-data="{ open: false }"` and `.relative` for
 *     absolute-positioned dropdown anchoring.
 *   - Trigger button shows active set's name + (if selected) its Keyrune
 *     glyph; chevron material symbol sits at the right edge.
 *   - Dropdown `<ul>` carries `@click.outside="open = false"` per Pitfall 7
 *     — attaching it to the menu (not the trigger) avoids the
 *     open-then-close race on the opening click.
 *   - `@keydown.escape.window="if (open) open = false"` uses the Pitfall 4
 *     guard so the popover doesn't swallow Escape for other handlers when
 *     already closed.
 *   - Every set option renders `<i class="ss ss-fallback" :class="'ss-' + set.code.toLowerCase()">`
 *     matching precon-browser.js + release-calendar.js precedent; the
 *     `.ss-fallback` class is defence-in-depth (Pitfall 2) for unknown
 *     set codes.
 *   - `x-cloak` on the dropdown prevents Alpine's initial-render flash
 *     (Pitfall 6).
 *
 * Consumers: src/components/spoiler-gallery.js (Plan 12-04 wires this in).
 *
 * @returns {string} HTML string with Alpine x-data bindings
 */
export function renderSpoilerSetFilter() {
  return `
    <div x-data="{ open: false }" class="relative">
      <button
        type="button"
        @click="open = !open"
        class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none flex items-center gap-[8px]"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; min-width: 280px;"
        :aria-expanded="open"
        aria-haspopup="listbox"
      >
        <template x-if="$store.market.activeSet">
          <i class="ss ss-fallback" :class="'ss-' + $store.market.activeSet.toLowerCase()" style="font-size: 18px; color: #EAECEE;"></i>
        </template>
        <span x-text="$store.market.activeSet ? ($store.market.sets.find(s => s.code === $store.market.activeSet)?.name || 'SELECT SET') : 'SELECT SET'"></span>
        <span class="material-symbols-outlined ml-auto" style="font-size: 16px;">expand_more</span>
      </button>

      <ul
        x-cloak
        x-show="open"
        x-transition.origin.top
        @click.outside="open = false"
        @keydown.escape.window="if (open) open = false"
        class="absolute left-0 top-full mt-[4px] w-full max-h-[320px] overflow-y-auto z-30"
        style="background: #1C1F28; border: 1px solid #2A2D3A;"
        role="listbox"
      >
        <template x-for="set in $store.market.sets" :key="set.code">
          <li>
            <button
              type="button"
              @click="$store.market.loadSpoilers(set.code); open = false"
              class="w-full px-[12px] py-[8px] flex items-center gap-[8px] hover:bg-[#2A2D3A] text-left"
              role="option"
            >
              <i class="ss ss-fallback" :class="'ss-' + set.code.toLowerCase()" style="font-size: 18px; color: #EAECEE; flex-shrink: 0;"></i>
              <span class="text-[14px] truncate flex-1" style="color: #EAECEE;" x-text="set.name"></span>
              <span class="font-mono text-[11px] tracking-[0.15em]" style="color: #7A8498;" x-text="'(' + set.card_count + ')'"></span>
            </button>
          </li>
        </template>
      </ul>
    </div>
  `;
}
