import { renderEmptyState } from '../components/empty-state.js';

/**
 * Treasure Cruise -- Collection Manager (locked, Phase 2).
 */
export function mount(container) {
  renderEmptyState(container, {
    heading: 'Collection Manager Coming Soon',
    body: 'No treasures catalogued yet. This screen will track your entire MTG collection when Phase 2 is complete.',
  });
}
