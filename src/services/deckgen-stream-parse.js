// src/services/deckgen-stream-parse.js
//
// Pulls fully-formed card objects out of a partial NDJSON/JSON buffer so the
// brew can reveal cards as Anthropic streams them. Brace-balanced scan with
// string-awareness (so a `{` inside a reasoning string doesn't fool it). Each
// candidate object is JSON.parsed; only objects that parse AND carry a
// scryfall_id are returned. Pure + deterministic — unit tested. The same body
// is inlined in api/deckgen.js (separate Vercel build root).

export function extractRecommendedCards(buffer) {
  const out = [];
  if (!buffer) return out;
  const arrStart = buffer.indexOf('"recommended"');
  if (arrStart === -1) return out;
  const bracket = buffer.indexOf('[', arrStart);
  if (bracket === -1) return out;

  let i = bracket + 1;
  const n = buffer.length;
  while (i < n) {
    // skip to next object start
    while (i < n && buffer[i] !== '{') {
      if (buffer[i] === ']') return out; // array closed
      i++;
    }
    if (i >= n) break;
    // brace-balanced, string-aware scan for the matching '}'
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < n; j++) {
      const ch = buffer[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end === -1) break; // object still streaming
    try {
      const obj = JSON.parse(buffer.slice(i, end + 1));
      if (obj && obj.scryfall_id) {
        out.push({ scryfall_id: obj.scryfall_id, role: obj.role, reasoning: obj.reasoning });
      }
    } catch { /* malformed slice — stop, wait for more */ break; }
    i = end + 1;
  }
  return out;
}
