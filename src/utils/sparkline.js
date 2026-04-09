/**
 * Render a mini SVG sparkline from an array of price values.
 * @param {number[]} prices - Array of numeric values
 * @param {number} width - SVG width in pixels
 * @param {number} height - SVG height in pixels
 * @returns {string} SVG markup string, or empty string if insufficient data
 */
export function renderSparkline(prices, width = 120, height = 32) {
  if (!prices || prices.length < 2) return '';

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1; // avoid division by zero

  const padding = 2;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  // Build polyline points
  const points = prices.map((val, i) => {
    const x = padding + (i / (prices.length - 1)) * drawWidth;
    const y = padding + drawHeight - ((val - min) / range) * drawHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pointsStr = points.join(' ');

  // Determine colour based on trend (last vs first)
  const isPositive = prices[prices.length - 1] >= prices[0];
  const strokeColour = isPositive ? '#2ECC71' : '#E23838';
  const gradientId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  // Build fill polygon (line + close to bottom)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const fillPoints = `${pointsStr} ${width - padding},${height - padding} ${padding},${height - padding}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${strokeColour}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${strokeColour}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <polygon points="${fillPoints}" fill="url(#${gradientId})"/>
  <polyline points="${pointsStr}" fill="none" stroke="${strokeColour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
