/**
 * Welcome screen -- hero search landing page.
 * This is the default screen when the app loads.
 * Features a prominent search bar as the primary interaction.
 */
export function mount(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; gap: 32px;">

      <!-- Hero heading -->
      <h1 class="font-header text-text-primary" style="font-size: 48px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; text-align: center;">
        COUNTERFLUX
      </h1>
      <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5; text-align: center; max-width: 480px;">
        Search <span x-text="$store.bulkdata?.totalCards?.toLocaleString() || '...'"></span> cards from the Aetheric Archive
      </p>

      <!-- Hero search bar -->
      <div style="position: relative; width: 100%; max-width: 640px;">
        <span class="material-symbols-outlined text-text-dim" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 24px; z-index: 10;">search</span>
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
          autocomplete="off"
          style="width: 100%; background: var(--color-surface, #14161C); border: 1px solid var(--color-border-ghost, #2A2D3A); color: var(--color-text-primary, #E8E6E3); padding: 16px 24px 16px 52px; font-family: 'JetBrains Mono', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; outline: none; transition: border-color 0.2s; box-sizing: border-box;"
          onfocus="this.style.borderColor='var(--color-primary, #0D52BD)'"
          onblur="this.style.borderColor='var(--color-border-ghost, #2A2D3A)'"
        >

        <!-- Autocomplete dropdown -->
        <div
          x-show="$store.search.results.length > 0 || ($store.search.loading && $store.search.query.length >= 2) || (!$store.search.loading && $store.search.query.length >= 2 && $store.search.results.length === 0)"
          x-transition:enter="transition ease-out duration-150"
          x-transition:enter-start="opacity-0"
          x-transition:enter-end="opacity-100"
          @click.outside="$store.search.clear()"
          style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--color-surface, #14161C); border: 1px solid var(--color-border-ghost, #2A2D3A); max-height: 400px; overflow-y: auto; z-index: 50; box-shadow: 0 0 20px rgba(13, 82, 189, 0.1);"
        >
          <!-- Loading state -->
          <div x-show="$store.search.loading" style="padding: 12px 16px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined text-primary" style="font-size: 18px;">progress_activity</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-text-muted, #8A8F98);">Searching archive...</span>
          </div>

          <!-- No results -->
          <div
            x-show="!$store.search.loading && $store.search.query.length >= 2 && $store.search.results.length === 0"
            style="padding: 12px 16px;"
          >
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-text-muted, #8A8F98);">No cards match your query.</span>
          </div>

          <!-- Results list -->
          <template x-for="(result, index) in $store.search.results" :key="result.id">
            <button
              @click="$store.search.selectResult(result)"
              @mouseenter="$store.search.selectedIndex = index"
              :style="$store.search.selectedIndex === index ? 'background: var(--color-surface-hover, #1C1F28);' : ''"
              style="width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 16px; text-align: left; border: none; cursor: pointer; background: transparent; transition: background 0.1s;"
              onmouseenter="this.style.background='var(--color-surface-hover, #1C1F28)'"
              onmouseleave="if (!this.classList.contains('selected')) this.style.background='transparent'"
            >
              <!-- Thumbnail -->
              <div style="width: 36px; height: 36px; flex-shrink: 0; overflow: hidden; background: var(--color-surface-hover, #1C1F28);">
                <img
                  :src="result._thumbnail"
                  :alt="result._name"
                  style="width: 100%; height: 100%; object-fit: cover;"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              </div>
              <!-- Card name -->
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: var(--color-text-primary, #E8E6E3); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" x-text="result._name"></span>
              <!-- Set icon -->
              <i class="ss" :class="'ss-' + result.set" style="font-size: 14px; color: var(--color-text-dim); flex-shrink: 0;"></i>
              <!-- Mana cost -->
              <span style="display: flex; align-items: center; gap: 2px; flex-shrink: 0;" x-html="window.renderManaCost(result._manaCost)"></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Mila greeting -->
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 16px;">
        <img src="/assets/assetsmila-izzet.png" alt="Mila -- Izzet Familiar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; filter: saturate(0.8);">
        <p class="font-body text-text-dim" style="font-size: 14px; line-height: 1.5; max-width: 400px; font-style: italic;">
          Mila here! Type a card name or press <kbd style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--color-primary, #0D52BD); background: var(--color-surface, #14161C); padding: 2px 6px; border: 1px solid var(--color-border-ghost, #2A2D3A);">/</kbd> to start searching.
        </p>
      </div>
    </div>
  `;
}
