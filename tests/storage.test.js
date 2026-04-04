import { describe, it, expect, vi } from 'vitest';
import { requestPersistentStorage, getStorageEstimate } from '../src/utils/storage.js';

describe('Storage utils', () => {
  describe('requestPersistentStorage', () => {
    it('returns { supported: false } when persist is unavailable', async () => {
      const result = await requestPersistentStorage({});
      expect(result).toEqual({ supported: false });
    });

    it('returns { supported: true, granted: true } when already persisted', async () => {
      const mockStorage = {
        persist: vi.fn(),
        persisted: vi.fn().mockResolvedValue(true),
      };
      const result = await requestPersistentStorage(mockStorage);
      expect(result).toEqual({ supported: true, granted: true });
    });

    it('returns { supported: true, granted } based on persist() result', async () => {
      const mockStorage = {
        persist: vi.fn().mockResolvedValue(false),
        persisted: vi.fn().mockResolvedValue(false),
      };
      const result = await requestPersistentStorage(mockStorage);
      expect(result).toEqual({ supported: true, granted: false });
    });

    it('returns object with supported and granted keys', async () => {
      const mockStorage = {
        persist: vi.fn().mockResolvedValue(true),
        persisted: vi.fn().mockResolvedValue(false),
      };
      const result = await requestPersistentStorage(mockStorage);
      expect(result).toHaveProperty('supported');
      expect(result).toHaveProperty('granted');
      expect(result.supported).toBe(true);
      expect(result.granted).toBe(true);
    });
  });

  describe('getStorageEstimate', () => {
    it('returns null when estimate is unavailable', async () => {
      const result = await getStorageEstimate({});
      expect(result).toBeNull();
    });

    it('returns usage, quota, and percentUsed', async () => {
      const mockStorage = {
        estimate: vi.fn().mockResolvedValue({ usage: 500000, quota: 1000000 }),
      };
      const result = await getStorageEstimate(mockStorage);
      expect(result).toEqual({ usage: 500000, quota: 1000000, percentUsed: 50 });
    });
  });
});
