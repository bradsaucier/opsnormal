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

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

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

export async function readImportFile(file: File): Promise<string> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('Import rejected. File exceeds the 5 MB limit.');
  }

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
  const existingKeys = new Set(existingEntries.map((entry) => getCompoundKey(entry)));
  const overwriteCount = payload.entries.filter((entry) => existingKeys.has(getCompoundKey(entry))).length;

  return {
    payload,
    integrityStatus: getImportIntegrityStatus(payload),
    overwriteCount,
    newEntryCount: payload.entries.length - overwriteCount,
    totalEntries: payload.entries.length,
    dateRange: getDateRange(payload.entries)
  };
}

export async function previewImportFile(file: File): Promise<ImportPreview> {
  const rawText = await readImportFile(file);
  const payload = await parseImportPayload(rawText);
  return previewImportPayload(payload);
}

export async function applyImport(
  payload: JsonExportPayload,
  mode: ImportMode
): Promise<{ importedCount: number; undo: () => Promise<void> }> {
  const snapshot = await getAllEntries();
  const normalizedEntries = normalizeImportedEntries(payload.entries, snapshot, mode);

  await runDatabaseWrite(async () =>
    db.transaction('rw', db.dailyEntries, async () => {
      if (mode === 'replace') {
        await db.dailyEntries.clear();
      }

      await db.dailyEntries.bulkPut(normalizedEntries);
    })
  );

  return {
    importedCount: normalizedEntries.length,
    undo: async () => {
      await runDatabaseWrite(async () =>
        db.transaction('rw', db.dailyEntries, async () => {
          await db.dailyEntries.clear();
          if (snapshot.length > 0) {
            await db.dailyEntries.bulkPut(snapshot);
          }
        })
      );
    }
  };
}
