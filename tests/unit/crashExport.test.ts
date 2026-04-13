import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db, setDailyStatus } from '../../src/db/appDb';
import {
  applyOpsNormalDbSchema,
  OPSNORMAL_DB_NAME,
  OPSNORMAL_DB_SCHEMA_VERSIONS,
} from '../../src/db/schema';
import {
  deleteOpsNormalDatabase,
  readCrashExportSnapshot,
  readEntriesForCrashExport,
} from '../../src/lib/crashExport';
import { resetStorageDurabilityDiagnostics } from '../../src/lib/storage';

const TEST_DATE_KEY = '2026-03-28';
const TEST_UPDATED_AT = '2026-03-28T12:00:00.000Z';

describe('crash export isolation', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    resetStorageDurabilityDiagnostics();
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetStorageDurabilityDiagnostics();
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  it('reads entries written through the primary database schema', async () => {
    await setDailyStatus(TEST_DATE_KEY, 'body', 'nominal');
    await setDailyStatus(TEST_DATE_KEY, 'rest', 'degraded');

    const snapshot = await readCrashExportSnapshot();

    expect(snapshot.skippedCount).toBe(0);
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.storageDiagnostics.lastVerificationResult).toBe('verified');
    expect(
      snapshot.entries.map((entry) => ({
        date: entry.date,
        sectorId: entry.sectorId,
        status: entry.status,
      })),
    ).toEqual([
      { date: TEST_DATE_KEY, sectorId: 'body', status: 'nominal' },
      { date: TEST_DATE_KEY, sectorId: 'rest', status: 'degraded' },
    ]);
  });

  it('skips malformed rows while preserving recoverable entries', async () => {
    const tempDb = new Dexie(OPSNORMAL_DB_NAME);
    applyOpsNormalDbSchema(tempDb);

    const malformedRows: Array<Record<string, unknown>> = [
      {
        date: TEST_DATE_KEY,
        sectorId: 'body',
        status: 'nominal',
        updatedAt: TEST_UPDATED_AT,
      },
      {
        date: TEST_DATE_KEY,
        sectorId: 'household',
        status: 'invalid-status',
        updatedAt: TEST_UPDATED_AT,
      },
      {
        date: 'bad-date',
        sectorId: 'rest',
        status: 'degraded',
        updatedAt: TEST_UPDATED_AT,
      },
    ];

    try {
      await tempDb.table('dailyEntries').bulkAdd(malformedRows);
    } finally {
      tempDb.close();
    }

    const snapshot = await readCrashExportSnapshot();

    expect(snapshot.skippedCount).toBe(2);
    expect(snapshot.entries).toEqual([
      {
        date: TEST_DATE_KEY,
        sectorId: 'body',
        status: 'nominal',
        updatedAt: TEST_UPDATED_AT,
      },
    ]);
    await expect(readEntriesForCrashExport()).resolves.toEqual(
      snapshot.entries,
    );
  });

  it('deletes the OpsNormal database through the isolated crash-recovery helper', async () => {
    await setDailyStatus(TEST_DATE_KEY, 'body', 'nominal');
    await setDailyStatus(TEST_DATE_KEY, 'rest', 'degraded');

    db.close();
    await deleteOpsNormalDatabase();

    const tempDb = new Dexie(OPSNORMAL_DB_NAME);
    applyOpsNormalDbSchema(tempDb);

    try {
      const entries = await tempDb.table('dailyEntries').toArray();
      expect(entries).toEqual([]);
    } finally {
      tempDb.close();
    }
  });

  it('treats deleting a missing OpsNormal database as a clean no-op', async () => {
    await expect(deleteOpsNormalDatabase()).resolves.toBeUndefined();
  });

  it('fails deterministically when database deletion stays blocked past the timeout window', async () => {
    vi.useFakeTimers();
    vi.spyOn(Dexie, 'delete').mockImplementationOnce(
      () => new Promise<void>(() => undefined),
    );

    const deletionOutcome = deleteOpsNormalDatabase().then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );

    await vi.advanceTimersByTimeAsync(3000);

    const result = await deletionOutcome;

    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe(
        'Local data reset timed out. Close duplicate OpsNormal tabs, then retry or clear site data manually through the browser.',
      );
    }
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
            dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt',
          },
        },
        {
          version: 2,
          stores: {
            dailyEntries: '++id, &[date+sectorId]',
          },
        },
      ]);
      expect(tempDb.tables.map((table) => table.name)).toEqual([
        'dailyEntries',
      ]);
    } finally {
      tempDb.close();
      await Dexie.delete('opsnormal-crash-export-schema-test');
    }
  });
});
