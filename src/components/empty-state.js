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
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 24px; text-align: center; width: 100%;">
      <img
        src="/assets/assetsmila-izzet.png"
        alt="Mila -- Izzet Familiar"
        style="width: 96px; height: 96px; object-fit: cover; filter: grayscale(1) opacity(0.5);"
      >
      <h2 style="font-family: var(--font-header); font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0;">
        ${heading}
      </h2>
      <p style="font-family: var(--font-body); font-size: 14px; line-height: 1.5; color: var(--color-text-muted); margin: 0; max-width: 28rem; width: 100%;">
        ${body}
      </p>
    </div>
  `;
}
