import { renderEmptyState } from '../components/empty-state.js';

/**
 * Vandalblast -- Game Tracker (locked, Phase 5).
 */
export function mount(container) {
  renderEmptyState(container, {
    heading: 'Game Tracker Coming Soon',
    body: 'No games in the archive. This screen will track life totals, commander damage, and game history when Phase 5 is complete.',
  });
}
