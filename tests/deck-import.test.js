import { describe, it, expect, vi } from 'vitest';
import {
  detectFormat,
  parseMoxfield,
  parseArchidekt,
  parseArena,
  parsePlaintext,
  parseDecklist,
  resolveDecklist,
} from '../src/services/deck-import.js';

describe('detectFormat', () => {
  it('detects moxfield format with section headers', () => {
    expect(detectFormat('// Commander\n1 Krark, the Thumbless\n// The 99\n1 Sol Ring')).toBe('moxfield');
  });

  it('detects archidekt format with category counts', () => {
    expect(detectFormat('Creatures (23)\n1 Sol Ring\nInstants (8)\n1 Counterspell')).toBe('archidekt');
  });

  it('detects arena format with set code and collector number', () => {
    expect(detectFormat('1 Sol Ring (2XM) 274')).toBe('arena');
  });

  it('detects plaintext for simple qty + name', () => {
    expect(detectFormat('1 Sol Ring\n1 Lightning Bolt')).toBe('plaintext');
  });

  it('detects plaintext for lines with x separator', () => {
    expect(detectFormat('1x Sol Ring')).toBe('plaintext');
  });
});

describe('parseMoxfield', () => {
  it('parses commander and main sections', () => {
    const text = '// Commander\n1 Krark, the Thumbless\n// The 99\n1 Sol Ring\n1 Lightning Bolt';
    const result = parseMoxfield(text);
    expect(result.commander).toEqual([{ qty: 1, name: 'Krark, the Thumbless' }]);
    expect(result.main).toEqual([
      { qty: 1, name: 'Sol Ring' },
      { qty: 1, name: 'Lightning Bolt' },
    ]);
  });

  it('handles companion section', () => {
    const text = '// Commander\n1 Krark, the Thumbless\n// Companion\n1 Jegantha, the Wellspring\n// The 99\n1 Sol Ring';
    const result = parseMoxfield(text);
    expect(result.commander).toEqual([{ qty: 1, name: 'Krark, the Thumbless' }]);
    expect(result.companion).toEqual([{ qty: 1, name: 'Jegantha, the Wellspring' }]);
    expect(result.main).toEqual([{ qty: 1, name: 'Sol Ring' }]);
  });

  it('handles sideboard section', () => {
    const text = '// Commander\n1 Atraxa\n// The 99\n1 Sol Ring\n// Sideboard\n1 Rest in Peace';
    const result = parseMoxfield(text);
    expect(result.sideboard).toEqual([{ qty: 1, name: 'Rest in Peace' }]);
  });
});

describe('parseArchidekt', () => {
  it('parses cards ignoring category headers', () => {
    const text = 'Creatures (2)\n1 Sol Ring\n1 Lightning Bolt';
    const result = parseArchidekt(text);
    expect(result.main).toEqual([
      { qty: 1, name: 'Sol Ring' },
      { qty: 1, name: 'Lightning Bolt' },
    ]);
  });

  it('handles multiple categories', () => {
    const text = 'Creatures (1)\n1 Sol Ring\nInstants (1)\n1 Counterspell';
    const result = parseArchidekt(text);
    expect(result.main).toHaveLength(2);
  });
});

describe('parseArena', () => {
  it('parses arena format with set and collector number', () => {
    const result = parseArena('1 Sol Ring (2XM) 274');
    expect(result.main).toEqual([{ qty: 1, name: 'Sol Ring', set: '2XM', num: '274' }]);
  });

  it('handles multiple lines', () => {
    const text = '1 Sol Ring (2XM) 274\n2 Lightning Bolt (STA) 42';
    const result = parseArena(text);
    expect(result.main).toHaveLength(2);
    expect(result.main[1]).toEqual({ qty: 2, name: 'Lightning Bolt', set: 'STA', num: '42' });
  });
});

describe('parsePlaintext', () => {
  it('parses qty + name with x separator', () => {
    const result = parsePlaintext('1x Sol Ring\n2 Lightning Bolt');
    expect(result.main).toEqual([
      { qty: 1, name: 'Sol Ring' },
      { qty: 2, name: 'Lightning Bolt' },
    ]);
  });

  it('skips blank lines and comment lines', () => {
    const result = parsePlaintext('1 Sol Ring\n\n// This is a comment\n1 Lightning Bolt\n');
    expect(result.main).toEqual([
      { qty: 1, name: 'Sol Ring' },
      { qty: 1, name: 'Lightning Bolt' },
    ]);
  });
});

describe('parseDecklist', () => {
  it('auto-detects moxfield and parses', () => {
    const text = '// Commander\n1 Krark, the Thumbless\n// The 99\n1 Sol Ring';
    const result = parseDecklist(text);
    expect(result.commander).toEqual([{ qty: 1, name: 'Krark, the Thumbless' }]);
    expect(result.main).toEqual([{ qty: 1, name: 'Sol Ring' }]);
  });

  it('auto-detects plaintext and parses', () => {
    const text = '1x Sol Ring\n2 Lightning Bolt';
    const result = parseDecklist(text);
    expect(result.main).toEqual([
      { qty: 1, name: 'Sol Ring' },
      { qty: 2, name: 'Lightning Bolt' },
    ]);
  });
});

describe('resolveDecklist', () => {
  it('resolves cards via search function', async () => {
    const parsed = { main: [{ qty: 1, name: 'Sol Ring' }] };
    const searchFn = vi.fn().mockResolvedValue([{ id: 'sr-001', name: 'Sol Ring' }]);
    const result = await resolveDecklist(parsed, searchFn);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].scryfallId).toBe('sr-001');
    expect(result.unresolved).toHaveLength(0);
  });

  it('flags unresolved cards', async () => {
    const parsed = { main: [{ qty: 1, name: 'Nonexistent Card' }] };
    const searchFn = vi.fn().mockResolvedValue([]);
    const result = await resolveDecklist(parsed, searchFn);
    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].name).toBe('Nonexistent Card');
  });

  it('resolves commander cards separately', async () => {
    const parsed = {
      commander: [{ qty: 1, name: 'Krark' }],
      main: [{ qty: 1, name: 'Sol Ring' }],
    };
    const searchFn = vi.fn()
      .mockResolvedValueOnce([{ id: 'kr-001', name: 'Krark, the Thumbless' }])
      .mockResolvedValueOnce([{ id: 'sr-001', name: 'Sol Ring' }]);
    const result = await resolveDecklist(parsed, searchFn);
    expect(result.resolved).toHaveLength(2);
    expect(result.resolved[0].isCommander).toBe(true);
    expect(result.resolved[1].isCommander).toBeUndefined();
  });
});
