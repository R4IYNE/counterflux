import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import sampleCards from './fixtures/sample-cards.json';
import { shouldRefresh } from '../src/utils/scryfall.js';

// Helper: create a ReadableStream from a JSON array string
function createMockStream(jsonString) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonString);
  // Split into chunks to simulate streaming
  const chunkSize = 128;
  const chunks = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(bytes.slice(i, i + chunkSize));
  }
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });
}

describe('shouldRefresh', () => {
  it('returns true when no cached timestamp exists', () => {
    expect(shouldRefresh(null, '2026-01-01T00:00:00Z')).toBe(true);
    expect(shouldRefresh(undefined, '2026-01-01T00:00:00Z')).toBe(true);
  });

  it('returns true when server timestamp is newer', () => {
    expect(shouldRefresh('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')).toBe(true);
  });

  it('returns false when timestamps are the same', () => {
    expect(shouldRefresh('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(false);
  });

  it('returns false when cached timestamp is newer', () => {
    expect(shouldRefresh('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(false);
  });
});

describe('Bulk data pipeline core logic', () => {
  let db;

  beforeEach(async () => {
    db = new Dexie('counterflux-test-bulkdata', { indexedDB: indexedDB });
    db.version(1).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key'
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  it('stores cards in Dexie via bulkPut after stream parsing', async () => {
    // Dynamically import the pipeline logic
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const jsonStr = JSON.stringify(sampleCards);
    const stream = createMockStream(jsonStr);
    const totalBytes = new TextEncoder().encode(jsonStr).byteLength;

    const messages = [];
    const onMessage = (msg) => messages.push(msg);

    await processStream({
      stream,
      expectedSize: totalBytes,
      db,
      batchSize: 3,
      onMessage
    });

    // All 8 sample cards should be in Dexie
    const count = await db.cards.count();
    expect(count).toBe(sampleCards.length);

    // Verify a specific card
    const bolt = await db.cards.get('e2d1f9fb-1dec-44d0-8eb3-241e83b3e9bb');
    expect(bolt).toBeTruthy();
    expect(bolt.name).toBe('Lightning Bolt');
  });

  it('sends progress messages with downloaded, total, and parsed fields', async () => {
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const jsonStr = JSON.stringify(sampleCards);
    const stream = createMockStream(jsonStr);
    const totalBytes = new TextEncoder().encode(jsonStr).byteLength;

    const messages = [];
    const onMessage = (msg) => messages.push(msg);

    await processStream({
      stream,
      expectedSize: totalBytes,
      db,
      batchSize: 3,
      onMessage
    });

    const progressMsgs = messages.filter(m => m.type === 'progress');
    expect(progressMsgs.length).toBeGreaterThan(0);

    for (const msg of progressMsgs) {
      expect(msg).toHaveProperty('downloaded');
      expect(msg).toHaveProperty('total');
      expect(msg).toHaveProperty('parsed');
      expect(typeof msg.downloaded).toBe('number');
      expect(typeof msg.total).toBe('number');
      expect(typeof msg.parsed).toBe('number');
    }
  });

  it('sends complete message with totalParsed field', async () => {
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const jsonStr = JSON.stringify(sampleCards);
    const stream = createMockStream(jsonStr);
    const totalBytes = new TextEncoder().encode(jsonStr).byteLength;

    const messages = [];
    const onMessage = (msg) => messages.push(msg);

    await processStream({
      stream,
      expectedSize: totalBytes,
      db,
      batchSize: 3,
      onMessage
    });

    const completeMsgs = messages.filter(m => m.type === 'complete');
    expect(completeMsgs).toHaveLength(1);
    expect(completeMsgs[0].totalParsed).toBe(sampleCards.length);
  });

  it('sends error message on stream failure', async () => {
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const failingStream = new ReadableStream({
      start(controller) {
        controller.error(new Error('Network failure'));
      }
    });

    const messages = [];
    const onMessage = (msg) => messages.push(msg);

    await processStream({
      stream: failingStream,
      expectedSize: 1000,
      db,
      batchSize: 3,
      onMessage
    });

    const errorMsgs = messages.filter(m => m.type === 'error');
    expect(errorMsgs).toHaveLength(1);
    expect(errorMsgs[0]).toHaveProperty('message');
    expect(typeof errorMsgs[0].message).toBe('string');
  });

  it('can retrieve specific cards by ID after storage', async () => {
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const jsonStr = JSON.stringify(sampleCards);
    const stream = createMockStream(jsonStr);
    const totalBytes = new TextEncoder().encode(jsonStr).byteLength;

    await processStream({
      stream,
      expectedSize: totalBytes,
      db,
      batchSize: 3,
      onMessage: () => {}
    });

    // Check transform card
    const delver = await db.cards.get('11bf83bb-c95b-4b4f-9a56-ce7a1816e5db');
    expect(delver).toBeTruthy();
    expect(delver.name).toBe('Delver of Secrets // Insectile Aberration');
    expect(delver.layout).toBe('transform');

    // Check saga card
    const eldest = await db.cards.get('c8318f40-ecd5-429e-8fe2-b84f5e9e3e1b');
    expect(eldest).toBeTruthy();
    expect(eldest.name).toBe('The Eldest Reborn');
  });

  it('uses expectedSize for progress total, not Content-Length', async () => {
    const { processStream } = await import('../src/workers/bulk-data-pipeline.js');

    const jsonStr = JSON.stringify(sampleCards.slice(0, 2));
    const stream = createMockStream(jsonStr);
    const fakeExpectedSize = 999999;

    const messages = [];
    const onMessage = (msg) => messages.push(msg);

    await processStream({
      stream,
      expectedSize: fakeExpectedSize,
      db,
      batchSize: 1,
      onMessage
    });

    const progressMsgs = messages.filter(m => m.type === 'progress');
    for (const msg of progressMsgs) {
      expect(msg.total).toBe(fakeExpectedSize);
    }
  });
});
