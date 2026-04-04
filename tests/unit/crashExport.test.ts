import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db, setDailyStatus } from '../../src/db/appDb';
import {
  applyOpsNormalDbSchema,
  OPSNORMAL_DB_NAME,
  OPSNORMAL_DB_SCHEMA_VERSIONS
} from '../../src/db/schema';
import { readEntriesForCrashExport } from '../../src/lib/crashExport';

const TEST_DATE_KEY = '2026-03-28';

describe('crash export isolation', () => {
  beforeEach(async () => {
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  afterEach(async () => {
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  it('reads entries written through the primary database schema', async () => {
    await setDailyStatus(TEST_DATE_KEY, 'body', 'nominal');
    await setDailyStatus(TEST_DATE_KEY, 'rest', 'degraded');

    const entries = await readEntriesForCrashExport();

    expect(entries).toHaveLength(2);
    expect(
      entries.map((entry) => ({
        date: entry.date,
        sectorId: entry.sectorId,
        status: entry.status
      }))
    ).toEqual([
      { date: TEST_DATE_KEY, sectorId: 'body', status: 'nominal' },
      { date: TEST_DATE_KEY, sectorId: 'rest', status: 'degraded' }
    ]);
  });

  it('applies the shared schema versions to isolated Dexie connections', async () => {
    const tempDb = new Dexie('opsnormal-crash-export-schema-test');
    applyOpsNormalDbSchema(tempDb);

    try {
      await tempDb.open();

      expect(OPSNORMAL_DB_SCHEMA_VERSIONS).toEqual([
        {
          version: 1,
          stores: {
            dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
          }
        },
        {
          version: 2,
          stores: {
            dailyEntries: '++id, &[date+sectorId]'
          }
        }
      ]);
      expect(tempDb.tables.map((table) => table.name)).toEqual(['dailyEntries']);
    } finally {
      tempDb.close();
      await Dexie.delete('opsnormal-crash-export-schema-test');
    }
  });
});
