import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, getAllEntries, setDailyStatus } from '../../src/db/appDb';
import {
  UndoInvalidatedError,
  UndoVerificationError,
} from '../../src/lib/errors';
import { exportCurrentEntriesAsJson } from '../../src/lib/export';
import {
  __resetUndoSnapshotStateForTests,
  applyImport,
  previewImportFile,
  previewImportPayload,
  readImportFile,
} from '../../src/services/importService';
import {
  OPSNORMAL_APP_NAME,
  type DailyEntry,
  type JsonExportPayload,
} from '../../src/types';

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

function sortComparableEntries<T extends Pick<DailyEntry, 'date' | 'sectorId'>>(
  entries: T[],
): T[] {
  return [...entries].sort((left, right) =>
    getCompoundKey(left).localeCompare(getCompoundKey(right)),
  );
}

function injectWriteBeforeFirstTransaction(entry: DailyEntry) {
  const originalTransaction = db.transaction.bind(db);
  let injected = false;

  return vi.spyOn(db, 'transaction').mockImplementation((async (
    ...args: Parameters<typeof db.transaction>
  ) => {
    if (!injected) {
      injected = true;
      await db.dailyEntries.put({ ...entry });
    }

    return originalTransaction(...args);
  }) as typeof db.transaction);
}

interface MockPreviewWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
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

function createImportFile(
  content: string,
  name = 'opsnormal-import.json',
): File {
  return new File([content], name, { type: 'application/json' });
}

function createLargeImportFile(): File {
  return createImportFile('x'.repeat(300_000), 'opsnormal-large-import.json');
}

function installPreviewWorkerStub(
  onPostMessage: (worker: MockPreviewWorker, request: unknown) => void,
) {
  const originalWorker = globalThis.Worker;
  let workerInstance: MockPreviewWorker | null = null;

  class MockWorker {
    onmessage: MockPreviewWorker['onmessage'] = null;
    onerror: MockPreviewWorker['onerror'] = null;
    postMessage = vi.fn((request: unknown) => {
      onPostMessage(this as unknown as MockPreviewWorker, request);
    });
    terminate = vi.fn();

    constructor() {
      workerInstance = this as unknown as MockPreviewWorker;
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: MockWorker,
  });

  return {
    getWorker: () => workerInstance,
    restore: () => {
      if (originalWorker === undefined) {
        delete (globalThis as { Worker?: unknown }).Worker;
        return;
      }

      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        writable: true,
        value: originalWorker,
      });
    },
  };
}

