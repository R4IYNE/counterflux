import { describe, it, expect } from 'vitest';
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
