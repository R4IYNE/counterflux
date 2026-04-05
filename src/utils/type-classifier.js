/**
 * MTG card type classification.
 * Maps complex type_line strings to a single primary type
 * for deck grouping and analytics.
 */

export const TYPE_ORDER = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
  'Other',
];

/**
 * Classify a card's type_line into one of the primary types.
 * Priority order matters: "Artifact Creature" -> "Creature" (Creature wins).
 * @param {string|null} typeLine - The card's type_line from Scryfall
 * @returns {string} One of TYPE_ORDER values
 */
export function classifyType(typeLine) {
  if (!typeLine) return 'Other';

  // Check in priority order (Creature first so multi-type cards classify correctly)
  if (typeLine.includes('Creature')) return 'Creature';
  if (typeLine.includes('Instant')) return 'Instant';
  if (typeLine.includes('Sorcery')) return 'Sorcery';
  if (typeLine.includes('Enchantment')) return 'Enchantment';
  if (typeLine.includes('Artifact')) return 'Artifact';
  if (typeLine.includes('Planeswalker')) return 'Planeswalker';
  if (typeLine.includes('Land')) return 'Land';

  return 'Other';
}
