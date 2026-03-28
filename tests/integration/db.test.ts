import { beforeEach, describe, expect, it } from 'vitest';

import { cycleDailyStatus, db, setDailyStatus } from '../../src/db/appDb';

describe('database operations', () => {
  beforeEach(async () => {
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
});
