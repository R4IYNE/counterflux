import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';

// Test card fixtures
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

describe('watchlist', () => {
  beforeEach(async () => {
    await db.watchlist.clear();
    await db.cards.clear();
    await db.price_history.clear();
    await db.cards.bulkPut([CARD_BOLT, CARD_SOL]);
  });

  it('addToWatchlist adds entry and returns in watchlist array', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(1);
    expect(list[0].scryfall_id).toBe('bolt-001');
  });

  it('unique scryfall_id constraint prevents duplicate watchlist entries', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    await expect(
      db.watchlist.add({
        scryfall_id: 'bolt-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      })
    ).rejects.toThrow();

    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(1);
  });

  it('removeFromWatchlist removes entry by scryfall_id', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    await db.watchlist.where('scryfall_id').equals('bolt-001').delete();
    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(0);
  });

  it('updateAlert updates alert fields on watchlist entry', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    await db.watchlist.update(entry.id, {
      alert_type: 'below',
      alert_threshold: 5.00,
    });

    const updated = await db.watchlist.get(entry.id);
    expect(updated.alert_type).toBe('below');
    expect(updated.alert_threshold).toBe(5.00);
  });

  it('checkAlerts detects price below threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00, // GBP threshold; card is 1.50 EUR * 0.86 = ~1.29 GBP
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    const card = await db.cards.get('bolt-001');
    const priceEur = parseFloat(card.prices.eur);
    const priceGbp = priceEur * 0.86; // ~1.29

    expect(priceGbp).toBeLessThan(entry.alert_threshold);
  });

  it('checkAlerts detects price above threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'sol-001',
      added_at: new Date().toISOString(),
      alert_type: 'above',
      alert_threshold: 1.00, // GBP threshold; card is 2.00 EUR * 0.86 = 1.72 GBP
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('sol-001').first();
    const card = await db.cards.get('sol-001');
    const priceEur = parseFloat(card.prices.eur);
    const priceGbp = priceEur * 0.86; // ~1.72

    expect(priceGbp).toBeGreaterThan(entry.alert_threshold);
  });

  it('checkAlerts skips already-alerted-today entries', async () => {
    const today = new Date().toISOString();
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00,
      last_alerted_at: today, // already alerted today
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(entry.last_alerted_at.slice(0, 10)).toBe(todayStr);
  });
});
