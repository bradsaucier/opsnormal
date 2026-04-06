import { ZodError } from 'zod';

import { computeJsonExportChecksum } from '../lib/export';
import { JsonImportSchema } from '../schemas/import';
import type { DailyEntry, ImportIntegrityStatus, ImportPreview, JsonExportPayload } from '../types';

export interface ParsedImportSummary {
  payload: JsonExportPayload;
  integrityStatus: ImportIntegrityStatus;
  totalEntries: number;
  dateRange: ImportPreview['dateRange'];
}

const BLOCKED_IMPORT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function isBlockedImportKey(key: string): boolean {
  return BLOCKED_IMPORT_KEYS.has(key);
}

function parseJsonImportText(rawText: string): unknown {
  let blockedKeyDetected = false;

  const reviver = (key: string, value: unknown): unknown => {
    if (isBlockedImportKey(key)) {
      blockedKeyDetected = true;
      return undefined;
    }

    return value;
  };

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText, reviver) as unknown;
  } catch {
    throw new Error('Import rejected. File is not valid JSON.');
  }

  if (blockedKeyDetected) {
    throw new Error('Import rejected. File contains blocked keys.');
  }

  return parsed;
}

export function formatValidationError(error: ZodError): string {
  const primaryIssue = error.issues[0];

  if (!primaryIssue) {
    return 'Import validation failed.';
  }

  const path = primaryIssue.path.length > 0 ? `${primaryIssue.path.join('.')} - ` : '';
  return `${path}${primaryIssue.message}`;
}

export function getImportIntegrityStatus(payload: JsonExportPayload): ImportIntegrityStatus {
  return payload.checksum ? 'verified' : 'legacy-unverified';
}

export function getDateRange(entries: DailyEntry[]): ImportPreview['dateRange'] {
  if (entries.length === 0) {
    return null;
  }

  const sortedDateKeys = entries.map((entry) => entry.date).sort();

  return {
    start: sortedDateKeys[0] ?? '',
    end: sortedDateKeys[sortedDateKeys.length - 1] ?? ''
  };
}

export function summarizeParsedPayload(payload: JsonExportPayload): ParsedImportSummary {
  return {
    payload,
    integrityStatus: getImportIntegrityStatus(payload),
    totalEntries: payload.entries.length,
    dateRange: getDateRange(payload.entries)
  };
}

interface RawChecksumPayload {
  app: JsonExportPayload['app'];
  schemaVersion: JsonExportPayload['schemaVersion'];
  exportedAt: JsonExportPayload['exportedAt'];
  entries: JsonExportPayload['entries'];
  checksum?: JsonExportPayload['checksum'];
}

export async function verifyExportChecksum(
  rawPayload: RawChecksumPayload,
  validatedPayload: JsonExportPayload
): Promise<void> {
  if (!validatedPayload.checksum) {
    return;
  }

  const computedChecksum = await computeJsonExportChecksum({
    app: rawPayload.app,
    schemaVersion: rawPayload.schemaVersion,
    exportedAt: rawPayload.exportedAt,
    entries: rawPayload.entries
  });

  if (computedChecksum !== validatedPayload.checksum) {
    throw new Error(
      'Import rejected. File integrity check failed. The backup may be corrupted or modified.'
    );
  }
}

export async function parseImportPayload(rawText: string): Promise<JsonExportPayload> {
  const parsed = parseJsonImportText(rawText);
  const validated = JsonImportSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(formatValidationError(validated.error));
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Checksum must be computed
  // from raw parsed entries to preserve byte-identical JSON.stringify symmetry with the export
  // path. Zod rebuilds objects in schema-definition property order, which would silently break
  // integrity verification for valid backups.
  await verifyExportChecksum(parsed as RawChecksumPayload, validated.data);

  return validated.data;
}

export function validateImportFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('Import rejected. File exceeds the 5 MB limit.');
  }
}
