import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getConnectivityStatus } from '../src/utils/connectivity.js';

describe('Connectivity Status', () => {
  it('returns offline when not online', () => {
    const result = getConnectivityStatus(false, null);
    expect(result.state).toBe('offline');
    expect(result.label).toBe('OFFLINE');
    expect(result.color).toBe('secondary');
  });

  it('returns live when online and data is fresh', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const result = getConnectivityStatus(true, recent);
    expect(result.state).toBe('live');
    expect(result.label).toBe('LIVE');
    expect(result.color).toBe('success');
  });

  it('returns stale when online but data is >24h old', () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(); // 25 hours ago
    const result = getConnectivityStatus(true, old);
    expect(result.state).toBe('stale');
    expect(result.label).toBe('STALE 25H');
    expect(result.color).toBe('warning');
  });

  it('returns live when online and bulkDataUpdatedAt is null', () => {
    const result = getConnectivityStatus(true, null);
    expect(result.state).toBe('live');
    expect(result.label).toBe('LIVE');
  });

  it('stale hours calculation is accurate', () => {
    const fortyEightHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
    const result = getConnectivityStatus(true, fortyEightHoursAgo);
    expect(result.state).toBe('stale');
    expect(result.label).toBe('STALE 48H');
  });

  it('returns live when data is exactly 24h old (boundary)', () => {
    // At exactly 24h, the diff equals 86400000 which is NOT > 86400000
    const exactlyTwentyFour = new Date(Date.now() - 86400000).toISOString();
    const result = getConnectivityStatus(true, exactlyTwentyFour);
    expect(result.state).toBe('live');
  });

  it('returns stale when data is 24h + 1ms old', () => {
    const justOver = new Date(Date.now() - 86400001).toISOString();
    const result = getConnectivityStatus(true, justOver);
    expect(result.state).toBe('stale');
  });
});

describe('POLISH-08: pulsing dot (D-26)', () => {
  const css = readFileSync('src/styles/main.css', 'utf-8');
  const html = readFileSync('index.html', 'utf-8');

  it('@keyframes cf-pulse is defined in main.css', () => {
    expect(css).toMatch(/@keyframes cf-pulse/);
  });

  it('.cf-live-dot rule declares animation using cf-pulse', () => {
    // The animation declaration lives inside the .cf-live-dot block
    expect(css).toMatch(/\.cf-live-dot\s*\{[\s\S]*?animation:\s*cf-pulse/);
  });

  it('live state binds cf-live-dot class (index.html template audit)', () => {
    // Binding: 'cf-live-dot': color === 'success'
    expect(html).toMatch(/['"]cf-live-dot['"]\s*:\s*color\s*===\s*['"]success['"]/);
  });

  it('warning state uses static bg-warning (no pulse)', () => {
    expect(html).toMatch(/bg-warning['"]\s*:\s*color\s*===\s*['"]warning['"]/);
  });

  it('offline/error state uses static bg-secondary (no pulse)', () => {
    expect(html).toMatch(/bg-secondary['"]\s*:\s*color\s*===\s*['"]secondary['"]/);
  });

  it('connectivity utility still returns { state, label, color } shape (D-26 guard)', () => {
    const live = getConnectivityStatus(true, new Date().toISOString());
    expect(live).toHaveProperty('state');
    expect(live).toHaveProperty('label');
    expect(live).toHaveProperty('color');
    expect(live.color).toBe('success');
  });
});

