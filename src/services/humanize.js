// Mechanical de-AI pass for generated prose. Strips the punctuation tells the
// model keeps re-introducing despite the prompt rules (em/en dashes, curly quotes).
// Word choice and sentence structure are left to the prompt. Keep this boring,
// deterministic and safe to run on any string.
//
// Copied from the canonical source in the Huxley repo
// (supabase/functions/_shared/humanize.ts). Keep the logic identical across copies.
export function humanize(text) {
  if (!text) return text;
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2') // numeric ranges (3–5, 2024—2025) → hyphen
    .replace(/\s*[–—]\s*/g, ', ') // any other em/en dash used as punctuation → comma
    .replace(/,\s*,/g, ',') // tidy ", ,"
    .replace(/\s+,/g, ',') // tidy " ,"
    .replace(/[“”]/g, '"') // curly double quotes → straight
    .replace(/[‘’]/g, "'"); // curly single quotes / apostrophes → straight
}
