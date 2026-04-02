import { ZodError } from 'zod';

import { db, getAllEntries, runDatabaseWrite } from '../db/appDb';
import { computeJsonExportChecksum } from '../lib/export';
import { JsonImportSchema, type ParsedJsonImport } from '../schemas/import';
import type {
  DailyEntry,
  ImportIntegrityStatus,
  ImportMode,
  ImportPreview,
  JsonExportPayload
} from '../types';

type RawChecksumPayload = Pick<
  JsonExportPayload,
  'app' | 'schemaVersion' | 'exportedAt' | 'checksum'
> & {
  entries: JsonExportPayload['entries'];
};

interface ParsedImportSummary {
  payload: JsonExportPayload;
  integrityStatus: ImportIntegrityStatus;
  totalEntries: number;
  dateRange: ImportPreview['dateRange'];
}

interface WorkerPreviewRequest {
  buffer: ArrayBuffer;
  size: number;
}

interface WorkerSuccessMessage {
  ok: true;
  summary: ParsedImportSummary;
}

interface WorkerErrorMessage {
  ok: false;
  error: string;
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const IMPORT_PREVIEW_WORKER_THRESHOLD_BYTES = 256 * 1024;
const IMPORT_BATCH_SIZE = 500;

function getCompoundKey(entry: Pick<DailyEntry, 'date' | 'sectorId'>): string {
  return `${entry.date}:${entry.sectorId}`;
}

function containsUnsafeKeys(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsUnsafeKeys);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }

    if (containsUnsafeKeys(nestedValue)) {
      return true;
    }
  }

  return false;
}

function formatValidationError(error: ZodError): string {
  const primaryIssue = error.issues[0];

  if (!primaryIssue) {
    return 'Import validation failed.';
  }

  const path = primaryIssue.path.length > 0 ? `${primaryIssue.path.join('.')} - ` : '';
  return `${path}${primaryIssue.message}`;
}

async function verifyExportChecksum(
  rawPayload: RawChecksumPayload,
  payload: JsonExportPayload
): Promise<void> {
  if (!payload.checksum) {
    return;
  }

  const computedChecksum = await computeJsonExportChecksum({
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: rawPayload.entries
  });

  if (computedChecksum !== payload.checksum) {
    throw new Error(
      'Import rejected. File integrity check failed. The backup may be corrupted or modified.'
    );
  }
}

function normalizeImportedEntries(
  entries: ParsedJsonImport['entries'],
  existingEntries: DailyEntry[],
  mode: ImportMode
): DailyEntry[] {
  const existingByCompoundKey = new Map(
    existingEntries.map((entry) => [getCompoundKey(entry), entry])
  );

  return entries.map((entry) => {
    const existing = mode === 'merge' ? existingByCompoundKey.get(getCompoundKey(entry)) : undefined;

    return {
      id: existing?.id ?? entry.id,
      date: entry.date,
      sectorId: entry.sectorId,
      status: entry.status,
      updatedAt: entry.updatedAt
    };
  });
}

function getImportIntegrityStatus(payload: JsonExportPayload): ImportIntegrityStatus {
  return payload.checksum ? 'verified' : 'legacy-unverified';
}

function getDateRange(entries: DailyEntry[]): ImportPreview['dateRange'] {
  if (entries.length === 0) {
    return null;
  }

  const sortedDateKeys = entries.map((entry) => entry.date).sort();

  return {
    start: sortedDateKeys[0] ?? '',
    end: sortedDateKeys[sortedDateKeys.length - 1] ?? ''
  };
}

function summarizeParsedPayload(payload: JsonExportPayload): ParsedImportSummary {
  return {
    payload,
    integrityStatus: getImportIntegrityStatus(payload),
    totalEntries: payload.entries.length,
    dateRange: getDateRange(payload.entries)
  };
}

function buildPreviewFromSummary(
  summary: ParsedImportSummary,
  existingEntries: DailyEntry[]
): ImportPreview {
  const existingKeys = new Set(existingEntries.map((entry) => getCompoundKey(entry)));
  const overwriteCount = summary.payload.entries.filter((entry) =>
    existingKeys.has(getCompoundKey(entry))
  ).length;

  return {
    payload: summary.payload,
    integrityStatus: summary.integrityStatus,
    existingEntryCount: existingEntries.length,
    overwriteCount,
    newEntryCount: summary.payload.entries.length - overwriteCount,
    totalEntries: summary.totalEntries,
    dateRange: summary.dateRange
  };
}

function buildExpectedFinalEntries(
  snapshot: DailyEntry[],
  normalizedEntries: DailyEntry[],
  mode: ImportMode
): DailyEntry[] {
  if (mode === 'replace') {
    return normalizedEntries;
  }

  const byCompoundKey = new Map(snapshot.map((entry) => [getCompoundKey(entry), entry]));

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
    updatedAt: entry.updatedAt
  };
}

