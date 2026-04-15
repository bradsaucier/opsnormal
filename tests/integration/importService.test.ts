import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, getAllEntries, setDailyStatus } from '../../src/db/appDb';
import { exportCurrentEntriesAsJson } from '../../src/lib/export';
import {
  applyImport,
  previewImportPayload,
} from '../../src/services/importService';
import { OPSNORMAL_APP_NAME, type JsonExportPayload } from '../../src/types';

function getCompoundKey(
  entry: Pick<
    NonNullable<JsonExportPayload['entries'][number]>,
    'date' | 'sectorId'
  >,
): string {
  return `${entry.date}:${entry.sectorId}`;
}

function createComparableEntry(
  entry: NonNullable<JsonExportPayload['entries'][number]>,
) {
  return {
    date: entry.date,
    sectorId: entry.sectorId,
    status: entry.status,
    updatedAt: entry.updatedAt,
  };
}

function buildPayload(
  entries: JsonExportPayload['entries'],
): JsonExportPayload {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: 1,
    exportedAt: '2026-03-28T12:00:00.000Z',
    entries,
  };
}

describe('import service', () => {
  beforeEach(async () => {
    await db.dailyEntries.clear();
  });

  it('previews overwrite and new entry counts', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const preview = await previewImportPayload(
      buildPayload([
        {
          date: '2026-03-27',
          sectorId: 'body',
          status: 'degraded',
          updatedAt: '2026-03-28T12:00:00.000Z',
        },
        {
          date: '2026-03-28',
          sectorId: 'rest',
          status: 'nominal',
          updatedAt: '2026-03-28T12:05:00.000Z',
        },
      ]),
    );

    expect(preview.integrityStatus).toBe('legacy-unverified');
    expect(preview.overwriteCount).toBe(1);
    expect(preview.newEntryCount).toBe(1);
    expect(preview.dateRange).toEqual({
      start: '2026-03-27',
      end: '2026-03-28',
    });
  });

  it('flags checksum-backed imports as verified in preview', async () => {
    const payload = buildPayload([
      {
        date: '2026-03-28',
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z',
      },
    ]);
    payload.exportedAt = '2026-04-14T12:00:00.000Z';
    payload.checksum = 'a'.repeat(64);

    const preview = await previewImportPayload(payload);

    expect(preview.integrityStatus).toBe('verified');
    expect(preview.kind).toBe('good');
  });

  it('flags old checksum-backed imports as stale in preview', async () => {
    const payload = buildPayload([
      {
        date: '2026-03-28',
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z',
      },
    ]);
    payload.exportedAt = '2026-03-20T12:00:00.000Z';
    payload.checksum = 'a'.repeat(64);

    const preview = await previewImportPayload(payload);

    expect(preview.kind).toBe('stale');
  });

  it('merges entries and overwrites matching compound keys', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z',
      },
      {
        date: '2026-03-28',
        sectorId: 'relationships',
        status: 'nominal',
        updatedAt: '2026-03-28T12:01:00.000Z',
      },
    ]);

    await applyImport(payload, 'merge');

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(
      allEntries.map((entry) => [`${entry.date}:${entry.sectorId}`, entry]),
    );

    expect(byCompoundKey.get('2026-03-27:body')?.status).toBe('degraded');
    expect(byCompoundKey.get('2026-03-27:rest')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-28:relationships')?.status).toBe(
      'nominal',
    );
  });

  it('merges legacy imports with colliding ids without disturbing unrelated local rows', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const existingEntries = await getAllEntries();
    const collidingId = existingEntries.find(
      (entry) => getCompoundKey(entry) === '2026-03-27:rest',
    )?.id;

    expect(collidingId).toBeTypeOf('number');

    const payload = buildPayload([
      {
        id: collidingId,
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);

    const result = await applyImport(payload, 'merge');
    expect(result.importedCount).toBe(1);

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(
      allEntries.map((entry) => [getCompoundKey(entry), entry]),
    );

    expect(allEntries).toHaveLength(3);
    expect(byCompoundKey.get('2026-03-27:body')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-27:rest')?.status).toBe('degraded');
    expect(byCompoundKey.get('2026-03-29:household')).toMatchObject({
      status: 'nominal',
      updatedAt: '2026-03-29T12:00:00.000Z',
    });
  });

  it('merges id-free payloads successfully', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-28',
        sectorId: 'rest',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z',
      },
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);

    const result = await applyImport(payload, 'merge');
    expect(result.importedCount).toBe(2);

    const allEntries = await getAllEntries();
    const compoundKeys = allEntries.map((entry) => getCompoundKey(entry)).sort();

    expect(compoundKeys).toEqual([
      '2026-03-27:body',
      '2026-03-28:rest',
      '2026-03-29:household',
    ]);
  });

  it('round-trips exported entries through preview and merge import without data loss', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');
    await setDailyStatus('2026-03-28', 'relationships', 'nominal');

    const originalEntries = (await getAllEntries())
      .map((entry) => createComparableEntry(entry))
      .sort((left, right) =>
        getCompoundKey(left).localeCompare(getCompoundKey(right)),
      );

    const exportResult = await exportCurrentEntriesAsJson();
    const payload = JSON.parse(exportResult.payload) as JsonExportPayload;

    await db.dailyEntries.clear();

    const preview = await previewImportPayload(payload);
    expect(preview.integrityStatus).toBe('verified');
    expect(preview.existingEntryCount).toBe(0);
    expect(preview.totalEntries).toBe(originalEntries.length);

    const result = await applyImport(payload, 'merge');
    expect(result.importedCount).toBe(originalEntries.length);

    const roundTrippedEntries = (await getAllEntries())
      .map((entry) => createComparableEntry(entry))
      .sort((left, right) =>
        getCompoundKey(left).localeCompare(getCompoundKey(right)),
      );

    expect(roundTrippedEntries).toEqual(originalEntries);
  });

  it('round-trips exported entries through preview and replace import, purging orphaned data', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');
    await setDailyStatus('2026-03-28', 'relationships', 'nominal');

    const originalEntries = (await getAllEntries())
      .map((entry) => createComparableEntry(entry))
      .sort((left, right) =>
        getCompoundKey(left).localeCompare(getCompoundKey(right)),
      );

    const exportResult = await exportCurrentEntriesAsJson();
    const payload = JSON.parse(exportResult.payload) as JsonExportPayload;

    await setDailyStatus('2026-03-29', 'household', 'degraded');
    await setDailyStatus('2026-03-30', 'work-school', 'nominal');

    const preview = await previewImportPayload(payload);
    expect(preview.integrityStatus).toBe('verified');
    expect(preview.existingEntryCount).toBe(originalEntries.length + 2);
    expect(preview.totalEntries).toBe(originalEntries.length);

    const result = await applyImport(payload, 'replace');
    expect(result.importedCount).toBe(originalEntries.length);

    const replacedEntries = (await getAllEntries())
      .map((entry) => createComparableEntry(entry))
      .sort((left, right) =>
        getCompoundKey(left).localeCompare(getCompoundKey(right)),
      );

    expect(replacedEntries).toEqual(originalEntries);
    expect(replacedEntries.map((entry) => getCompoundKey(entry))).not.toContain(
      '2026-03-29:household',
    );
    expect(replacedEntries.map((entry) => getCompoundKey(entry))).not.toContain(
      '2026-03-30:work-school',
    );
  });

  it('replaces legacy imports with non-sequential ids using fresh local primary keys', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const payload = buildPayload([
      {
        id: 42,
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
      {
        id: 77,
        date: '2026-03-30',
        sectorId: 'work-school',
        status: 'degraded',
        updatedAt: '2026-03-30T12:00:00.000Z',
      },
    ]);

    const result = await applyImport(payload, 'replace');
    expect(result.importedCount).toBe(2);

    const allEntries = await getAllEntries();
    const comparableEntries = allEntries
      .map((entry) => createComparableEntry(entry))
      .sort((left, right) =>
        getCompoundKey(left).localeCompare(getCompoundKey(right)),
      );

    expect(comparableEntries).toEqual(
      payload.entries
        .map((entry) => createComparableEntry(entry))
        .sort((left, right) =>
          getCompoundKey(left).localeCompare(getCompoundKey(right)),
        ),
    );
    expect(allEntries.some((entry) => entry.id === 42 || entry.id === 77)).toBe(
      false,
    );
  });

  it('replaces the database and supports undo restore', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);

    const result = await applyImport(payload, 'replace');
    let allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]?.date).toBe('2026-03-29');

    await result.undo();
    allEntries = await getAllEntries();

    const restoredKeys = allEntries
      .map((entry) => `${entry.date}:${entry.sectorId}`)
      .sort();
    expect(restoredKeys).toEqual(['2026-03-27:body', '2026-03-27:rest']);
  });

  it('aborts the transaction when post-write verification fails', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);

    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    let orderByCallCount = 0;

    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) => {
        orderByCallCount += 1;

        if (index === '[date+sectorId]' && orderByCallCount === 2) {
          return {
            toArray: () => Promise.resolve([]),
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(applyImport(payload, 'replace')).rejects.toThrow(
        /indexeddb transaction aborted before commit/i,
      );
    } finally {
      orderBySpy.mockRestore();
    }

    const allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]).toMatchObject({
      date: '2026-03-27',
      sectorId: 'body',
      status: 'nominal',
    });
  });

  it('aborts merge import when transaction-scope verification detects a mismatch', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const payload = buildPayload([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:01:00.000Z',
      },
    ]);

    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    let orderByCallCount = 0;

    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) => {
        orderByCallCount += 1;

        if (index === '[date+sectorId]' && orderByCallCount === 2) {
          return {
            toArray: () =>
              Promise.resolve([
                {
                  date: '2026-03-27',
                  sectorId: 'body',
                  status: 'degraded',
                  updatedAt: '2026-03-29T12:00:00.000Z',
                },
                {
                  date: '2026-03-27',
                  sectorId: 'rest',
                  status: 'degraded',
                  updatedAt: '2026-03-27T00:00:00.000Z',
                },
              ]),
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(applyImport(payload, 'merge')).rejects.toThrow(
        /first mismatch near \[2026-03-29:household\]/i,
      );
    } finally {
      orderBySpy.mockRestore();
    }

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(
      allEntries.map((entry) => [`${entry.date}:${entry.sectorId}`, entry]),
    );

    expect(allEntries).toHaveLength(2);
    expect(byCompoundKey.get('2026-03-27:body')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-27:rest')?.status).toBe('degraded');
    expect(byCompoundKey.has('2026-03-29:household')).toBe(false);
  });
});
