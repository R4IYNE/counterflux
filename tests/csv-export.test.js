import { describe, it, expect } from 'vitest';
import { generateCSV } from '../src/services/csv-export.js';

describe('generateCSV', () => {
  it('generates CSV with correct columns', () => {
    const entries = [
      {
        quantity: 4,
        foil: false,
        category: 'owned',
        card: {
          name: 'Lightning Bolt',
          set_name: 'Masters 25',
          set: 'a25',
          collector_number: '141',
          prices: { eur: '2.50', eur_foil: '5.00' },
        },
      },
    ];
    const csv = generateCSV(entries).trim();
    const lines = csv.split(/\r?\n/);
    expect(lines[0]).toBe('Name,Set,Set Code,Collector Number,Quantity,Foil,Price EUR,Category');
    expect(lines[1]).toContain('Lightning Bolt');
    expect(lines[1]).toContain('Masters 25');
    expect(lines[1]).toContain('a25');
    expect(lines[1]).toContain('141');
    expect(lines[1]).toContain('4');
    expect(lines[1]).toContain('2.50');
    expect(lines[1]).toContain('owned');
  });

  it('properly quotes card names with commas', () => {
    const entries = [
      {
        quantity: 1,
        foil: false,
        category: 'owned',
        card: {
          name: 'Kozilek, the Great Distortion',
          set_name: 'Oath of the Gatewatch',
          set: 'ogw',
          collector_number: '4',
          prices: { eur: '10.00' },
        },
      },
    ];
    const csv = generateCSV(entries).trim();
    const lines = csv.split(/\r?\n/);
    // PapaParse should quote fields containing commas
    expect(lines[1]).toContain('"Kozilek, the Great Distortion"');
  });

  it('generates header-only CSV for empty collection', () => {
    const csv = generateCSV([]).trim();
    const lines = csv.split(/\r?\n/).filter(l => l.length > 0);
    expect(lines[0]).toBe('Name,Set,Set Code,Collector Number,Quantity,Foil,Price EUR,Category');
    expect(lines.length).toBe(1);
  });
});
