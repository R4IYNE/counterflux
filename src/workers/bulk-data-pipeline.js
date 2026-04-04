/**
 * Core bulk data pipeline logic.
 * Extracted into a separate module so it can be tested outside a Worker context.
 * The Worker (bulk-data.worker.js) imports and calls these functions.
 */
import { JSONParser } from '@streamparser/json-whatwg';

/**
 * Stream-parse a JSON array from a ReadableStream and batch-insert cards into Dexie.
 *
 * @param {object} opts
 * @param {ReadableStream} opts.stream - The response body stream (raw bytes)
 * @param {number} opts.expectedSize - Expected total bytes (from Scryfall bulk-data size field)
 * @param {import('dexie').Dexie} opts.db - Dexie database instance
 * @param {number} [opts.batchSize=1000] - Cards per batch insert
 * @param {function} opts.onMessage - Callback for progress/complete/error messages
 */
export async function processStream({ stream, expectedSize, db, batchSize = 1000, onMessage }) {
  let downloaded = 0;
  let totalParsed = 0;
  let batch = [];

  try {
    // Create a tracking stream that counts bytes before they reach the parser
    const trackingTransform = new TransformStream({
      transform(chunk, controller) {
        downloaded += chunk.byteLength;
        controller.enqueue(chunk);
      }
    });

    // JSONParser from @streamparser/json-whatwg is a TransformStream
    // It takes Uint8Array chunks and outputs parsed JSON value objects
    const parser = new JSONParser({ paths: ['$.*'], keepStack: false });

    // Pipe: stream -> tracking (byte count) -> parser (JSON parsing) -> card collector
    const readable = stream
      .pipeThrough(trackingTransform)
      .pipeThrough(parser);

    const reader = readable.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // value is { value: <parsed card object>, key: <index>, ... }
      batch.push(value.value);
      totalParsed++;

      if (batch.length >= batchSize) {
        const toInsert = batch;
        batch = [];
        await db.cards.bulkPut(toInsert);
        onMessage({ type: 'progress', downloaded, total: expectedSize, parsed: totalParsed });
      }
    }

    // Flush remaining batch
    if (batch.length > 0) {
      await db.cards.bulkPut(batch);
      onMessage({ type: 'progress', downloaded, total: expectedSize, parsed: totalParsed });
    }

    onMessage({ type: 'complete', totalParsed });
  } catch (err) {
    onMessage({ type: 'error', message: err.message || String(err) });
  }
}
