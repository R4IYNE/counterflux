/**
 * Small stat display card for game history stats.
 * Surface card with ghost border, label above, value below.
 */

/**
 * Render a stat card HTML string with Alpine binding for reactive value.
 * @param {string} label - Uppercase stat label (e.g., 'WIN RATE')
 * @param {string} valueExpr - Alpine expression string for the stat value
 * @returns {string} HTML string with Alpine directives
 */
export function renderGameStatsCard(label, valueExpr) {
  return `
    <div
      class="flex flex-col px-sm py-md"
      style="background: #14161C; border: 1px solid #2A2D3A; min-width: 120px;"
    >
      <span
        style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498; line-height: 1.3;"
      >${label}</span>
      <span
        style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; line-height: 1.2; letter-spacing: 0.01em;"
        x-text="${valueExpr}"
      ></span>
    </div>
  `;
}
