/**
 * v1.3.x (audit fix #6) — Deck diagnostics digest for AI prompts.
 *
 * Formats a compact summary of the deck's OWN locally-computed analytics +
 * RAG gap report so the brew / chat prompts can hand Claude the deck's real
 * weaknesses instead of making it re-derive them from the bare card list.
 *
 * Lives in its own tiny module (NOT deckgen-prompt.js) so the client stores
 * can import it without pulling the server-only SYSTEM_PROMPT into the bundle.
 * Pure formatter: the caller computes `analytics` (computeDeckAnalytics) and
 * `gaps` (detectGapsRAG) and passes them in. Returns '' when there's nothing
 * meaningful to report (e.g. an empty deck on a 'build').
 *
 * @param {Object} input
 * @param {Object} input.analytics - computeDeckAnalytics output
 * @param {Array}  input.gaps      - detectGapsRAG output (optional)
 * @returns {string}
 */
export function buildDeckDiagnostics({ analytics, gaps } = {}) {
  if (!analytics) return '';
  const tb = analytics.typeBreakdown || {};
  const totalCards = Object.values(tb).reduce((s, n) => s + (n || 0), 0);
  if (totalCards === 0) return '';

  const lines = [];
  lines.push(`- Cards in list: ${totalCards} (lands: ${tb.Land || 0}, creatures: ${tb.Creature || 0})`);
  if (typeof analytics.averageCmc === 'number' && analytics.averageCmc > 0) {
    lines.push(`- Average CMC (non-land): ${analytics.averageCmc.toFixed(2)}`);
  }
  const cp = analytics.colourPie || {};
  const pips = ['W', 'U', 'B', 'R', 'G', 'C'].filter(c => cp[c]).map(c => `${c}:${cp[c]}`).join(' ');
  if (pips) lines.push(`- Colour pips: ${pips}`);

  if (Array.isArray(gaps) && gaps.length) {
    const flagged = gaps.filter(g => g && g.severity && g.severity !== 'green');
    if (flagged.length) {
      lines.push(
        `- Category gaps (below the recommended count): ` +
        flagged.map(g => `${g.category} ${g.count}/${g.threshold} [${g.severity}${g.suggestedAdd ? `, wants +${g.suggestedAdd}` : ''}]`).join('; ')
      );
    } else {
      lines.push(`- Category coverage: every functional category is at or above its target.`);
    }
  }

  return [
    `## Deck diagnostics (computed locally from the current list — authoritative, do not recompute)`,
    ...lines,
    `Use these to target the deck's real weaknesses rather than re-deriving them from the card list.`,
  ].join('\n');
}
