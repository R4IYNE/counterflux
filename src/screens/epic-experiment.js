import { renderEmptyState } from '../components/empty-state.js';

/**
 * Epic Experiment -- Dashboard (locked, Phase 6).
 */
export function mount(container) {
  renderEmptyState(container, {
    heading: 'Dashboard Coming Soon',
    body: 'Mila is still calibrating the experiment. This screen will show your portfolio summary, activity feed, and deck quick-launch when Phase 6 is complete.',
  });
}
