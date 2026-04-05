import { describe, it, expect } from 'vitest';
import { classifyType, TYPE_ORDER } from '../src/utils/type-classifier.js';

describe('classifyType', () => {
  it('classifies "Legendary Creature -- Human Wizard" as Creature', () => {
    expect(classifyType('Legendary Creature \u2014 Human Wizard')).toBe('Creature');
  });

  it('classifies "Artifact Creature -- Golem" as Creature (Creature takes priority)', () => {
    expect(classifyType('Artifact Creature \u2014 Golem')).toBe('Creature');
  });

  it('classifies "Enchantment Creature -- God" as Creature', () => {
    expect(classifyType('Enchantment Creature \u2014 God')).toBe('Creature');
  });

  it('classifies "Instant" as Instant', () => {
    expect(classifyType('Instant')).toBe('Instant');
  });

  it('classifies "Sorcery" as Sorcery', () => {
    expect(classifyType('Sorcery')).toBe('Sorcery');
  });

  it('classifies "Enchantment -- Aura" as Enchantment', () => {
    expect(classifyType('Enchantment \u2014 Aura')).toBe('Enchantment');
  });

  it('classifies "Artifact" as Artifact', () => {
    expect(classifyType('Artifact')).toBe('Artifact');
  });

  it('classifies "Legendary Planeswalker -- Jace" as Planeswalker', () => {
    expect(classifyType('Legendary Planeswalker \u2014 Jace')).toBe('Planeswalker');
  });

  it('classifies "Basic Land -- Island" as Land', () => {
    expect(classifyType('Basic Land \u2014 Island')).toBe('Land');
  });

  it('classifies "Battle" as Other', () => {
    expect(classifyType('Battle')).toBe('Other');
  });

  it('classifies null as Other', () => {
    expect(classifyType(null)).toBe('Other');
  });

  it('classifies undefined as Other', () => {
    expect(classifyType(undefined)).toBe('Other');
  });
});

describe('TYPE_ORDER', () => {
  it('has 8 entries in the correct order', () => {
    expect(TYPE_ORDER).toEqual([
      'Creature', 'Instant', 'Sorcery', 'Enchantment',
      'Artifact', 'Planeswalker', 'Land', 'Other'
    ]);
  });
});
