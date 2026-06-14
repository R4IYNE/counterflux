import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema.js';
import { computeTrend } from '../src/services/price-history.js';

const ALERT_WINDOW_DAYS = 7;

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

const RATE = 0.86;

function eurToGbpValue(eur) {
  return eur * RATE;
}

/**
 * Check alerts for all watchlist entries.
 * Returns array of triggered alerts.
 */
async function checkAlerts() {
  const watchlist = await db.watchlist.toArray();
  const today = new Date().toISOString().slice(0, 10);
  const alerts = [];

  for (const entry of watchlist) {
    if (!entry.alert_type || entry.alert_threshold == null) continue;
    if (entry.last_alerted_at && entry.last_alerted_at.slice(0, 10) === today) continue;

    const card = await db.cards.get(entry.scryfall_id);
    if (!card) continue;

    const priceEur = parseFloat(card.prices?.eur || '0');
    if (priceEur === 0) continue;

    const priceGbp = eurToGbpValue(priceEur);
    let triggered = false;
    let changePct = null;
    let direction = null;

    if (entry.alert_type === 'below' && priceGbp < entry.alert_threshold) {
      triggered = true;
    } else if (entry.alert_type === 'above' && priceGbp > entry.alert_threshold) {
      triggered = true;
    } else if (entry.alert_type === 'change_pct') {
      // Mirrors the real store (audit fix #7): windowed + directional.
      const trend = await computeTrend(entry.scryfall_id, ALERT_WINDOW_DAYS);
      if (Math.abs(trend.changePct) >= entry.alert_threshold) {
        triggered = true;
        changePct = trend.changePct;
        direction = trend.direction;
      }
    }

    if (triggered) {
      alerts.push({
        scryfall_id: entry.scryfall_id,
        alert_type: entry.alert_type,
        current_price_gbp: priceGbp,
        change_pct: changePct,
        direction,
      });
      await db.watchlist.update(entry.id, {
        last_alerted_at: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

describe('price alerts', () => {
  beforeEach(async () => {
    await db.watchlist.clear();
    await db.price_history.clear();
    await db.cards.clear();
    await db.cards.put(CARD_BOLT);
  });

  it('triggers alert for below condition: card price < threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00, // GBP; card is 1.50 EUR * 0.86 = 1.29 GBP
      last_alerted_at: null,
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe('below');
    expect(alerts[0].current_price_gbp).toBeCloseTo(1.29, 1);
  });

  it('triggers alert for above condition: card price > threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'above',
      alert_threshold: 1.00, // GBP; card is 1.50 EUR * 0.86 = 1.29 GBP
      last_alerted_at: null,
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe('above');
  });

  it('triggers alert for change_pct condition: percentage change exceeds threshold', async () => {
    // Add price history with significant change
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    await db.price_history.bulkAdd([
      { scryfall_id: 'bolt-001', date: weekAgo.toISOString().slice(0, 10), price_eur: 1.00 },
      { scryfall_id: 'bolt-001', date: today.toISOString().slice(0, 10), price_eur: 1.50 },
    ]);

    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'change_pct',
      alert_threshold: 40, // 40% threshold; actual change is 50%
      last_alerted_at: null,
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe('change_pct');
    // Audit fix #7: signed + directional rather than abs-only.
    expect(alerts[0].direction).toBe('up');
    expect(alerts[0].change_pct).toBeCloseTo(50, 0);
  });

  it('triggers change_pct on a DROP and reports a downward direction', async () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    await db.price_history.bulkAdd([
      { scryfall_id: 'bolt-001', date: weekAgo.toISOString().slice(0, 10), price_eur: 1.50 },
      { scryfall_id: 'bolt-001', date: today.toISOString().slice(0, 10), price_eur: 0.75 },
    ]);

    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'change_pct',
      alert_threshold: 40, // 40% threshold; actual change is -50%
      last_alerted_at: null,
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].direction).toBe('down');
    expect(alerts[0].change_pct).toBeCloseTo(-50, 0);
  });

  it('does not trigger when condition is not met', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 0.50, // GBP; card is 1.29 GBP, above threshold
      last_alerted_at: null,
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('does not re-trigger same day (last_alerted_at check)', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00,
      last_alerted_at: new Date().toISOString(), // already alerted today
    });

    const alerts = await checkAlerts();
    expect(alerts).toHaveLength(0);
  });
});
