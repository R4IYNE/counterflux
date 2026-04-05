/**
 * Stats header component for the Treasure Cruise collection screen.
 *
 * Renders four stat boxes: Total Cards, Unique Cards, Estimated Value, Wishlist.
 * Uses Alpine reactive bindings to $store.collection.stats.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderStatsHeader() {
  return `
    <div class="flex items-stretch gap-[32px] p-[24px]"
         style="background: #1C1F28; border-left: 3px solid #0D52BD;">

      <!-- Total Cards -->
      <div class="flex flex-col gap-[4px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">TOTAL CARDS</span>
        <span class="syne-header text-[48px] font-bold leading-[1.1] tracking-[-0.02em]"
              style="color: #0D52BD;"
              x-text="($store.collection.stats.totalCards || 0).toLocaleString()">0</span>
      </div>

      <!-- Unique Cards -->
      <div class="flex flex-col gap-[4px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">UNIQUE CARDS</span>
        <span class="syne-header text-[48px] font-bold leading-[1.1] tracking-[-0.02em]"
              style="color: #0D52BD;"
              x-text="($store.collection.stats.uniqueCards || 0).toLocaleString()">0</span>
      </div>

      <!-- Estimated Value -->
      <div class="flex flex-col gap-[4px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">ESTIMATED VALUE</span>
        <span class="syne-header text-[48px] font-bold leading-[1.1] tracking-[-0.02em]"
              style="color: #0D52BD;"
              x-text="'EUR ' + ($store.collection.stats.estimatedValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })">EUR 0.00</span>
      </div>

      <!-- Wishlist -->
      <div class="flex flex-col gap-[4px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">WISHLIST</span>
        <span class="syne-header text-[48px] font-bold leading-[1.1] tracking-[-0.02em]"
              style="color: #0D52BD;"
              x-text="($store.collection.stats.wishlistCount || 0).toLocaleString()">0</span>
      </div>

    </div>
  `;
}
