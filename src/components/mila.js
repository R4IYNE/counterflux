/**
 * Mila avatar component.
 *
 * Mila the Corgi is the system familiar. She appears in the sidebar (40px),
 * in empty states (96px, grayscale), and as a loading indicator (pulse animation).
 */

/**
 * Renders the sidebar variant of Mila (40px, grayscale by default, colour on hover).
 * @param {HTMLElement} container - Element to render into
 */
export function renderMilaSidebar(container) {
  container.innerHTML = `
    <div class="flex items-center gap-sm px-4 py-2">
      <img
        src="/assets/assetsmila-izzet.png"
        alt="Mila -- Izzet Familiar"
        class="w-10 h-10 rounded-full object-cover transition-all duration-300"
        style="filter: grayscale(0.8) brightness(0.7);"
        onmouseenter="this.style.filter='grayscale(0) brightness(1)'"
        onmouseleave="this.style.filter='grayscale(0.8) brightness(0.7)'"
      >
      <span class="font-mono text-text-dim uppercase text-[11px] tracking-[0.15em] font-normal sidebar-label">MILA</span>
    </div>
  `;
}

/**
 * Renders the loading variant of Mila with pulse animation.
 * @param {HTMLElement} container - Element to render into
 */
export function renderMilaLoading(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center">
      <img
        src="/assets/assetsmila-izzet.png"
        alt="Mila is working..."
        class="w-16 h-16 rounded-full object-cover animate-pulse"
      >
    </div>
  `;
}
