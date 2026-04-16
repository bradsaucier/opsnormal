import { db, getAllEntries, runDatabaseWrite } from '../db/appDb';
import { UndoInvalidatedError, UndoVerificationError } from '../lib/errors';
import type { ParsedJsonImport } from '../schemas/import';
import type {
  DailyEntry,
  ImportMode,
  ImportPreview,
  JsonExportPayload,
  RejectedImportPreview,
  SuccessfulImportPreview,
} from '../types';
import {
  createRejectedImportPreview,
  getImportAgeMs,
  getSuccessfulImportPreviewKind,
  parseImportPayload,
  summarizeParsedPayload,
  type ParsedImportSummary,
  validateImportFileSize,
} from './importValidation';

interface WorkerPreviewRequest {
  buffer: ArrayBuffer;
  size: number;
}

interface WorkerSuccessMessage {
  ok: true;
  summary: ParsedImportSummary;
}

interface WorkerRejectedMessage {
  ok: false;
  preview: RejectedImportPreview;
}

const IMPORT_PREVIEW_WORKER_THRESHOLD_BYTES = 256 * 1024;
const IMPORT_BATCH_SIZE = 500;
const ENTRY_WRITTEN_EVENT_NAME = 'opsnormal:entry-written';

let undoSnapshotState: {
  snapshot: DailyEntry[];
  exportedAt: string;
  invalidated: boolean;
} | null = null;

function handleEntryWritten(event: Event): void {
  if (!undoSnapshotState) {
    return;
  }

  const detail = (event as CustomEvent<{ source?: string }>).detail;

  if (detail?.source !== 'daily-status') {
    return;
  }

  undoSnapshotState.invalidated = true;
}

if (typeof window !== 'undefined') {
  window.addEventListener(ENTRY_WRITTEN_EVENT_NAME, handleEntryWritten);
}

function isRejectedImportPreview(
  previewResult: ParsedImportSummary | RejectedImportPreview,
): previewResult is RejectedImportPreview {
  return 'kind' in previewResult;
}

function getCompoundKey(entry: Pick<DailyEntry, 'date' | 'sectorId'>): string {
  return `${entry.date}:${entry.sectorId}`;
}

function normalizeImportedEntries(
  entries: ParsedJsonImport['entries'],
  existingEntries: DailyEntry[],
  mode: ImportMode,
): DailyEntry[] {
  const existingByCompoundKey = new Map(
    existingEntries.map((entry) => [getCompoundKey(entry), entry]),
  );

  return entries.map((entry) => {
    const existing =
      mode === 'merge'
        ? existingByCompoundKey.get(getCompoundKey(entry))
        : undefined;
    const normalizedEntry = {
      date: entry.date,
      sectorId: entry.sectorId,
      status: entry.status,
      updatedAt: entry.updatedAt,
    };

    return typeof existing?.id === 'number'
      ? { id: existing.id, ...normalizedEntry }
      : normalizedEntry;
  });
}

function buildPreviewFromSummary(
  summary: ParsedImportSummary,
  existingEntries: DailyEntry[],
): SuccessfulImportPreview {
  const existingKeys = new Set(
    existingEntries.map((entry) => getCompoundKey(entry)),
  );
  const overwriteCount = summary.payload.entries.filter((entry) =>
    existingKeys.has(getCompoundKey(entry)),
  ).length;
  const ageMs = getImportAgeMs(summary.payload.exportedAt);

  return {
    kind: getSuccessfulImportPreviewKind(summary.payload),
    payload: summary.payload,
    integrityStatus: summary.integrityStatus,
    existingEntryCount: existingEntries.length,
    overwriteCount,
    newEntryCount: summary.payload.entries.length - overwriteCount,
    totalEntries: summary.totalEntries,
    exportedAt: summary.payload.exportedAt,
    ageMs,
    dateRange: summary.dateRange,
  };
}

function buildExpectedFinalEntries(
  snapshot: DailyEntry[],
  normalizedEntries: DailyEntry[],
  mode: ImportMode,
): DailyEntry[] {
  if (mode === 'replace') {
    return normalizedEntries;
  }

  const byCompoundKey = new Map(
    snapshot.map((entry) => [getCompoundKey(entry), entry]),
  );

  for (const entry of normalizedEntries) {
    byCompoundKey.set(getCompoundKey(entry), entry);
  }

  return Array.from(byCompoundKey.values()).sort((left, right) => {
    const leftKey = getCompoundKey(left);
    const rightKey = getCompoundKey(right);
    return leftKey.localeCompare(rightKey);
  });
}

