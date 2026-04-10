import { describe, it, expect, vi } from 'vitest';
import { eurToGbpValue } from '../src/services/currency.js';
import { renderSparkline } from '../src/utils/sparkline.js';

/**
 * Dashboard portfolio summary computation tests.
 * Tests pure data logic extracted from the dashboard screen.
 */

describe('Portfolio Summary Computations', () => {
  describe('estimatedValue in GBP', () => {
    it('computes total GBP value from EUR prices', () => {
      const entries = [
        { quantity: 1, foil: 0, card: { prices: { eur: '1.50' } } },
        { quantity: 1, foil: 0, card: { prices: { eur: '2.00' } } },
        { quantity: 1, foil: 0, card: { prices: { eur: '3.50' } } },
      ];

      const totalEur = entries.reduce((sum, e) => {
        const price = e.foil
          ? parseFloat(e.card?.prices?.eur_foil || '0')
          : parseFloat(e.card?.prices?.eur || '0');
        return sum + e.quantity * price;
      }, 0);

      expect(totalEur).toBe(7.0);

      const gbpValue = eurToGbpValue(totalEur);
      // With fallback rate 0.86, 7.0 * 0.86 = 6.02
      expect(gbpValue).toBeCloseTo(6.02, 1);
    });

    it('uses foil price when foil flag is set', () => {
      const entries = [
        { quantity: 2, foil: 1, card: { prices: { eur: '1.00', eur_foil: '5.00' } } },
      ];

      const totalEur = entries.reduce((sum, e) => {
        const price = e.foil
          ? parseFloat(e.card?.prices?.eur_foil || '0')
          : parseFloat(e.card?.prices?.eur || '0');
        return sum + e.quantity * price;
      }, 0);

      expect(totalEur).toBe(10.0);
    });
  });

  describe('unique card count', () => {
    it('counts distinct scryfall_ids', () => {
      const entries = [
        { scryfall_id: 'a', quantity: 2 },
        { scryfall_id: 'a', quantity: 1 },
        { scryfall_id: 'b', quantity: 3 },
      ];

      const uniqueIds = new Set(entries.map(e => e.scryfall_id));
      expect(uniqueIds.size).toBe(2);
    });

    it('returns 0 for empty collection', () => {
      const entries = [];
      const uniqueIds = new Set(entries.map(e => e.scryfall_id));
      expect(uniqueIds.size).toBe(0);
    });
  });

  describe('total card count', () => {
    it('sums all quantities', () => {
      const entries = [
        { quantity: 2 },
        { quantity: 1 },
        { quantity: 3 },
      ];

      const total = entries.reduce((sum, e) => sum + e.quantity, 0);
      expect(total).toBe(6);
    });
  });

  describe('change percentage', () => {
    it('calculates positive change', () => {
      const previous = 100;
      const current = 110;
      const change = ((current - previous) / previous) * 100;
      expect(change).toBe(10);
    });

    it('calculates negative change', () => {
      const previous = 100;
      const current = 85;
      const change = ((current - previous) / previous) * 100;
      expect(change).toBe(-15);
    });

    it('returns 0 for no change', () => {
      const previous = 50;
      const current = 50;
      const change = ((current - previous) / previous) * 100;
      expect(change).toBe(0);
    });

    it('handles zero previous value gracefully', () => {
      const previous = 0;
      const current = 10;
      // Avoid division by zero
      const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
      expect(change).toBe(0);
    });
  });

  describe('sparkline rendering', () => {
    it('produces valid SVG from price array', () => {
      const prices = [10, 12, 11, 14, 13, 15, 16];
      const svg = renderSparkline(prices, 200, 48);
      expect(svg).toContain('<svg');
      expect(svg).toContain('polyline');
      expect(svg).toContain('width="200"');
      expect(svg).toContain('height="48"');
    });

    it('returns empty string for insufficient data', () => {
      expect(renderSparkline([])).toBe('');
      expect(renderSparkline([5])).toBe('');
      expect(renderSparkline(null)).toBe('');
    });

    it('uses green stroke for upward trend', () => {
      const prices = [10, 15]; // upward
      const svg = renderSparkline(prices);
      expect(svg).toContain('#2ECC71');
    });

    it('uses red stroke for downward trend', () => {
      const prices = [15, 10]; // downward
      const svg = renderSparkline(prices);
      expect(svg).toContain('#E23838');
    });
  });
});
