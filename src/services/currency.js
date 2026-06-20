/**
 * Currency conversion service.
 * Fetches EUR→GBP exchange rate once per session from a free API.
 * Falls back to a reasonable static rate if the fetch fails.
 */

const CACHE_KEY = 'counterflux_eur_gbp_rate';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Audit fix #4: single source of truth for the static EUR→GBP fallback,
// previously duplicated as a `0.86` literal across four call sites (drift risk).
export const FALLBACK_EUR_GBP_RATE = 0.86;

// Sanity bounds for an EUR→GBP rate. A poisoned cache or bad upstream response
// (string, 0, NaN, absurd magnitude) would otherwise propagate into every
// monetary figure (audit L3). EUR→GBP has sat ~0.83–0.90 for years; 0.5–1.5 is
// a generous guard that still rejects garbage.
const MIN_RATE = 0.5;
const MAX_RATE = 1.5;

let _rate = null;
// When the in-memory rate was set (epoch ms). Drives the staleness re-fetch
// (audit L5) — a long-running session previously memoised the rate forever.
let _rateLoadedAt = 0;
// True once we've had to fall back to the static rate (live fetch failed).
// Lets callers mark prices as approximate ("~£") when on the fallback.
let _usingFallback = false;

/** Coerce + sanity-check a candidate rate; returns the number or null. */
function _validRate(r) {
  const n = Number(r);
  return Number.isFinite(n) && n >= MIN_RATE && n <= MAX_RATE ? n : null;
}

/**
 * Get the current EUR→GBP exchange rate.
 * Returns the in-memory rate while fresh, else the localStorage cache, else
 * fetches; falls back to a validated static rate. Re-fetches once the in-memory
 * rate is older than the cache TTL so long sessions don't drift (audit L5).
 * @returns {Promise<number>}
 */
export async function getEurToGbpRate() {
  if (_rate !== null && (Date.now() - _rateLoadedAt) < CACHE_EXPIRY_MS) return _rate;

  // Check localStorage cache (validate it — audit L3)
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      const v = _validRate(cached.rate);
      if (v !== null) {
        _rate = v;
        _usingFallback = false;
        _rateLoadedAt = Date.now();
        return _rate;
      }
    }
  } catch { /* ignore parse errors */ }

  // Fetch fresh rate (validate it — audit L3)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR');
    if (res.ok) {
      const data = await res.json();
      const v = _validRate(data?.rates?.GBP);
      if (v !== null) {
        _rate = v;
        _usingFallback = false;
        _rateLoadedAt = Date.now();
        // Cache write is best-effort — a storage failure (private mode, quota,
        // no localStorage) must NOT discard an otherwise-valid live rate, which
        // is what the old unguarded setItem-before-return did.
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: _rate, timestamp: Date.now() }));
        } catch { /* storage unavailable — rate is still valid in memory */ }
        return _rate;
      }
    }
  } catch { /* network error — use fallback */ }

  // Static fallback
  _rate = FALLBACK_EUR_GBP_RATE;
  _usingFallback = true;
  _rateLoadedAt = Date.now();
  return _rate;
}

/** Test-only reset of the in-memory rate memo. Not for production use. */
export function __resetRateForTests() {
  _rate = null;
  _usingFallback = false;
  _rateLoadedAt = 0;
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
  const gbp = num * (_rate || FALLBACK_EUR_GBP_RATE);
  return '£' + gbp.toFixed(2);
}

/**
 * Convert a EUR numeric value to GBP numeric value.
 * @param {number} eurValue
 * @returns {number}
 */
export function eurToGbpValue(eurValue) {
  if (!eurValue || isNaN(eurValue)) return 0;
  return eurValue * (_rate || FALLBACK_EUR_GBP_RATE);
}

/**
 * Get the current rate (synchronous, returns null if not yet loaded).
 * @returns {number|null}
 */
export function getCurrentRate() {
  return _rate;
}

/**
 * True when the live rate fetch failed and we're using the static fallback —
 * lets price surfaces mark figures as approximate ("~£") rather than implying
 * a live-rate precision they don't have.
 * @returns {boolean}
 */
export function isRateFallback() {
  return _usingFallback;
}