describe('import service', () => {
  beforeEach(async () => {
    __resetUndoSnapshotStateForTests();
    await db.dailyEntries.clear();
  });

  it('reads import file text after validating the file size', async () => {
    const rawText = JSON.stringify(
      buildPayload([
        {
          date: '2026-03-28',
          sectorId: 'body',
          status: 'nominal',
          updatedAt: '2026-03-28T12:00:00.000Z',
        },
      ]),
    );

    await expect(readImportFile(createImportFile(rawText))).resolves.toBe(
      rawText,
    );
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

  it('parses a valid import file through the non-worker preview path', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const preview = await previewImportFile(
      createImportFile(
        JSON.stringify(
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
        ),
      ),
    );

    expect(preview).toMatchObject({
      kind: 'legacy-unverified',
      existingEntryCount: 1,
      overwriteCount: 1,
      newEntryCount: 1,
      totalEntries: 2,
    });
  });

  it('returns a rejected preview for unreadable import file contents', async () => {
    const preview = await previewImportFile(createImportFile('{"app":'));

    expect(preview).toEqual({ kind: 'unreadable' });
  });

  it('aborts preview parsing before reading when the signal is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      previewImportFile(
        createImportFile(JSON.stringify(buildPayload([]))),
        controller.signal,
      ),
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Import preview cancelled.',
    });
  });

  it('uses the worker path for large import previews', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

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
    const file = createLargeImportFile();
    const controller = new AbortController();
    const workerStub = installPreviewWorkerStub((worker, request) => {
      expect(request).toMatchObject({ size: file.size });

      queueMicrotask(() => {
        worker.onmessage?.(
          new MessageEvent('message', {
            data: {
              ok: true,
              summary: {
                payload,
                integrityStatus: 'legacy-unverified',
                totalEntries: payload.entries.length,
                dateRange: {
                  start: '2026-03-27',
                  end: '2026-03-29',
                },
              },
            },
          }),
        );
      });
    });

    try {
      const preview = await previewImportFile(file, controller.signal);

      expect(preview).toMatchObject({
        kind: 'legacy-unverified',
        existingEntryCount: 1,
        overwriteCount: 1,
        newEntryCount: 1,
        totalEntries: 2,
      });
      expect(workerStub.getWorker()?.terminate).toHaveBeenCalledTimes(1);
    } finally {
      workerStub.restore();
    }
  });

  it('returns worker-provided rejected previews for large import files', async () => {
    const workerStub = installPreviewWorkerStub((worker) => {
      queueMicrotask(() => {
        worker.onmessage?.(
          new MessageEvent('message', {
            data: {
              ok: false,
              preview: {
                kind: 'invalid',
                issuePath: 'entries.0.status',
                issueMessage: 'Invalid option',
              },
            },
          }),
        );
      });
    });

    try {
      const preview = await previewImportFile(createLargeImportFile());

      expect(preview).toEqual({
        kind: 'invalid',
        issuePath: 'entries.0.status',
        issueMessage: 'Invalid option',
      });
      expect(workerStub.getWorker()?.terminate).toHaveBeenCalledTimes(1);
    } finally {
      workerStub.restore();
    }
  });

  it('surfaces worker preview failures for large import files', async () => {
    const workerStub = installPreviewWorkerStub((worker) => {
      queueMicrotask(() => {
        worker.onerror?.(new Event('error'));
      });
    });

    try {
      await expect(previewImportFile(createLargeImportFile())).rejects.toThrow(
        'Import preparation failed in the preview worker.',
      );
      expect(workerStub.getWorker()?.terminate).toHaveBeenCalledTimes(1);
    } finally {
      workerStub.restore();
    }
  });

  it('aborts worker-backed preview when cancellation arrives after dispatch', async () => {
    const controller = new AbortController();
    const workerStub = installPreviewWorkerStub(() => {
      controller.abort();
    });

    try {
      const previewPromise = previewImportFile(
        createLargeImportFile(),
        controller.signal,
      );

      await expect(previewPromise).rejects.toMatchObject({
        name: 'AbortError',
        message: 'Import preview cancelled.',
      });
      expect(workerStub.getWorker()?.terminate).toHaveBeenCalledTimes(1);
    } finally {
      workerStub.restore();
    }
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
    const compoundKeys = allEntries
      .map((entry) => getCompoundKey(entry))
      .sort();

    expect(compoundKeys).toEqual([
      '2026-03-27:body',
      '2026-03-28:rest',
      '2026-03-29:household',
    ]);
  });

  it('merges against the in-transaction snapshot when a write lands before the import transaction starts', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const concurrentEntry: DailyEntry = {
      date: '2026-03-27',
      sectorId: 'rest',
      status: 'nominal',
      updatedAt: '2026-03-29T12:00:00.000Z',
    };
    const payload = buildPayload([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-29T12:01:00.000Z',
      },
    ]);
    const transactionSpy = injectWriteBeforeFirstTransaction(concurrentEntry);

    try {
      const result = await applyImport(payload, 'merge');
      expect(result.importedCount).toBe(1);
    } finally {
      transactionSpy.mockRestore();
    }

    const allEntries = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );

    expect(allEntries).toEqual([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-29T12:01:00.000Z',
      },
      createComparableEntry(concurrentEntry),
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

  it('replaces with an empty payload without writing any bulk-put batches', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    const bulkPutSpy = vi.spyOn(db.dailyEntries, 'bulkPut');

    try {
      const result = await applyImport(buildPayload([]), 'replace');

      expect(result.importedCount).toBe(0);
      expect(bulkPutSpy).not.toHaveBeenCalled();
      expect(await getAllEntries()).toEqual([]);
    } finally {
      bulkPutSpy.mockRestore();
    }
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

  it('restores the exact pre-import snapshot after a successful replace undo round-trip', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const snapshot = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );
    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
      {
        date: '2026-03-30',
        sectorId: 'work-school',
        status: 'degraded',
        updatedAt: '2026-03-30T12:00:00.000Z',
      },
    ]);

    const result = await applyImport(payload, 'replace');

    await result.undo();

    const restoredEntries = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );

    expect(restoredEntries).toEqual(snapshot);
  });

  it('restores the exact pre-import snapshot with post-write read-back proof', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const snapshot = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );
    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const result = await applyImport(payload, 'replace');
    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) =>
        originalOrderBy(
          index as '[date+sectorId]',
        )) as typeof db.dailyEntries.orderBy);

    try {
      await result.undo();

      expect(orderBySpy).toHaveBeenCalledWith('[date+sectorId]');
    } finally {
      orderBySpy.mockRestore();
    }

    const restoredEntries = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );

    expect(restoredEntries).toEqual(snapshot);
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

  it('undo restores the in-transaction snapshot when a write lands before replace import starts', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const preImportSnapshot = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );
    const concurrentEntry: DailyEntry = {
      date: '2026-03-28',
      sectorId: 'rest',
      status: 'degraded',
      updatedAt: '2026-03-28T12:00:00.000Z',
    };
    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const transactionSpy = injectWriteBeforeFirstTransaction(concurrentEntry);

    let result: Awaited<ReturnType<typeof applyImport>>;

    try {
      result = await applyImport(payload, 'replace');
    } finally {
      transactionSpy.mockRestore();
    }

    await result.undo();

    const restoredEntries = sortComparableEntries(
      (await getAllEntries()).map((entry) => createComparableEntry(entry)),
    );

    expect(restoredEntries).toEqual(
      sortComparableEntries([
        ...preImportSnapshot,
        createComparableEntry(concurrentEntry),
      ]),
    );
  });

  it('rolls back undo when post-write verification detects a mismatch', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const result = await applyImport(payload, 'replace');
    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) => {
        if (index === '[date+sectorId]') {
          return {
            toArray: () => Promise.resolve([]),
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(result.undo()).rejects.toBeInstanceOf(UndoVerificationError);
    } finally {
      orderBySpy.mockRestore();
    }

    const allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]).toMatchObject({
      date: '2026-03-29',
      sectorId: 'household',
      status: 'nominal',
    });
  });

  it('refuses undo when a post-import daily-status write invalidates the snapshot', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const result = await applyImport(payload, 'replace');

    window.dispatchEvent(
      new CustomEvent('opsnormal:entry-written', {
        detail: { source: 'daily-status' },
      }),
    );

    await expect(result.undo()).rejects.toBeInstanceOf(UndoInvalidatedError);

    const allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]).toMatchObject({
      date: '2026-03-29',
      sectorId: 'household',
      status: 'nominal',
    });
  });

  it('does not clobber a post-import daily check-in when undo is invalidated', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const result = await applyImport(payload, 'replace');

    await setDailyStatus('2026-03-30', 'work-school', 'degraded');

    await expect(result.undo()).rejects.toBeInstanceOf(UndoInvalidatedError);

    const allEntries = await getAllEntries();
    const byCompoundKey = new Map(
      allEntries.map((entry) => [getCompoundKey(entry), entry]),
    );

    expect(byCompoundKey.get('2026-03-29:household')?.status).toBe('nominal');
    expect(byCompoundKey.get('2026-03-30:work-school')?.status).toBe(
      'degraded',
    );
  });

  it('refuses a consumed undo closure after the snapshot has already been restored', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');

    const payload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);
    const result = await applyImport(payload, 'replace');

    await result.undo();
    await expect(result.undo()).rejects.toBeInstanceOf(UndoInvalidatedError);

    const allEntries = await getAllEntries();

    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]).toMatchObject({
      date: '2026-03-27',
      sectorId: 'body',
      status: 'nominal',
    });
  });

  it('aborts merge import when equal-length verification detects changed contents', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');

    const payload = buildPayload([
      {
        date: '2026-03-27',
        sectorId: 'body',
        status: 'degraded',
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
            toArray: () =>
              Promise.resolve([
                {
                  date: '2026-03-27',
                  sectorId: 'body',
                  status: 'nominal',
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
        /first mismatch near \[2026-03-27:body\]/i,
      );
    } finally {
      orderBySpy.mockRestore();
    }
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

  it('aborts replace import when verification sees an unexpected extra row', async () => {
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
            toArray: () =>
              Promise.resolve([
                {
                  date: '2026-03-29',
                  sectorId: 'household',
                  status: 'nominal',
                  updatedAt: '2026-03-29T12:00:00.000Z',
                },
                {
                  date: '2026-03-30',
                  sectorId: 'work-school',
                  status: 'degraded',
                  updatedAt: '2026-03-30T12:00:00.000Z',
                },
              ]),
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(applyImport(payload, 'replace')).rejects.toThrow(
        /first mismatch near \[2026-03-30:work-school\]/i,
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
});
