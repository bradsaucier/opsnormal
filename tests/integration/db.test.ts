import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reloadCurrentPage: vi.fn(),
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage,
  };
});

import {
  closeDatabaseForServiceWorkerHandoff,
  cycleDailyStatus,
  db,
  handleDatabaseReady,
  handleDatabaseUpgradeBlocked,
  handleDatabaseVersionChange,
  isDatabaseRecoveryRequired,
  isDatabaseUpgradeBlocked,
  OPSNORMAL_DB_BLOCKED_EVENT_NAME,
  OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
  reopenIfClosed,
  setDailyStatus,
  shouldBlockVersionChangeReload,
  shouldSuppressControllerReload,
} from '../../src/db/appDb';
import {
  getStorageDurabilityDiagnostics,
  resetStorageDurabilityDiagnostics,
} from '../../src/lib/storage';

describe('database operations', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    mocks.reloadCurrentPage.mockReset();
    window.sessionStorage.clear();
    resetStorageDurabilityDiagnostics();

    handleDatabaseReady();

    if (!db.isOpen()) {
      await db.open();
    }

    await db.dailyEntries.clear();
  });

  it('cycles through nominal, degraded, then unmarked', async () => {
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe(
      'nominal',
    );
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe(
      'degraded',
    );
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe(
      'unmarked',
    );
  });

  it('stores and removes entries by compound key', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');
    let stored = await db.dailyEntries
      .where('[date+sectorId]')
      .equals(['2026-03-27', 'rest'])
      .first();

    expect(stored?.status).toBe('nominal');

    await setDailyStatus('2026-03-27', 'rest', 'unmarked');
    stored = await db.dailyEntries
      .where('[date+sectorId]')
      .equals(['2026-03-27', 'rest'])
      .first();

    expect(stored).toBeUndefined();
  });

  it('verifies the persisted write after a daily status save', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(diagnostics.lastVerificationResult).toBe('verified');
    expect(diagnostics.lastVerifiedAt).not.toBeNull();
  });

  it('dispatches an entry-written event after a verified daily-status save', async () => {
    const entryWrittenListener = vi.fn();

    window.addEventListener('opsnormal:entry-written', entryWrittenListener);

    try {
      await setDailyStatus('2026-03-27', 'rest', 'nominal');
    } finally {
      window.removeEventListener(
        'opsnormal:entry-written',
        entryWrittenListener,
      );
    }

    expect(entryWrittenListener).toHaveBeenCalledTimes(1);
    expect(
      (
        entryWrittenListener.mock.calls[0]?.[0] as CustomEvent<{
          source: string;
        }>
      ).detail,
    ).toEqual({
      source: 'daily-status',
    });
  });

  it('dispatches an entry-written event after a verified clear to unmarked', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');
    const entryWrittenListener = vi.fn();

    window.addEventListener('opsnormal:entry-written', entryWrittenListener);

    try {
      await setDailyStatus('2026-03-27', 'rest', 'unmarked');
    } finally {
      window.removeEventListener(
        'opsnormal:entry-written',
        entryWrittenListener,
      );
    }

    expect(entryWrittenListener).toHaveBeenCalledTimes(1);
    expect(
      (
        entryWrittenListener.mock.calls[0]?.[0] as CustomEvent<{
          source: string;
        }>
      ).detail,
    ).toEqual({
      source: 'daily-status',
    });
  });

  it('surfaces a blocked schema upgrade and clears the signal once the database becomes ready again', () => {
    const blockedListener = vi.fn();
    const unblockedListener = vi.fn();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    window.addEventListener(OPSNORMAL_DB_BLOCKED_EVENT_NAME, blockedListener);
    window.addEventListener(
      OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
      unblockedListener,
    );

    try {
      handleDatabaseUpgradeBlocked();

      expect(isDatabaseUpgradeBlocked()).toBe(true);
      expect(isDatabaseRecoveryRequired()).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Schema upgrade blocked by another OpsNormal tab. Close duplicate tabs or windows, then return here so the local upgrade can finish safely.',
      );
      expect(blockedListener).toHaveBeenCalledTimes(1);
      expect(
        (blockedListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>)
          .detail.message,
      ).toContain('Schema upgrade blocked by another OpsNormal tab.');

      handleDatabaseReady();

      expect(isDatabaseUpgradeBlocked()).toBe(false);
      expect(isDatabaseRecoveryRequired()).toBe(false);
      expect(unblockedListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(
        OPSNORMAL_DB_BLOCKED_EVENT_NAME,
        blockedListener,
      );
      window.removeEventListener(
        OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
        unblockedListener,
      );
    }
  });

  it('fails fast with an operator-facing message while a schema upgrade remains blocked', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      handleDatabaseUpgradeBlocked();

      await expect(reopenIfClosed()).rejects.toThrow(
        'Schema upgrade blocked by another OpsNormal tab. Close duplicate tabs or windows, then return here so the local upgrade can finish safely.',
      );
    } finally {
      handleDatabaseReady();
      consoleErrorSpy.mockRestore();
    }
  });

  it('marks the database for recovery after closure and reopens cleanly', async () => {
    db.close();

    expect(isDatabaseRecoveryRequired()).toBe(true);

    await reopenIfClosed();

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(db.isOpen()).toBe(true);
    expect(isDatabaseRecoveryRequired()).toBe(false);
    expect(diagnostics.connectionDropsDetected).toBe(1);
    expect(diagnostics.reconnectSuccesses).toBe(1);
  });

  it('schedules a recovery reload when repeated reopen attempts fail', async () => {
    vi.useFakeTimers();
    const openSpy = vi
      .spyOn(db, 'open')
      .mockRejectedValue(
        new Error('Connection to Indexed Database server lost'),
      );

    db.close();

    const reopenPromise = expect(reopenIfClosed()).rejects.toThrow(
      'Recovery reload initiated',
    );

    await vi.advanceTimersByTimeAsync(450);
    await reopenPromise;

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(diagnostics.reconnectFailures).toBe(1);
    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2000);

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a scheduled recovery reload if the database reconnects before the timer fires', async () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(db, 'open');

    openSpy.mockRejectedValueOnce(
      new Error('Connection to Indexed Database server lost'),
    );
    openSpy.mockRejectedValueOnce(
      new Error('Connection to Indexed Database server lost'),
    );
    openSpy.mockRejectedValueOnce(
      new Error('Connection to Indexed Database server lost'),
    );
    openSpy.mockResolvedValueOnce(db);

    db.close();

    const reopenPromise = expect(reopenIfClosed()).rejects.toThrow(
      'Recovery reload initiated',
    );

    await vi.advanceTimersByTimeAsync(450);
    await reopenPromise;

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();

    await expect(reopenIfClosed()).resolves.toBeUndefined();

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(diagnostics.reconnectFailures).toBe(1);
    expect(diagnostics.reconnectSuccesses).toBe(1);
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);

    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('blocks repeated schema reloads inside the guard window', () => {
    expect(shouldBlockVersionChangeReload(10_000, null)).toBe(false);
    expect(shouldBlockVersionChangeReload(10_000, 4_500)).toBe(false);
    expect(shouldBlockVersionChangeReload(10_000, 9_500)).toBe(true);
  });

  it('reports the controller reload guard when a recent schema handoff was recorded', () => {
    window.sessionStorage.setItem('opsnormal-schema-reload-guard', '10000');

    expect(shouldSuppressControllerReload(12_000)).toBe(true);
    expect(shouldSuppressControllerReload(15_001)).toBe(false);
  });

  it('records the controller handoff before the page reload path runs', () => {
    closeDatabaseForServiceWorkerHandoff(10_000);

    expect(isDatabaseRecoveryRequired()).toBe(true);
    expect(db.isOpen()).toBe(false);
    expect(window.sessionStorage.getItem('opsnormal-schema-reload-guard')).toBe(
      '10000',
    );
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();
  });

  it('records the schema handoff and reloads immediately when the guard is clear', () => {
    const closeSpy = vi.spyOn(db, 'close');

    expect(handleDatabaseVersionChange(10_000)).toBe('reloading');
    expect(isDatabaseRecoveryRequired()).toBe(true);
    expect(db.isOpen()).toBe(false);
    expect(window.sessionStorage.getItem('opsnormal-schema-reload-guard')).toBe(
      '10000',
    );
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);

    const closeCallOrder = closeSpy.mock.invocationCallOrder[0]!;
    const reloadCallOrder =
      mocks.reloadCurrentPage.mock.invocationCallOrder[0]!;

    expect(closeCallOrder).toBeLessThan(reloadCallOrder);
  });

  it('schedules one bounded schema-reload retry when the guard blocks an immediate reload', async () => {
    vi.useFakeTimers();
    const closeSpy = vi.spyOn(db, 'close');

    window.sessionStorage.setItem('opsnormal-schema-reload-guard', '10000');

    expect(handleDatabaseVersionChange(12_000)).toBe('blocked');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    await expect(reopenIfClosed()).rejects.toThrow(
      'Schema upgrade handoff stalled',
    );
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3049);

    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });

  it('fails open with an immediate reload when sessionStorage read throws during schema recovery', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });

    expect(handleDatabaseVersionChange(10_000)).toBe('reloading');
    expect(getItemSpy).toHaveBeenCalled();
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });

  it('routes Dexie versionchange events through the registered reload handler', () => {
    db.on('versionchange').fire(new Event('versionchange'));

    expect(isDatabaseRecoveryRequired()).toBe(true);
    expect(db.isOpen()).toBe(false);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });

  it('pins Chromium transaction durability to strict where supported', () => {
    const options = (
      db as typeof db & {
        _options?: { chromeTransactionDurability?: string };
      }
    )._options;

    expect(options?.chromeTransactionDurability).toBe('strict');
  });
});
