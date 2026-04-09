import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema.js';
import { snapshotWatchlistPrices, computeTrend, computeMovers } from '../src/services/price-history.js';

const CARD_BOLT = {
  id: 'bolt-001',
  name: 'Lightning Bolt',
  oracle_id: 'oracle-bolt',
  set: '2xm',
  collector_number: '141',
  cmc: 1,
  color_identity: ['R'],
  type_line: 'Instant',
  rarity: 'uncommon',
  prices: { eur: '1.50', eur_foil: '3.00' },
};

const CARD_SOL = {
  id: 'sol-001',
  name: 'Sol Ring',
  oracle_id: 'oracle-sol',
  set: 'c21',
  collector_number: '263',
  cmc: 1,
  color_identity: [],
  type_line: 'Artifact',
  rarity: 'uncommon',
  prices: { eur: '2.00', eur_foil: '5.00' },
};

describe('price-history service', () => {
  beforeEach(async () => {
    await db.watchlist.clear();
    await db.price_history.clear();
    await db.cards.clear();
    await db.cards.bulkPut([CARD_BOLT, CARD_SOL]);
  });

  describe('snapshotWatchlistPrices', () => {
    it('creates one record per watched card for today', async () => {
      await db.watchlist.add({
        scryfall_id: 'bolt-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      });
      await db.watchlist.add({
        scryfall_id: 'sol-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      });

      await snapshotWatchlistPrices();

      const records = await db.price_history.toArray();
      expect(records).toHaveLength(2);
      expect(records.map(r => r.scryfall_id).sort()).toEqual(['bolt-001', 'sol-001']);
      expect(records[0].price_eur).toBeGreaterThan(0);
    });

    it('skips cards already snapshot today (no duplicates)', async () => {
      await db.watchlist.add({
        scryfall_id: 'bolt-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      });

      await snapshotWatchlistPrices();
      await snapshotWatchlistPrices(); // second call same day

      const records = await db.price_history.toArray();
      expect(records).toHaveLength(1);
    });

    it('prunes records older than 90 days', async () => {
      await db.watchlist.add({
        scryfall_id: 'bolt-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      });

      // Insert an old record manually
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await db.price_history.add({
        scryfall_id: 'bolt-001',
        date: oldDate.toISOString().slice(0, 10),
        price_eur: 1.00,
      });

      await snapshotWatchlistPrices();

      const records = await db.price_history.toArray();
      // Should have today's record but NOT the 100-day-old one
      expect(records).toHaveLength(1);
      expect(records[0].date).toBe(new Date().toISOString().slice(0, 10));
    });
  });

  describe('computeTrend', () => {
    it('returns correct change and direction from price history', async () => {
      const today = new Date();
      // Add 5 days of price history
      for (let i = 4; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        await db.price_history.add({
          scryfall_id: 'bolt-001',
          date: d.toISOString().slice(0, 10),
          price_eur: 1.00 + (4 - i) * 0.25, // 1.00, 1.25, 1.50, 1.75, 2.00
        });
      }

      const trend = await computeTrend('bolt-001', 7);
      expect(trend.prices).toHaveLength(5);
      expect(trend.change).toBeCloseTo(1.00);
      expect(trend.changePct).toBeCloseTo(100);
      expect(trend.direction).toBe('up');
    });

    it('returns flat direction when no change', async () => {
      const today = new Date();
      for (let i = 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        await db.price_history.add({
          scryfall_id: 'bolt-001',
          date: d.toISOString().slice(0, 10),
          price_eur: 1.50,
        });
      }

      const trend = await computeTrend('bolt-001', 7);
      expect(trend.direction).toBe('flat');
      expect(trend.change).toBe(0);
    });
  });

  describe('computeMovers', () => {
    it('returns top gainers and losers sorted by absolute change', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // bolt-001: went from 1.00 to 2.00 (+1.00 gain)
      await db.price_history.bulkAdd([
        { scryfall_id: 'bolt-001', date: yesterday.toISOString().slice(0, 10), price_eur: 1.00 },
        { scryfall_id: 'bolt-001', date: today.toISOString().slice(0, 10), price_eur: 2.00 },
      ]);

      // sol-001: went from 3.00 to 1.00 (-2.00 loss)
      await db.price_history.bulkAdd([
        { scryfall_id: 'sol-001', date: yesterday.toISOString().slice(0, 10), price_eur: 3.00 },
        { scryfall_id: 'sol-001', date: today.toISOString().slice(0, 10), price_eur: 1.00 },
      ]);

      const result = await computeMovers('7d', 5);
      expect(result.gainers).toHaveLength(1);
      expect(result.losers).toHaveLength(1);
      expect(result.gainers[0].scryfall_id).toBe('bolt-001');
      expect(result.gainers[0].change).toBeCloseTo(1.00);
      expect(result.losers[0].scryfall_id).toBe('sol-001');
      expect(result.losers[0].change).toBeCloseTo(-2.00);
    });
  });
});
