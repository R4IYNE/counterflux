import { describe, it, expect } from 'vitest';

describe('detectFormat', () => {
  it.todo('detects deckbox format from headers');
  it.todo('detects moxfield format from headers');
  it.todo('detects archidekt format from headers');
  it.todo('falls back to generic for unknown headers');
});

describe('normaliseRow', () => {
  it.todo('normalises deckbox row to internal shape');
  it.todo('normalises moxfield row to internal shape');
  it.todo('normalises archidekt row to internal shape');
  it.todo('normalises generic row to internal shape');
});

describe('importCSV', () => {
  it.todo('processes full CSV file and returns normalised entries');
});
