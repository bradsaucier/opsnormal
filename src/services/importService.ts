import { ZodError } from 'zod';

import { db, getAllEntries } from '../db/appDb';
import { JsonImportSchema, type ParsedJsonImport } from '../schemas/import';
import type { DailyEntry, ImportMode, ImportPreview, JsonExportPayload } from '../types';

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

export function parseImportPayload(rawText: string): JsonExportPayload {
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

  return validated.data;
}

export async function previewImportPayload(payload: JsonExportPayload): Promise<ImportPreview> {
  const existingEntries = await getAllEntries();
  const existingKeys = new Set(existingEntries.map((entry) => getCompoundKey(entry)));
  const overwriteCount = payload.entries.filter((entry) => existingKeys.has(getCompoundKey(entry))).length;

  return {
    payload,
    overwriteCount,
    newEntryCount: payload.entries.length - overwriteCount,
    totalEntries: payload.entries.length,
    dateRange: getDateRange(payload.entries)
  };
}

export async function previewImportFile(file: File): Promise<ImportPreview> {
  const rawText = await readImportFile(file);
  const payload = parseImportPayload(rawText);
  return previewImportPayload(payload);
}

export async function applyImport(
  payload: JsonExportPayload,
  mode: ImportMode
): Promise<{ importedCount: number; undo: () => Promise<void> }> {
  const snapshot = await getAllEntries();
  const normalizedEntries = normalizeImportedEntries(payload.entries, snapshot, mode);

  await db.transaction('rw', db.dailyEntries, async () => {
    if (mode === 'replace') {
      await db.dailyEntries.clear();
    }

    await db.dailyEntries.bulkPut(normalizedEntries);
  });

  return {
    importedCount: normalizedEntries.length,
    undo: async () => {
      await db.transaction('rw', db.dailyEntries, async () => {
        await db.dailyEntries.clear();
        if (snapshot.length > 0) {
          await db.dailyEntries.bulkPut(snapshot);
        }
      });
    }
  };
}
