// src/utils/card-conditions.js
//
// Condition + language vocab for collection entries (audit M4, metadata-only).
// Stored as plain fields on the existing [scryfall_id+foil] entry — no schema
// migration. Importers (ManaBox / Deckbox / TCGplayer) carry these columns, so
// normalisation maps their many spellings onto a small canonical set.

export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
export const DEFAULT_CONDITION = 'NM';

export const CONDITION_LABELS = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

// Common importer spellings → canonical code.
const CONDITION_ALIASES = {
  m: 'NM', mint: 'NM', nm: 'NM', 'near mint': 'NM', nearmint: 'NM', 'nm-mint': 'NM',
  sp: 'LP', lp: 'LP', 'lightly played': 'LP', 'slightly played': 'LP', excellent: 'LP', ex: 'LP', good: 'LP',
  mp: 'MP', 'moderately played': 'MP', played: 'MP', pl: 'MP', vg: 'MP',
  hp: 'HP', 'heavily played': 'HP', poor: 'HP',
  dmg: 'DMG', damaged: 'DMG', d: 'DMG',
};

export function normalizeCondition(value) {
  if (!value) return DEFAULT_CONDITION;
  const key = String(value).trim().toLowerCase();
  if (!key) return DEFAULT_CONDITION;
  return CONDITION_ALIASES[key] || (CONDITIONS.includes(String(value).trim().toUpperCase()) ? String(value).trim().toUpperCase() : DEFAULT_CONDITION);
}

// Scryfall language codes we surface; default English.
export const LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'pt', 'ja', 'ko', 'ru', 'zhs', 'zht'];
export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_LABELS = {
  en: 'English', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
  zhs: 'Chinese (S)', zht: 'Chinese (T)',
};

const LANGUAGE_ALIASES = {
  english: 'en', en: 'en',
  german: 'de', deutsch: 'de', de: 'de',
  french: 'fr', français: 'fr', francais: 'fr', fr: 'fr',
  italian: 'it', italiano: 'it', it: 'it',
  spanish: 'es', español: 'es', espanol: 'es', es: 'es',
  portuguese: 'pt', português: 'pt', portugues: 'pt', pt: 'pt',
  japanese: 'ja', '日本語': 'ja', ja: 'ja', jp: 'ja',
  korean: 'ko', ko: 'ko',
  russian: 'ru', ru: 'ru',
  'chinese simplified': 'zhs', zhs: 'zhs', cs: 'zhs',
  'chinese traditional': 'zht', zht: 'zht', ct: 'zht',
};

export function normalizeLanguage(value) {
  if (!value) return DEFAULT_LANGUAGE;
  const key = String(value).trim().toLowerCase();
  if (!key) return DEFAULT_LANGUAGE;
  return LANGUAGE_ALIASES[key] || (LANGUAGES.includes(key) ? key : DEFAULT_LANGUAGE);
}