function hasMatchingEntrySet(expectedEntries: DailyEntry[], actualEntries: DailyEntry[]): boolean {
  if (expectedEntries.length !== actualEntries.length) {
    return false;
  }

  const actualByCompoundKey = new Map(
    actualEntries.map((entry) => [getCompoundKey(entry), createComparableEntry(entry)])
  );

  return expectedEntries.every((entry) => {
    const actual = actualByCompoundKey.get(getCompoundKey(entry));

    if (!actual) {
      return false;
    }

    return JSON.stringify(actual) === JSON.stringify(createComparableEntry(entry));
  });
}

function getFirstMismatchCompoundKey(
  expectedEntries: DailyEntry[],
  actualEntries: DailyEntry[]
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
    actualEntries.map((entry) => [getCompoundKey(entry), createComparableEntry(entry)])
  );

  for (const entry of expectedEntries) {
    const compoundKey = getCompoundKey(entry);
    const actual = actualByCompoundKey.get(compoundKey);

    if (!actual || JSON.stringify(actual) !== JSON.stringify(createComparableEntry(entry))) {
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
  await runDatabaseWrite(async () =>
    db.transaction('rw', db.dailyEntries, async () => {
      await db.dailyEntries.clear();

      if (snapshot.length > 0) {
        await bulkPutEntries(snapshot);
      }
    })
  );
}

function validateImportFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('Import rejected. File exceeds the 5 MB limit.');
  }
}

export async function readImportFile(file: File): Promise<string> {
  validateImportFileSize(file);
  return file.text();
}

export async function parseImportPayload(rawText: string): Promise<JsonExportPayload> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error('Import rejected. File is not valid JSON.');
  }

  if (containsUnsafeKeys(parsed)) {
    throw new Error('Import rejected. File contains blocked keys.');
  }

  const validated = JsonImportSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(formatValidationError(validated.error));
  }

  await verifyExportChecksum(parsed as RawChecksumPayload, validated.data);

  return validated.data;
}

export async function previewImportPayload(payload: JsonExportPayload): Promise<ImportPreview> {
  const existingEntries = await getAllEntries();
  return buildPreviewFromSummary(summarizeParsedPayload(payload), existingEntries);
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
  signal?: AbortSignal
): Promise<ParsedImportSummary> {
  validateImportFileSize(file);
  throwIfPreviewAborted(signal);

  const buffer = await file.arrayBuffer();
  throwIfPreviewAborted(signal);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./importPreviewWorker.ts', import.meta.url), {
      type: 'module'
    });

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

    worker.onmessage = (event: MessageEvent<WorkerSuccessMessage | WorkerErrorMessage>) => {
      cleanup();

      if (event.data.ok) {
        resolve(event.data.summary);
        return;
      }

      reject(new Error(event.data.error));
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('Import preparation failed in the preview worker.'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    const request: WorkerPreviewRequest = {
      buffer,
      size: file.size
    };

    worker.postMessage(request, [buffer]);
  });
}

async function parseImportFileForPreview(
  file: File,
  signal?: AbortSignal
): Promise<ParsedImportSummary> {
  validateImportFileSize(file);

  if (typeof Worker !== 'undefined' && file.size >= IMPORT_PREVIEW_WORKER_THRESHOLD_BYTES) {
    return parseImportFileWithWorker(file, signal);
  }

  throwIfPreviewAborted(signal);
  const rawText = await file.text();
  throwIfPreviewAborted(signal);
  const payload = await parseImportPayload(rawText);
  return summarizeParsedPayload(payload);
}

export async function previewImportFile(
  file: File,
  signal?: AbortSignal
): Promise<ImportPreview> {
  const [summary, existingEntries] = await Promise.all([
    parseImportFileForPreview(file, signal),
    getAllEntries()
  ]);

  return buildPreviewFromSummary(summary, existingEntries);
}

export async function applyImport(
  payload: JsonExportPayload,
  mode: ImportMode
): Promise<{ importedCount: number; undo: () => Promise<void> }> {
  const snapshot = await getAllEntries();
  const undoSnapshot = snapshot.map((entry) => ({ ...entry }));
  const normalizedEntries = normalizeImportedEntries(payload.entries, snapshot, mode);
  const expectedFinalEntries = buildExpectedFinalEntries(snapshot, normalizedEntries, mode);

  await runDatabaseWrite(async () =>
    db.transaction('rw', db.dailyEntries, async () => {
      if (mode === 'replace') {
        await db.dailyEntries.clear();
      }

      if (normalizedEntries.length > 0) {
        await bulkPutEntries(normalizedEntries);
      }

      const actualEntries = await db.dailyEntries.orderBy('[date+sectorId]').toArray();

      if (!hasMatchingEntrySet(expectedFinalEntries, actualEntries)) {
        const firstMismatchCompoundKey = getFirstMismatchCompoundKey(
          expectedFinalEntries,
          actualEntries
        );
        const mismatchHint = firstMismatchCompoundKey
          ? ` First mismatch near [${firstMismatchCompoundKey}].`
          : '';

        throw new Error(
          `Import post-write verification failed. IndexedDB transaction aborted before commit.${mismatchHint}`
        );
      }
    })
  );

  return {
    importedCount: normalizedEntries.length,
    undo: async () => {
      await restoreUndoSnapshot(undoSnapshot);
    }
  };
}
