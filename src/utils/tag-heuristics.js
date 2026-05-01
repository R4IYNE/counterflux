/**
 * Category heuristic suggestion engine.
 * Analyzes oracle text to suggest functional categories for deck cards.
 * Categories aligned with Archidekt's auto-category system.
 */

export const DEFAULT_TAGS = [
  'Ramp',
  'Draw',
  'Removal',
  'Board Wipe',
  'Tutor',
  'Recursion',
  'Protection',
  'Counter Spell',
  'Finisher',
  'Tokens',
  'Anthem',
  'Evasion',
  'Copy',
  'Burn',
  'Reanimation',
  'Stax',
  'Mill',
  'Utility',
];

/**
 * Heuristic patterns for each category.
 * Each entry maps a category to regex patterns that match oracle text.
 */
export const TAG_HEURISTICS = [
  {
    tag: 'Ramp',
    patterns: [
      /search your library for (?:a |an )?(?:basic )?land/i,
      /add \{[WUBRGC]\}/i,
      /add (?:one|two|three) mana/i,
      /put (?:a |that )(?:land|basic land) card (?:onto|on) the battlefield/i,
      /land card (?:from|and put).* onto the battlefield/i,
    ],
  },
  {
    tag: 'Draw',
    patterns: [
      /draw (?:a |two |three |four |\d+ )?cards?/i,
      /look at the top .* put .* into your hand/i,
      /whenever .* draw/i,
      /you may draw/i,
    ],
  },
  {
    tag: 'Removal',
    patterns: [
      /destroy target (?!land)/i,
      /exile target/i,
      /target .* gets? [+-]\d+\/[+-]\d+/i,
      /deals? \d+ damage to (?:target|any target)/i,
      /return target .* to (?:its|their) owner'?s hand/i,
      /target player sacrifices/i,
    ],
  },
  {
    tag: 'Board Wipe',
    patterns: [
      /destroy all (?:creatures|nonland|permanents|artifacts|enchantments)/i,
      /exile all (?:creatures|nonland|permanents)/i,
      /all creatures get -\d+\/-\d+/i,
      /each (?:creature|player|opponent) .* sacrifice/i,
      /deals? \d+ damage to each creature/i,
    ],
  },
  {
    tag: 'Tutor',
    patterns: [
      /search your library for (?:a |an )?(?!.*land)(?:card|creature|instant|sorcery|enchantment|artifact|planeswalker)/i,
      /search your library/i,
    ],
  },
  {
    tag: 'Recursion',
    patterns: [
      /return .* from your graveyard/i,
      /put .* from your graveyard .* (?:onto the battlefield|into your hand)/i,
      /return .* from .* graveyard to/i,
      /exile .* your graveyard .* cast/i,
      /flashback/i,
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
      /phase out/i,
      /regenerate/i,
    ],
  },
  {
    tag: 'Counter Spell',
    patterns: [
      /counter target spell/i,
      /counter target (?:instant|sorcery|creature|artifact|enchantment|activated ability|triggered ability)/i,
      /counter it/i,
    ],
  },
  {
    tag: 'Finisher',
    patterns: [
      /you win the game/i,
      /(?:opponent|opponents|each opponent) (?:loses?|lose) the game/i,
      /(?:infinite|extra combat|additional combat)/i,
      /deals? \d+ damage to each opponent/i,
      /commander damage/i,
    ],
  },
  {
    tag: 'Tokens',
    patterns: [
      /create (?:a |two |three |\d+ )?\d*\/?[0-9]* .* tokens?/i,
      /creature tokens?/i,
      /treasure tokens?/i,
      /create .* tokens?/i,
    ],
  },
  {
    tag: 'Anthem',
    patterns: [
      /creatures you control get \+/i,
      /other creatures you control get \+/i,
      /creatures you control have/i,
      /each creature you control/i,
    ],
  },
  {
    tag: 'Evasion',
    patterns: [
      /flying/i,
      /trample/i,
      /menace/i,
      /can't be blocked/i,
      /unblockable/i,
      /shadow/i,
      /fear/i,
      /intimidate/i,
    ],
  },
  {
    tag: 'Copy',
    patterns: [
      /copy (?:target|a|that)/i,
      /becomes? a copy/i,
      /create a (?:token that's a )?copy/i,
      /clone/i,
    ],
  },
  {
    tag: 'Burn',
    patterns: [
      /deals? \d+ damage to (?:any target|target (?:player|opponent)|each opponent)/i,
      /deals? damage equal to/i,
      /each opponent loses \d+ life/i,
      /lose life equal to/i,
    ],
  },
  {
    tag: 'Reanimation',
    patterns: [
      /return (?:target |a )?creature card from (?:a |your )?graveyard to the battlefield/i,
      /put (?:target |a )?creature card from (?:a |your )?graveyard onto the battlefield/i,
      /reanimate/i,
    ],
  },
  {
    tag: 'Stax',
    patterns: [
      /(?:opponents?|each player) can't/i,
      /costs? (?:\{?\d\}? |more )/i,
      /enters? the battlefield tapped/i,
      /(?:opponents?|each player) (?:skip|sacrifice)/i,
      /players can't (?:cast|draw|search|play)/i,
    ],
  },
  {
    tag: 'Mill',
    patterns: [
      /(?:target player|each opponent|that player) (?:mills?|puts?) .* cards? .* into .* graveyard/i,
      /mill \d+/i,
      /put the top \d+ cards? .* into .* graveyard/i,
    ],
  },
  {
    tag: 'Utility',
    patterns: [
      /scry/i,
      /surveil/i,
    ],
  },
];

/**
 * Suggest functional categories based on oracle text analysis.
 *
 * Lands are explicitly excluded — they have their own count in the breakdown
 * and shouldn't be tagged as functional categories. Without this guard, basic
 * lands match the Ramp regex (`/add \{[WUBRGC]\}/i`) because Mountain's oracle
 * text is literally "{T}: Add {R}." — every basic land would be tagged Ramp.
 *
 * @param {string|null} oracleText - Card's oracle_text from Scryfall
 * @param {string|null} [typeLine] - Card's type_line from Scryfall (optional;
 *                                   when provided, lands return [])
 * @returns {string[]} Array of matching category names
 */
export function suggestTags(oracleText, typeLine = null) {
  if (!oracleText) return [];
  // Skip lands entirely — they count as Lands in the breakdown, not as
  // functional categories. Matches both basic ("Basic Land — Mountain") and
  // non-basic ("Land — Plains Island") type lines.
  if (typeLine && /(?:^|\s—\s|\s)Land(?:\s|$|—)/i.test(typeLine)) return [];

  const tags = [];
  for (const { tag, patterns } of TAG_HEURISTICS) {
    if (patterns.some(p => p.test(oracleText))) {
      tags.push(tag);
    }
  }
  return tags;
}
