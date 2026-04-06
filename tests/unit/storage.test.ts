import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createStorageHealth,
  formatBytes,
  formatStorageSummary,
  getStorageHealth,
  hasAttemptedPersistentStorage,
  isDatabaseClosedError,
  isQuotaExceededError,
  recordStorageConnectionDrop,
  recordStorageReconnectFailure,
  recordStorageReconnectSuccess,
  recordStorageWriteVerification,
  requestPersistentStorage,
  resetStorageDurabilityDiagnostics
} from '../../src/lib/storage';

function setNavigatorStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storage
  });
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent
  });
}

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(display-mode: standalone)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function setNavigatorStandalone(standalone: boolean | undefined) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone
  });
}

describe('storage helpers', () => {
  afterEach(() => {
    localStorage.clear();
    resetStorageDurabilityDiagnostics();
    setNavigatorStorage(undefined);
    setUserAgent('Mozilla/5.0');
    setMatchMedia(false);
    setNavigatorStandalone(undefined);
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
    expect(health.safari.persistAttempted).toBe(true);
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

  it('elevates iPhone and iPad browser storage to warning when not installed', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    setMatchMedia(false);

    const health = createStorageHealth({ usage: 100, quota: 1000 }, false, true);

    expect(health.status).toBe('warning');
    expect(health.message).toContain('Install to Home Screen');
    expect(health.safari.installRecommended).toBe(true);
  });

  it('does not classify installed iPhone and iPad PWA mode as the same inactivity risk', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    setMatchMedia(true);
    setNavigatorStandalone(true);

    const health = createStorageHealth({ usage: 100, quota: 1000 }, false, true);

    expect(health.status).toBe('monitor');
    expect(health.message).toContain('Home Screen mode reduces Safari inactivity eviction risk');
    expect(health.safari.standaloneMode).toBe(true);
  });

  it('keeps installed iPhone and iPad PWA messaging conservative when protection is granted', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    setMatchMedia(true);
    setNavigatorStandalone(true);

    const summary = formatStorageSummary(
      createStorageHealth({ usage: 100, quota: 1000 }, true, true)
    );

    expect(summary).toContain('Best-effort protection active');
  });

  it('uses conservative protection language on Safari-family risk platforms', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15');
    setMatchMedia(false);

    const summary = formatStorageSummary(
      createStorageHealth({ usage: 100, quota: 1000 }, true, true)
    );

    expect(summary).toContain('Best-effort protection active');
  });

  it('surfaces reconnect and write verification diagnostics in storage health', () => {
    recordStorageConnectionDrop();
    recordStorageReconnectSuccess();
    recordStorageWriteVerification('verified');

    const health = createStorageHealth({ usage: 100, quota: 1000 }, false, true);

    expect(health.safari.connectionDropsDetected).toBe(1);
    expect(health.safari.reconnectSuccesses).toBe(1);
    expect(health.safari.lastVerificationResult).toBe('verified');
    expect(formatStorageSummary(health)).toContain('Session reconnect events: 1.');
  });

  it('elevates storage health when reconnect recovery fails', () => {
    recordStorageConnectionDrop();
    recordStorageReconnectFailure(new Error('Connection to Indexed Database server lost'));

    const health = createStorageHealth({ usage: 100, quota: 1000 }, true, true);

    expect(health.status).toBe('warning');
    expect(health.message).toContain('reconnection failed');
  });

  it('elevates storage health when write verification mismatches', () => {
    recordStorageWriteVerification('mismatch');

    const health = createStorageHealth({ usage: 100, quota: 1000 }, true, true);

    expect(health.status).toBe('warning');
    expect(health.message).toContain('write verification failed');
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
