import { describe, expect, it } from 'vitest';

import { getNextStatus, getStatusCellText, getStatusLabel, getStatusShortLabel } from '../../src/lib/status';

describe('status helpers', () => {
  it('cycles unmarked to nominal to degraded and back to unmarked', () => {
    expect(getNextStatus('unmarked')).toBe('nominal');
    expect(getNextStatus('nominal')).toBe('degraded');
    expect(getNextStatus('degraded')).toBe('unmarked');
  });

  it('returns the correct labels and cell text for each status', () => {
    expect(getStatusLabel('unmarked')).toBe('UNMARKED');
    expect(getStatusLabel('nominal')).toBe('NOMINAL');
    expect(getStatusLabel('degraded')).toBe('DEGRADED');

    expect(getStatusShortLabel('unmarked')).toBe('UN');
    expect(getStatusShortLabel('nominal')).toBe('OK');
    expect(getStatusShortLabel('degraded')).toBe('DG');

    expect(getStatusCellText('unmarked')).toBe('UN');
    expect(getStatusCellText('nominal')).toBe('OK');
    expect(getStatusCellText('degraded')).toBe('DG');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatBytes,
  getStorageHealth,
  hasAttemptedPersistentStorage,
  isDatabaseClosedError,
  isQuotaExceededError,
  requestPersistentStorage
} from '../../src/lib/storage';

function setNavigatorStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storage
  });
}

describe('storage helpers', () => {
  afterEach(() => {
    localStorage.clear();
    setNavigatorStorage(undefined);
    vi.restoreAllMocks();
  });

  it('records a persistence request attempt and returns the browser result', async () => {
    setNavigatorStorage({
      persist: () => Promise.resolve(true)
    });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(hasAttemptedPersistentStorage()).toBe(true);
  });

  it('observes current storage posture without requesting persistence by default', async () => {
    const persist = vi.fn().mockResolvedValue(true);

    setNavigatorStorage({
      persist,
      persisted: () => Promise.resolve(false),
      estimate: () => Promise.resolve({ usage: 1024, quota: 1024 * 1024 })
    });

    const health = await getStorageHealth();

    expect(health.persisted).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(hasAttemptedPersistentStorage()).toBe(false);
  });

  it('requests persistence only when explicitly asked after user action', async () => {
    const persist = vi.fn().mockResolvedValue(true);

    setNavigatorStorage({
      persist,
      persisted: () => Promise.resolve(false),
      estimate: () => Promise.resolve({ usage: 1024 * 1024, quota: 1024 * 1024 * 100 })
    });

    const health = await getStorageHealth({ requestPersistence: true });

    expect(persist).toHaveBeenCalledTimes(1);
    expect(health.persisted).toBe(true);
    expect(health.status).toBe('protected');
    expect(hasAttemptedPersistentStorage()).toBe(true);
  });

  it('builds protected storage health when persistence is already granted', async () => {
    setNavigatorStorage({
      persisted: () => Promise.resolve(true),
      estimate: () => Promise.resolve({ usage: 1024 * 1024, quota: 1024 * 1024 * 100 })
    });

    const health = await getStorageHealth();

    expect(health.persisted).toBe(true);
    expect(health.status).toBe('protected');
    expect(health.message).toContain('Persistent storage active.');
  });

  it('warns when storage is not persistent and quota usage is elevated', async () => {
    setNavigatorStorage({
      persisted: () => Promise.resolve(false),
      estimate: () => Promise.resolve({ usage: 90, quota: 100 })
    });

    const health = await getStorageHealth();

    expect(health.persisted).toBe(false);
    expect(health.status).toBe('warning');
    expect(health.message).toContain('Export now.');
  });

  it('formats byte counts in human-readable form', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('detects quota errors wrapped inside abort errors', () => {
    expect(
      isQuotaExceededError({
        name: 'AbortError',
        inner: {
          name: 'QuotaExceededError'
        }
      })
    ).toBe(true);
  });

  it('detects database closed errors from browser-specific messages', () => {
    expect(
      isDatabaseClosedError({
        name: 'UnknownError',
        message: 'Connection to Indexed Database server lost'
      })
    ).toBe(true);
  });
});
