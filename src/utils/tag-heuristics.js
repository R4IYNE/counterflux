/**
 * Tag heuristic suggestion engine.
 * Analyzes oracle text to suggest functional tags for deck cards.
 * Source-agnostic: same interface can be backed by EDHREC in Phase 4.
 */

export const DEFAULT_TAGS = [
  'Ramp',
  'Card Draw',
  'Removal',
  'Board Wipes',
  'Win Conditions',
  'Protection',
  'Recursion',
  'Utility',
];

/**
 * Heuristic patterns for each tag.
 * Each entry maps a tag to regex patterns that match oracle text.
 */
export const TAG_HEURISTICS = [
  {
    tag: 'Ramp',
    patterns: [
      /search your library for (?:a |an )?(?:basic )?land/i,
      /add \{[WUBRGC]\}/i,
      /add (?:one|two|three) mana/i,
      /put (?:a |that )(?:land|basic land) card (?:onto|on) the battlefield/i,
    ],
  },
  {
    tag: 'Card Draw',
    patterns: [
      /draw (?:a |two |three |four |\d+ )?cards?/i,
      /look at the top .* put .* into your hand/i,
      /whenever .* draw/i,
    ],
  },
  {
    tag: 'Removal',
    patterns: [
      /destroy target/i,
      /exile target/i,
      /target .* gets? [+-]\d+\/[+-]\d+/i,
      /deals? \d+ damage to (?:target|any target)/i,
      /return target .* to (?:its owner's|their owner's) hand/i,
    ],
  },
  {
    tag: 'Board Wipes',
    patterns: [
      /destroy all/i,
      /exile all/i,
      /all creatures get [+-]\d+\/[+-]\d+/i,
      /each (?:creature|opponent's creature)/i,
    ],
  },
  {
    tag: 'Win Conditions',
    patterns: [
      /(?:you win the game|opponent loses the game|opponents lose the game|each opponent loses the game)/i,
      /deals? \d+ damage to each opponent/i,
      /infinite/i,
    ],
  },
  {
    tag: 'Protection',
    patterns: [
      /hexproof/i,
      /indestructible/i,
      /shroud/i,
      /protection from/i,
      /can't be (?:countered|destroyed|targeted)/i,
      /ward/i,
    ],
  },
  {
    tag: 'Recursion',
    patterns: [
      /return .* from your graveyard/i,
      /put .* from your graveyard .* onto the battlefield/i,
      /return .* from .* graveyard to/i,
      /exile .* your graveyard .* cast/i,
    ],
  },
  {
    tag: 'Utility',
    patterns: [
      /scry/i,
      /surveil/i,
      /tutor/i,
    ],
  },
];

/**
 * Suggest functional tags based on oracle text analysis.
 * @param {string|null} oracleText - Card's oracle_text from Scryfall
 * @returns {string[]} Array of matching tag names
 */
export function suggestTags(oracleText) {
  if (!oracleText) return [];

  const tags = [];
  for (const { tag, patterns } of TAG_HEURISTICS) {
    if (patterns.some(p => p.test(oracleText))) {
      tags.push(tag);
    }
  }
  return tags;
}
