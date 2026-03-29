import { beforeEach, describe, expect, it } from 'vitest';

import {
  cycleDailyStatus,
  db,
  isDatabaseRecoveryRequired,
  reopenIfClosed,
  setDailyStatus
} from '../../src/db/appDb';

describe('database operations', () => {
  beforeEach(async () => {
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

  it('marks the database for recovery after closure and reopens cleanly', async () => {
    db.close();

    expect(isDatabaseRecoveryRequired()).toBe(true);

    await reopenIfClosed();

    expect(db.isOpen()).toBe(true);
    expect(isDatabaseRecoveryRequired()).toBe(false);
  });
});
