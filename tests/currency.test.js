import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getEurToGbpRate,
  isRateFallback,
  __resetRateForTests,
  FALLBACK_EUR_GBP_RATE,
} from '../src/services/currency.js';

const CACHE_KEY = 'counterflux_eur_gbp_rate';

// audit L3 — a poisoned cache or bad upstream response (0, NaN, string, absurd
// magnitude) must not propagate into every monetary figure. getEurToGbpRate
// validates both the fetched and cached value and falls back when out of bounds.
describe('currency: EUR→GBP rate validation (audit L3)', () => {
  beforeEach(() => {
    __resetRateForTests();
    try { localStorage.removeItem(CACHE_KEY); } catch { /* no localStorage */ }
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses a valid fetched rate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { GBP: 0.84 } }) })));
    expect(await getEurToGbpRate()).toBeCloseTo(0.84, 5);
    expect(isRateFallback()).toBe(false);
  });

  it('rejects an absurd magnitude and falls back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { GBP: 9999 } }) })));
    expect(await getEurToGbpRate()).toBe(FALLBACK_EUR_GBP_RATE);
    expect(isRateFallback()).toBe(true);
  });

  it('rejects a zero rate and falls back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { GBP: 0 } }) })));
    expect(await getEurToGbpRate()).toBe(FALLBACK_EUR_GBP_RATE);
    expect(isRateFallback()).toBe(true);
  });

  it('rejects a non-numeric rate and falls back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { GBP: 'garbage' } }) })));
    expect(await getEurToGbpRate()).toBe(FALLBACK_EUR_GBP_RATE);
    expect(isRateFallback()).toBe(true);
  });

  it('ignores a poisoned cache value (still falls back when the fetch fails)', async () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: 'garbage', timestamp: Date.now() }));
    } catch { /* no localStorage in this env — the fetch path still asserts */ }
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await getEurToGbpRate()).toBe(FALLBACK_EUR_GBP_RATE);
    expect(isRateFallback()).toBe(true);
  });
});
