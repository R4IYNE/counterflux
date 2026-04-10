// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Router and screen module tests.
 *
 * Tests route-to-screen mapping and screen module exports.
 * Navigo is not instantiated in tests -- we test the routing logic
 * by verifying screen modules export mount() and by testing
 * the route configuration mapping.
 */

describe('Screen modules', () => {
  it('welcome.js exports a mount function', async () => {
    const mod = await import('../src/screens/welcome.js');
    expect(typeof mod.mount).toBe('function');
  });

  it('epic-experiment.js exports a mount function', async () => {
    const mod = await import('../src/screens/epic-experiment.js');
    expect(typeof mod.mount).toBe('function');
  });

  it('treasure-cruise.js exports a mount function', async () => {
    const mod = await import('../src/screens/treasure-cruise.js');
    expect(typeof mod.mount).toBe('function');
  });

  it('thousand-year.js exports a mount function', async () => {
    const mod = await import('../src/screens/thousand-year.js');
    expect(typeof mod.mount).toBe('function');
  });

  it('preordain.js exports a mount function', async () => {
    const mod = await import('../src/screens/preordain.js');
    expect(typeof mod.mount).toBe('function');
  });

  it('vandalblast.js exports a mount function', async () => {
    const mod = await import('../src/screens/vandalblast.js');
    expect(typeof mod.mount).toBe('function');
  });
});

describe('Router configuration', () => {
  it('router.js exports initRouter and router', async () => {
    const mod = await import('../src/router.js');
    expect(typeof mod.initRouter).toBe('function');
    expect('router' in mod).toBe(true);
  });

  it('route "/" maps to epic-experiment screen (dashboard)', async () => {
    const mod = await import('../src/router.js');
    expect(mod.ROUTE_MAP['/']).toBe('epic-experiment');
  });

  it('route "/epic-experiment" maps to epic-experiment screen', async () => {
    const mod = await import('../src/router.js');
    expect(mod.ROUTE_MAP['/epic-experiment']).toBe('epic-experiment');
  });

  it('all 6 routes are defined', async () => {
    const mod = await import('../src/router.js');
    const routes = Object.keys(mod.ROUTE_MAP);
    expect(routes).toContain('/');
    expect(routes).toContain('/epic-experiment');
    expect(routes).toContain('/treasure-cruise');
    expect(routes).toContain('/thousand-year-storm');
    expect(routes).toContain('/preordain');
    expect(routes).toContain('/vandalblast');
    expect(routes).toHaveLength(6);
  });
});

describe('Screen content', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('welcome screen renders greeting text', async () => {
    const { mount } = await import('../src/screens/welcome.js');
    mount(container);
    expect(container.textContent).toContain('COUNTERFLUX');
  });

  it('epic-experiment shows dashboard with PORTFOLIO SUMMARY', async () => {
    // Mocking Alpine stores for the dashboard screen
    const Alpine = (await import('alpinejs')).default;
    Alpine.store('collection', { entries: [], stats: { totalCards: 0, uniqueCards: 0, estimatedValue: 0 } });
    Alpine.store('deck', { decks: [] });
    Alpine.store('market', { pendingAlerts: [] });
    Alpine.store('toast', { success() {}, error() {}, show() {} });
    Alpine.start();
    const { mount } = await import('../src/screens/epic-experiment.js');
    mount(container);
    expect(container.textContent).toContain('PORTFOLIO SUMMARY');
  });

  it('thousand-year shows deck landing with "DECK ARCHIVE"', async () => {
    const { mount } = await import('../src/screens/thousand-year.js');
    mount(container);
    expect(container.textContent).toContain('DECK ARCHIVE');
  });

  it('treasure-cruise shows "Archive Manifest" heading', async () => {
    const { mount } = await import('../src/screens/treasure-cruise.js');
    mount(container);
    expect(container.textContent).toContain('Archive Manifest');
  });

  it('preordain shows "PREORDAIN // MARKET INTEL" overline', async () => {
    const { mount } = await import('../src/screens/preordain.js');
    mount(container);
    expect(container.textContent).toContain('PREORDAIN // MARKET INTEL');
  });

  it('vandalblast shows game tracker screen with setup', async () => {
    const { mount } = await import('../src/screens/vandalblast.js');
    mount(container);
    expect(container.innerHTML).toContain('VANDALBLAST // GAME TRACKER');
    expect(container.innerHTML).toContain('ACTIVE GAME');
    expect(container.innerHTML).toContain('HISTORY');
    expect(container.innerHTML).toContain('NEW GAME');
    expect(container.innerHTML).toContain('Start Game');
  });

  it('empty states include Mila image in welcome overlay', async () => {
    const Alpine = (await import('alpinejs')).default;
    Alpine.store('collection', { entries: [], stats: { totalCards: 0, uniqueCards: 0, estimatedValue: 0 } });
    Alpine.store('deck', { decks: [] });
    Alpine.store('market', { pendingAlerts: [] });
    Alpine.store('toast', { success() {}, error() {}, show() {} });
    const { mount } = await import('../src/screens/epic-experiment.js');
    mount(container);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.alt).toContain('Mila');
  });
});