function createComparableEntry(entry: DailyEntry) {
  return {
    date: entry.date,
    sectorId: entry.sectorId,
    status: entry.status,
    updatedAt: entry.updatedAt,
  };
}

function hasMatchingEntrySet(
  expectedEntries: DailyEntry[],
  actualEntries: DailyEntry[],
): boolean {
  if (expectedEntries.length !== actualEntries.length) {
    return false;
  }

  const actualByCompoundKey = new Map(
    actualEntries.map((entry) => [
      getCompoundKey(entry),
      createComparableEntry(entry),
    ]),
  );

  return expectedEntries.every((entry) => {
    const actual = actualByCompoundKey.get(getCompoundKey(entry));

    if (!actual) {
      return false;
    }

    return (
      JSON.stringify(actual) === JSON.stringify(createComparableEntry(entry))
    );
  });
}

function getFirstMismatchCompoundKey(
  expectedEntries: DailyEntry[],
  actualEntries: DailyEntry[],
): string | null {
  if (expectedEntries.length !== actualEntries.length) {
    const expectedKeys = new Set(expectedEntries.map(getCompoundKey));

    for (const entry of actualEntries) {
      const compoundKey = getCompoundKey(entry);

      if (!expectedKeys.has(compoundKey)) {
        return compoundKey;
      }
    }

    const lastExpectedEntry = expectedEntries[expectedEntries.length - 1];
    if (lastExpectedEntry) {
      return getCompoundKey(lastExpectedEntry);
    }

    const lastActualEntry = actualEntries[actualEntries.length - 1];
    if (lastActualEntry) {
      return getCompoundKey(lastActualEntry);
    }

    return null;
  }

  const actualByCompoundKey = new Map(
    actualEntries.map((entry) => [
      getCompoundKey(entry),
      createComparableEntry(entry),
    ]),
  );

  for (const entry of expectedEntries) {
    const compoundKey = getCompoundKey(entry);
    const actual = actualByCompoundKey.get(compoundKey);

    if (
      !actual ||
      JSON.stringify(actual) !== JSON.stringify(createComparableEntry(entry))
    ) {
      return compoundKey;
    }
  }

  return null;
}

async function bulkPutEntries(entries: DailyEntry[]): Promise<void> {
  for (let index = 0; index < entries.length; index += IMPORT_BATCH_SIZE) {
    const chunk = entries.slice(index, index + IMPORT_BATCH_SIZE);
    await db.dailyEntries.bulkPut(chunk);
  }
}

async function restoreUndoSnapshot(snapshot: DailyEntry[]): Promise<void> {
  if (!undoSnapshotState || undoSnapshotState.snapshot !== snapshot) {
    throw new UndoInvalidatedError();
  }

  if (undoSnapshotState.invalidated) {
    throw new UndoInvalidatedError(
      'Undo disabled. A daily check-in landed after this import. Export a fresh backup before proceeding.',
    );
  }

  await runDatabaseWrite(async () =>
    db.transaction('rw', db.dailyEntries, async () => {
      await db.dailyEntries.clear();

      if (snapshot.length > 0) {
        await bulkPutEntries(snapshot);
      }

      const readBack = await db.dailyEntries
        .orderBy('[date+sectorId]')
        .toArray();

      if (!hasMatchingEntrySet(snapshot, readBack)) {
        throw new UndoVerificationError();
      }
    }),
  );

  undoSnapshotState = null;
}

export async function readImportFile(file: File): Promise<string> {
  validateImportFileSize(file);
  return file.text();
}

export async function previewImportPayload(
  payload: JsonExportPayload,
): Promise<SuccessfulImportPreview> {
  const existingEntries = await getAllEntries();
  return buildPreviewFromSummary(
    summarizeParsedPayload(payload),
    existingEntries,
  );
}

function createImportPreviewAbortError(): Error {
  const error = new Error('Import preview cancelled.');
  error.name = 'AbortError';
  return error;
}

function throwIfPreviewAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createImportPreviewAbortError();
  }
}

async function parseImportFileWithWorker(
  file: File,
  signal?: AbortSignal,
): Promise<ParsedImportSummary | RejectedImportPreview> {
  validateImportFileSize(file);
  throwIfPreviewAborted(signal);

  const buffer = await file.arrayBuffer();
  throwIfPreviewAborted(signal);

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./importPreviewWorker.ts', import.meta.url),
      {
        type: 'module',
      },
    );

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(createImportPreviewAbortError());
    };

    worker.onmessage = (
      event: MessageEvent<WorkerSuccessMessage | WorkerRejectedMessage>,
    ) => {
      cleanup();

      if (event.data.ok) {
        resolve(event.data.summary);
        return;
      }

      resolve(event.data.preview);
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('Import preparation failed in the preview worker.'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    const request: WorkerPreviewRequest = {
      buffer,
      size: file.size,
    };

    worker.postMessage(request, [buffer]);
  });
}

async function parseImportFileForPreview(
  file: File,
  signal?: AbortSignal,
): Promise<ParsedImportSummary | RejectedImportPreview> {
  validateImportFileSize(file);

  if (
    typeof Worker !== 'undefined' &&
    file.size >= IMPORT_PREVIEW_WORKER_THRESHOLD_BYTES
  ) {
    return parseImportFileWithWorker(file, signal);
  }

  throwIfPreviewAborted(signal);
  const rawText = await file.text();
  throwIfPreviewAborted(signal);

  try {
    const payload = await parseImportPayload(rawText);
    return summarizeParsedPayload(payload);
  } catch (error) {
    const rejectedPreview = createRejectedImportPreview(error);

    if (rejectedPreview) {
      return rejectedPreview;
    }

    throw error;
  }
}

export async function previewImportFile(
  file: File,
  signal?: AbortSignal,
): Promise<ImportPreview> {
  const previewResult = await parseImportFileForPreview(file, signal);

  if (isRejectedImportPreview(previewResult)) {
    return previewResult;
  }

  const existingEntries = await getAllEntries();
  return buildPreviewFromSummary(previewResult, existingEntries);
}

export async function applyImport(
  payload: JsonExportPayload,
  mode: ImportMode,
): Promise<{ importedCount: number; undo: () => Promise<void> }> {
  let undoSnapshot: DailyEntry[] = [];
  let importedCount = 0;

  await runDatabaseWrite(async () =>
    db.transaction('rw', db.dailyEntries, async () => {
      const snapshot = await db.dailyEntries
        .orderBy('[date+sectorId]')
        .toArray();
      const normalizedEntries = normalizeImportedEntries(
        payload.entries,
        snapshot,
        mode,
      );
      const expectedFinalEntries = buildExpectedFinalEntries(
        snapshot,
        normalizedEntries,
        mode,
      );

      undoSnapshot = snapshot.map((entry) => ({ ...entry }));
      importedCount = normalizedEntries.length;

      if (mode === 'replace') {
        await db.dailyEntries.clear();
      }

      if (normalizedEntries.length > 0) {
        await bulkPutEntries(normalizedEntries);
      }

      const actualEntries = await db.dailyEntries
        .orderBy('[date+sectorId]')
        .toArray();

      if (!hasMatchingEntrySet(expectedFinalEntries, actualEntries)) {
        const firstMismatchCompoundKey = getFirstMismatchCompoundKey(
          expectedFinalEntries,
          actualEntries,
        );
        const mismatchHint = firstMismatchCompoundKey
          ? ` First mismatch near [${firstMismatchCompoundKey}].`
          : '';

        throw new Error(
          `Import post-write verification failed. IndexedDB transaction aborted before commit.${mismatchHint}`,
        );
      }
    }),
  );

  undoSnapshotState = {
    snapshot: undoSnapshot,
    exportedAt: payload.exportedAt,
    invalidated: false,
  };

  return {
    importedCount,
    undo: async () => {
      await restoreUndoSnapshot(undoSnapshot);
    },
  };
}

/** @internal */
export function __resetUndoSnapshotStateForTests(): void {
  undoSnapshotState = null;
}
