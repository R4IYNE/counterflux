/**
 * Currency conversion service.
 * Fetches EUR→GBP exchange rate once per session from a free API.
 * Falls back to a reasonable static rate if the fetch fails.
 */

const CACHE_KEY = 'counterflux_eur_gbp_rate';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

let _rate = null;

/**
 * Get the current EUR→GBP exchange rate.
 * Returns cached value if available and fresh, otherwise fetches.
 * @returns {Promise<number>}
 */
export async function getEurToGbpRate() {
  if (_rate !== null) return _rate;

  // Check localStorage cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      _rate = cached.rate;
      return _rate;
    }
  } catch { /* ignore parse errors */ }

  // Fetch fresh rate
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    if (res.ok) {
      const data = await res.json();
      _rate = data.rates?.GBP || 0.86;
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rate: _rate,
        timestamp: Date.now(),
      }));
      return _rate;
    }
  } catch { /* network error — use fallback */ }

  // Static fallback
  _rate = 0.86;
  return _rate;
}

/**
 * Convert a EUR price string to GBP display string.
 * @param {string|number|null} eurPrice - EUR price (e.g., "12.50" or 12.5)
 * @returns {string} Formatted GBP string (e.g., "£10.75") or "--" if no price
 */
export function eurToGbp(eurPrice) {
  if (eurPrice == null || eurPrice === '') return '--';
  const num = typeof eurPrice === 'string' ? parseFloat(eurPrice) : eurPrice;
  if (isNaN(num) || num === 0) return '--';
  const gbp = num * (_rate || 0.86);
  return '£' + gbp.toFixed(2);
}

/**
 * Convert a EUR numeric value to GBP numeric value.
 * @param {number} eurValue
 * @returns {number}
 */
export function eurToGbpValue(eurValue) {
  if (!eurValue || isNaN(eurValue)) return 0;
  return eurValue * (_rate || 0.86);
}

/**
 * Get the current rate (synchronous, returns null if not yet loaded).
 * @returns {number|null}
 */
export function getCurrentRate() {
  return _rate;
}
