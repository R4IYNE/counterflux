import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock db.meta
const mockMetaStore = {};
vi.mock('../src/db/schema.js', () => ({
  db: {
    meta: {
      get: vi.fn(async (key) => mockMetaStore[key] || undefined),
      put: vi.fn(async (obj) => { mockMetaStore[obj.key] = obj; }),
    },
  },
}));

import { logActivity, getActivity } from '../src/services/activity.js';

describe('Activity Logger', () => {
  beforeEach(() => {
    // Clear mock store
    for (const key of Object.keys(mockMetaStore)) delete mockMetaStore[key];
    vi.clearAllMocks();
  });

  it('logActivity stores an entry in meta table', async () => {
    await logActivity('card_added', 'Added 4x Lightning Bolt');
    const stored = mockMetaStore['activity_log'];
    expect(stored).toBeDefined();
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0].type).toBe('card_added');
    expect(stored.entries[0].message).toBe('Added 4x Lightning Bolt');
    expect(stored.entries[0].timestamp).toBeTruthy();
  });

  it('logActivity stores entityId when provided', async () => {
    await logActivity('card_added', 'Added Sol Ring', 'sol-001');
    const stored = mockMetaStore['activity_log'];
    expect(stored.entries[0].entityId).toBe('sol-001');
  });

  it('logActivity stores null entityId by default', async () => {
    await logActivity('card_added', 'Added a card');
    const stored = mockMetaStore['activity_log'];
    expect(stored.entries[0].entityId).toBeNull();
  });

  it('entries are in reverse chronological order (newest first)', async () => {
    await logActivity('first', 'First action');
    await logActivity('second', 'Second action');
    const stored = mockMetaStore['activity_log'];
    expect(stored.entries[0].type).toBe('second');
    expect(stored.entries[1].type).toBe('first');
  });

  it('caps at 50 entries (FIFO)', async () => {
    // Seed with 50 entries
    mockMetaStore['activity_log'] = {
      key: 'activity_log',
      entries: Array.from({ length: 50 }, (_, i) => ({
        type: 'old',
        message: `Entry ${i}`,
        entityId: null,
        timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
      })),
    };
    await logActivity('new', 'New entry');
    const stored = mockMetaStore['activity_log'];
    expect(stored.entries).toHaveLength(50);
    expect(stored.entries[0].type).toBe('new');
    expect(stored.entries[49].type).toBe('old');
  });

  it('getActivity returns entries in reverse chronological order', async () => {
    mockMetaStore['activity_log'] = {
      key: 'activity_log',
      entries: [
        { type: 'b', message: 'B', entityId: null, timestamp: '2024-01-02T00:00:00Z' },
        { type: 'a', message: 'A', entityId: null, timestamp: '2024-01-01T00:00:00Z' },
      ],
    };
    const result = await getActivity();
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('b');
  });

  it('getActivity returns empty array when no activity exists', async () => {
    const result = await getActivity();
    expect(result).toEqual([]);
  });
});
