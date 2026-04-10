/**
 * Reusable empty state renderer.
 *
 * Shows Mila (grayscale) with a heading and body message.
 * Used by locked/placeholder screens.
 *
 * @param {HTMLElement} container - Element to render into
 * @param {Object} options
 * @param {string} options.heading - Empty state heading (Syne 20px)
 * @param {string} options.body - Empty state body text (Space Grotesk 14px)
 */
export function renderEmptyState(container, { heading, body }) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-lg text-center">
      <img
        src="/assets/assetsmila-izzet.png"
        alt="Mila -- Izzet Familiar"
        class="w-24 h-24 object-cover"
        style="filter: grayscale(1) opacity(0.5);"
      >
      <h2 class="font-header text-xl font-bold text-text-primary" style="font-size: 20px; line-height: 1.2; letter-spacing: 0.01em;">
        ${heading}
      </h2>
      <p class="font-body text-text-muted w-full max-w-md" style="font-size: 14px; line-height: 1.5;">
        ${body}
      </p>
    </div>
  `;
}
