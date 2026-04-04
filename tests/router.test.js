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

  it('route "/" maps to welcome screen', async () => {
    const mod = await import('../src/router.js');
    expect(mod.ROUTE_MAP['/']).toBe('welcome');
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

  it('epic-experiment shows "Dashboard Coming Soon"', async () => {
    const { mount } = await import('../src/screens/epic-experiment.js');
    mount(container);
    expect(container.textContent).toContain('Dashboard Coming Soon');
  });

  it('thousand-year shows "Deck Builder Coming Soon"', async () => {
    const { mount } = await import('../src/screens/thousand-year.js');
    mount(container);
    expect(container.textContent).toContain('Deck Builder Coming Soon');
  });

  it('treasure-cruise shows "Archive Manifest" heading', async () => {
    const { mount } = await import('../src/screens/treasure-cruise.js');
    mount(container);
    expect(container.textContent).toContain('Archive Manifest');
  });

  it('preordain shows "Market Intel Coming Soon"', async () => {
    const { mount } = await import('../src/screens/preordain.js');
    mount(container);
    expect(container.textContent).toContain('Market Intel Coming Soon');
  });

  it('vandalblast shows "Game Tracker Coming Soon"', async () => {
    const { mount } = await import('../src/screens/vandalblast.js');
    mount(container);
    expect(container.textContent).toContain('Game Tracker Coming Soon');
  });

  it('empty states include Mila image with grayscale', async () => {
    const { mount } = await import('../src/screens/epic-experiment.js');
    mount(container);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.alt).toContain('Mila');
    expect(img.style.filter).toContain('grayscale');
  });
});
