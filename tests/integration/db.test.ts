import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cycleDailyStatus,
  db,
  isDatabaseRecoveryRequired,
  reopenIfClosed,
  setDailyStatus,
  shouldBlockVersionChangeReload
} from '../../src/db/appDb';
import {
  getStorageDurabilityDiagnostics,
  resetStorageDurabilityDiagnostics
} from '../../src/lib/storage';

describe('database operations', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    resetStorageDurabilityDiagnostics();

    if (!db.isOpen()) {
      await db.open();
    }

    await db.dailyEntries.clear();
  });

  it('cycles through nominal, degraded, then unmarked', async () => {
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe('nominal');
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe('degraded');
    await expect(cycleDailyStatus('2026-03-27', 'body')).resolves.toBe('unmarked');
  });

  it('stores and removes entries by compound key', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');
    let stored = await db.dailyEntries.where('[date+sectorId]').equals(['2026-03-27', 'rest']).first();

    expect(stored?.status).toBe('nominal');

    await setDailyStatus('2026-03-27', 'rest', 'unmarked');
    stored = await db.dailyEntries.where('[date+sectorId]').equals(['2026-03-27', 'rest']).first();

    expect(stored).toBeUndefined();
  });

  it('verifies the persisted write after a daily status save', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(diagnostics.lastVerificationResult).toBe('verified');
    expect(diagnostics.lastVerifiedAt).not.toBeNull();
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
    const openSpy = vi.spyOn(db, 'open').mockRejectedValue(new Error('Connection to Indexed Database server lost'));

    db.close();

    const reopenPromise = expect(reopenIfClosed()).rejects.toThrow('Recovery reload initiated');

    await vi.advanceTimersByTimeAsync(450);
    await reopenPromise;

    const diagnostics = getStorageDurabilityDiagnostics();

    expect(diagnostics.reconnectFailures).toBe(1);
    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);

    vi.clearAllTimers();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('blocks repeated schema reloads inside the guard window', () => {
    expect(shouldBlockVersionChangeReload(10_000, null)).toBe(false);
    expect(shouldBlockVersionChangeReload(10_000, 4_500)).toBe(false);
    expect(shouldBlockVersionChangeReload(10_000, 9_500)).toBe(true);
  });

  it('pins Chromium transaction durability to strict where supported', () => {
    const options = (db as typeof db & {
      _options?: { chromeTransactionDurability?: string };
    })._options;

    expect(options?.chromeTransactionDurability).toBe('strict');
  });
});
