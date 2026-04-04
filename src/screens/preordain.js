import { renderEmptyState } from '../components/empty-state.js';

/**
 * Preordain -- Market Intel (locked, Phase 5).
 */
export function mount(container) {
  renderEmptyState(container, {
    heading: 'Market Intel Coming Soon',
    body: 'The future is still hazy. This screen will show spoilers, price watchlists, and market trends when Phase 5 is complete.',
  });
}
