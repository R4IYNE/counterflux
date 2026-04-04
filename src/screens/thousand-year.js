import { renderEmptyState } from '../components/empty-state.js';

/**
 * Thousand-Year Storm -- Deck Builder (locked, Phase 3).
 */
export function mount(container) {
  renderEmptyState(container, {
    heading: 'Deck Builder Coming Soon',
    body: "The storm hasn't gathered yet. This screen will let you build Commander decks with live analytics when Phase 3 is complete.",
  });
}
