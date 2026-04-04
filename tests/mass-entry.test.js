import { describe, it, expect } from 'vitest';

describe('parseBatchLine', () => {
  it.todo('parses valid line "4x Lightning Bolt [2XM] foil"');
  it.todo('parses valid line without set "2x Sol Ring"');
  it.todo('parses valid line without foil "1x Counterspell [MH2]"');
  it.todo('returns parsed: false for invalid line "just some text"');
  it.todo('returns null for empty line');
});

describe('resolveBatchEntries', () => {
  it.todo('resolves known card names to scryfall IDs');
  it.todo('flags unresolved card names');
});
