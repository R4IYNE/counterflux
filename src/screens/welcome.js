/**
 * Welcome screen -- hero search landing page.
 * This is the default screen when the app loads.
 * Features a prominent search bar as the primary interaction.
 */
export function mount(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[70vh] gap-xl">

      <!-- Hero heading -->
      <h1 class="font-header text-[48px] font-bold text-text-primary tracking-[-0.02em] leading-[1.1] text-center">
        COUNTERFLUX
      </h1>
      <p class="font-body text-text-muted text-center" style="font-size: 14px; line-height: 1.5; max-width: 480px;">
        Search <span x-text="$store.bulkdata?.totalCards?.toLocaleString() || '...'"></span> cards from the Aetheric Archive
      </p>

      <!-- Hero search bar -->
      <div class="relative w-full max-w-2xl">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-dim text-2xl z-10">search</span>
        <input
          id="global-search-input"
          type="text"
          placeholder="QUERY DATABASE..."
          :value="$store.search.query"
          @input="$store.search.search($event.target.value)"
          @keydown.arrow-down.prevent="$store.search.moveSelection(1)"
          @keydown.arrow-up.prevent="$store.search.moveSelection(-1)"
          @keydown.enter.prevent="$store.search.confirmSelection()"
          @keydown.escape="$store.search.clear(); $el.blur()"
          class="w-full bg-surface border border-border-ghost text-text-primary placeholder-text-dim pl-12 pr-6 py-4 font-mono uppercase text-[14px] tracking-[0.15em] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
          autocomplete="off"
          style="font-size: 14px;"
        >

        <!-- Autocomplete dropdown -->
        <div
          x-show="$store.search.results.length > 0 || ($store.search.loading && $store.search.query.length >= 2) || (!$store.search.loading && $store.search.query.length >= 2 && $store.search.results.length === 0)"
          x-transition:enter="transition ease-out duration-150"
          x-transition:enter-start="opacity-0 -translate-y-1"
          x-transition:enter-end="opacity-100 translate-y-0"
          x-transition:leave="transition ease-in duration-100"
          x-transition:leave-start="opacity-100"
          x-transition:leave-end="opacity-0"
          class="absolute top-full left-0 right-0 mt-1 bg-surface ghost-border aether-glow z-50 max-h-[400px] overflow-y-auto"
          @click.outside="$store.search.clear()"
        >
          <!-- Loading state -->
          <div x-show="$store.search.loading" class="px-4 py-3 flex items-center gap-sm">
            <span class="material-symbols-outlined text-primary text-lg animate-spin">progress_activity</span>
            <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-normal text-text-muted">Searching archive...</span>
          </div>

          <!-- No results -->
          <div
            x-show="!$store.search.loading && $store.search.query.length >= 2 && $store.search.results.length === 0"
            class="px-4 py-3"
          >
            <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-normal text-text-muted">No cards match your query.</span>
          </div>

          <!-- Results list -->
          <template x-for="(result, index) in $store.search.results" :key="result.id">
            <button
              @click="$store.search.selectResult(result)"
              @mouseenter="$store.search.selectedIndex = index"
              :class="$store.search.selectedIndex === index ? 'bg-surface-hover' : ''"
              class="w-full flex items-center gap-sm px-4 py-3 text-left transition-colors duration-100 hover:bg-surface-hover cursor-pointer"
            >
              <!-- Thumbnail -->
              <div class="w-10 h-10 flex-shrink-0 bg-surface-hover overflow-hidden">
                <img
                  :src="result._thumbnail"
                  :alt="result._name"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              </div>
              <!-- Card name -->
              <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold text-text-primary flex-1 truncate" x-text="result._name"></span>
              <!-- Set icon -->
              <i class="ss" :class="'ss-' + result.set" style="font-size: 14px; color: var(--color-text-dim);"></i>
              <!-- Mana cost -->
              <span class="flex items-center gap-[2px] flex-shrink-0" x-html="window.renderManaCost(result._manaCost)"></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Mila greeting -->
      <div class="flex items-center gap-md mt-md">
        <img src="/assets/assetsmila-izzet.png" alt="Mila -- Izzet Familiar" class="w-12 h-12 rounded-full object-cover" style="filter: saturate(0.8);">
        <p class="font-body text-text-dim italic" style="font-size: 14px; line-height: 1.5; max-width: 400px;">
          Mila here! Type a card name or press <kbd class="font-mono text-primary text-[11px] bg-surface px-1 py-0.5 ghost-border">/</kbd> to start searching.
        </p>
      </div>
    </div>
  `;
}
