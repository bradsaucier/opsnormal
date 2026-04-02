import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, getAllEntries, setDailyStatus } from '../../src/db/appDb';
import { applyImport, previewImportPayload } from '../../src/services/importService';
import { OPSNORMAL_APP_NAME, type JsonExportPayload } from '../../src/types';

function buildPayload(entries: JsonExportPayload['entries']): JsonExportPayload {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: 1,
    exportedAt: '2026-03-28T12:00:00.000Z',
    entries
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
          updatedAt: '2026-03-28T12:00:00.000Z'
        },
        {
          date: '2026-03-28',
          sectorId: 'rest',
          status: 'nominal',
          updatedAt: '2026-03-28T12:05:00.000Z'
        }
      ])
    );

    expect(preview.integrityStatus).toBe('legacy-unverified');
    expect(preview.overwriteCount).toBe(1);
    expect(preview.newEntryCount).toBe(1);
    expect(preview.dateRange).toEqual({ start: '2026-03-27', end: '2026-03-28' });
  });

  it('flags checksum-backed imports as verified in preview', async () => {
    const payload = buildPayload([
      {
        date: '2026-03-28',
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }
    ]);
    payload.checksum = 'a'.repeat(64);

    const preview = await previewImportPayload(payload);

    expect(preview.integrityStatus).toBe('verified');
  });

  it('merges entries and overwrites matching compound keys', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z'
      },
      {
        date: '2026-03-28',
        sectorId: 'relationships',
        status: 'nominal',
        updatedAt: '2026-03-28T12:01:00.000Z'
      }
    ]);

    await applyImport(payload, 'merge');

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(allEntries.map((entry) => [`${entry.date}:${entry.sectorId}`, entry]));

    expect(byCompoundKey.get('2026-03-27:body')?.status).toBe('degraded');
    expect(byCompoundKey.get('2026-03-27:rest')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-28:relationships')?.status).toBe('nominal');
  });

  it('replaces the database and supports undo restore', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z'
      }
    ]);

    const result = await applyImport(payload, 'replace');
    let allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]?.date).toBe('2026-03-29');

    await result.undo();
    allEntries = await getAllEntries();

    const restoredKeys = allEntries.map((entry) => `${entry.date}:${entry.sectorId}`).sort();
    expect(restoredKeys).toEqual(['2026-03-27:body', '2026-03-27:rest']);
  });

  it('aborts the transaction when post-write verification fails', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z'
      }
    ]);

    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    let orderByCallCount = 0;

    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) => {
        orderByCallCount += 1;

        if (index === '[date+sectorId]' && orderByCallCount === 2) {
          return {
            toArray: () => Promise.resolve([])
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(applyImport(payload, 'replace')).rejects.toThrow(
        /indexeddb transaction aborted before commit/i
      );
    } finally {
      orderBySpy.mockRestore();
    }

    const allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]).toMatchObject({
      date: '2026-03-27',
      sectorId: 'body',
      status: 'nominal'
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
        updatedAt: '2026-03-29T12:00:00.000Z'
      },
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:01:00.000Z'
      }
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
                  updatedAt: '2026-03-29T12:00:00.000Z'
                },
                {
                  date: '2026-03-27',
                  sectorId: 'rest',
                  status: 'degraded',
                  updatedAt: '2026-03-27T00:00:00.000Z'
                }
              ])
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(applyImport(payload, 'merge')).rejects.toThrow(
        /first mismatch near \[2026-03-29:household\]/i
      );
    } finally {
      orderBySpy.mockRestore();
    }

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(allEntries.map((entry) => [`${entry.date}:${entry.sectorId}`, entry]));

    expect(allEntries).toHaveLength(2);
    expect(byCompoundKey.get('2026-03-27:body')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-27:rest')?.status).toBe('degraded');
    expect(byCompoundKey.has('2026-03-29:household')).toBe(false);
  });
});
