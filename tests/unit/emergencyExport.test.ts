import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db, setDailyStatus } from '../../src/db/appDb';
import { applyOpsNormalDbSchema, OPSNORMAL_DB_NAME } from '../../src/db/schema';
import {
  exportEmergencyCsvBackup,
  exportEmergencyJsonBackup,
} from '../../src/lib/emergencyExport';

const TEST_DATE_KEY = '2026-03-28';
const TEST_UPDATED_AT = '2026-03-28T12:00:00.000Z';

const mocks = vi.hoisted(() => ({
  downloadTextFile:
    vi.fn<(fileName: string, content: string, mimeType: string) => void>(),
  recordExportCompleted: vi.fn<(exportedAt: string) => void>(),
}));

vi.mock('../../src/lib/fileDownload', () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

vi.mock('../../src/lib/exportPersistence', () => ({
  recordExportCompleted: mocks.recordExportCompleted,
}));

describe('emergencyExport', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    db.close();
    await Dexie.delete(OPSNORMAL_DB_NAME);
  });

  it('exports JSON through the isolated crash-export helper backed by a temporary Dexie connection', async () => {
    await setDailyStatus(TEST_DATE_KEY, 'body', 'nominal');
    await setDailyStatus(TEST_DATE_KEY, 'rest', 'degraded');

    const result = await exportEmergencyJsonBackup('test-emergency.json');

    expect(result.recoveredCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(mocks.downloadTextFile).toHaveBeenCalledTimes(1);

    const [fileName, payload, mimeType] = mocks.downloadTextFile.mock
      .calls[0] as [string, string, string];

    expect(fileName).toBe('test-emergency.json');
    expect(mimeType).toBe('application/json');

    const parsed = JSON.parse(payload) as {
      entries: Array<{
        date: string;
        sectorId: string;
        status: string;
        updatedAt: string;
      }>;
      crashDiagnostics: unknown;
      exportedAt: string;
      checksum: string;
    };

    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]).toMatchObject({
      date: TEST_DATE_KEY,
      sectorId: 'body',
      status: 'nominal',
    });
    expect(parsed.entries[1]).toMatchObject({
      date: TEST_DATE_KEY,
      sectorId: 'rest',
      status: 'degraded',
    });
    expect(typeof parsed.entries[0]?.updatedAt).toBe('string');
    expect(typeof parsed.entries[1]?.updatedAt).toBe('string');
    expect(parsed.crashDiagnostics).toBeDefined();
    expect(parsed.exportedAt).toBe(result.exportedAt);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.recordExportCompleted).toHaveBeenCalledWith(result.exportedAt);
  });

  it('exports CSV and reports skipped malformed rows from the isolated crash-export helper', async () => {
    const tempDb = new Dexie(OPSNORMAL_DB_NAME);
    applyOpsNormalDbSchema(tempDb);

    try {
      await tempDb.table('dailyEntries').bulkAdd([
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
      ]);
    } finally {
      tempDb.close();
    }

    const result = await exportEmergencyCsvBackup('test-emergency.csv');

    expect(result.recoveredCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(mocks.downloadTextFile).toHaveBeenCalledTimes(1);
    expect(mocks.downloadTextFile).toHaveBeenCalledWith(
      'test-emergency.csv',
      'date,sectorId,status,updatedAt\n2026-03-28,body,nominal,2026-03-28T12:00:00.000Z',
      'text/csv;charset=utf-8',
    );
    expect(mocks.recordExportCompleted).toHaveBeenCalledWith(result.exportedAt);
  });
});
