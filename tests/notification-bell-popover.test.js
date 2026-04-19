import { describe, it, expect } from 'vitest';
import { renderNotificationBellPopover } from '../src/components/notification-bell-popover.js';

describe('renderNotificationBellPopover', () => {
  it('returns a string with x-data declaring open:false and shorthand accessors for errors and alerts counts', () => {
    const html = renderNotificationBellPopover();
    expect(typeof html).toBe('string');
    expect(html).toContain('x-data="{ open: false');
    // Reactive accessors to the store fields the popover reads
    expect(html).toContain('$store.market.syncErrorCount');
    expect(html).toContain('$store.market.pendingAlerts');
  });

  it('bell button toggles open flag and shows badge only when unifiedBadgeCount > 0', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('@click="open = !open"');
    expect(html).toContain('x-show="$store.market && $store.market.unifiedBadgeCount > 0"');
    expect(html).toContain('x-text="$store.market?.unifiedBadgeCount"');
    expect(html).toContain('aria-label="Notifications"');
    expect(html).toContain(':aria-expanded="open"');
  });

  it('popover has @click.outside and @keydown.escape.window handlers', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('@click.outside="open = false"');
    // Pitfall 4 guard — guard Escape on the open flag to avoid swallowing for
    // other consumers if the popover is already closed.
    expect(html).toContain('@keydown.escape.window="if (open) open = false"');
  });

  it('popover uses x-cloak and x-transition (Pitfall 6)', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('x-cloak');
    expect(html).toContain('x-transition');
  });

  it('SYNC ERRORS section is x-show gated on syncErrorCount > 0 and calls window.openSyncErrorsModal', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('SYNC ERRORS');
    expect(html).toContain('x-show="$store.market.syncErrorCount > 0"');
    expect(html).toContain('VIEW SYNC ERRORS');
    expect(html).toContain('window.openSyncErrorsModal()');
  });

  it('PRICE ALERTS section is x-show gated on pendingAlerts.length > 0 and navigates to watchlist', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('PRICE ALERTS');
    expect(html).toContain('x-show="$store.market.pendingAlerts.length > 0"');
    expect(html).toContain('GO TO WATCHLIST');
    expect(html).toContain("window.__counterflux_router.navigate('/preordain')");
    expect(html).toContain("$store.market.setTab('watchlist')");
  });

  it('shows empty state when unifiedBadgeCount is zero', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('x-show="$store.market.unifiedBadgeCount === 0"');
    // One of the approved empty-state copy options from CONTEXT Claude's Discretion
    expect(html).toMatch(/All clear|No notifications/);
  });

  it('section headers use Neo-Occult Terminal mono-font styling', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('font-mono');
    expect(html).toContain('uppercase');
    expect(html).toContain('tracking-[0.15em]');
    // Muted header colour — accept either literal or CSS var
    expect(html).toMatch(/#7A8498|var\(--color-text-muted\)/);
  });

  it('popover width is 320px', () => {
    const html = renderNotificationBellPopover();
    // Accept either the Tailwind v4 arbitrary class or an inline style
    expect(html).toMatch(/w-\[320px\]|width:\s*320px/);
  });

  it('price alert rows iterate pendingAlerts', () => {
    const html = renderNotificationBellPopover();
    expect(html).toContain('x-for="alert in $store.market.pendingAlerts"');
  });
});
