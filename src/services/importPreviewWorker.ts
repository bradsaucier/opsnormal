import { ZodError } from 'zod';

import { computeJsonExportChecksum } from '../lib/export';
import { JsonImportSchema } from '../schemas/import';
import type { DailyEntry, ImportIntegrityStatus, JsonExportPayload } from '../types';

interface WorkerPreviewRequest {
  buffer: ArrayBuffer;
  size: number;
}

type RawChecksumPayload = Pick<
  JsonExportPayload,
  'app' | 'schemaVersion' | 'exportedAt' | 'checksum'
> & {
  entries: JsonExportPayload['entries'];
};

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

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

function getImportIntegrityStatus(payload: JsonExportPayload): ImportIntegrityStatus {
  return payload.checksum ? 'verified' : 'legacy-unverified';
}

function getDateRange(entries: DailyEntry[]) {
  if (entries.length === 0) {
    return null;
  }

  const sortedDateKeys = entries.map((entry) => entry.date).sort();

  return {
    start: sortedDateKeys[0] ?? '',
    end: sortedDateKeys[sortedDateKeys.length - 1] ?? ''
  };
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

self.onmessage = async (event: MessageEvent<WorkerPreviewRequest>) => {
  try {
    const request = event.data;

    if (!(request.buffer instanceof ArrayBuffer) || !Number.isFinite(request.size)) {
      throw new Error('Import rejected. Preview worker did not receive a transferable payload.');
    }

    if (request.size > MAX_IMPORT_BYTES) {
      throw new Error('Import rejected. File exceeds the 5 MB limit.');
    }

    const rawText = new TextDecoder().decode(request.buffer);
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

    self.postMessage({
      ok: true,
      summary: {
        payload: validated.data,
        integrityStatus: getImportIntegrityStatus(validated.data),
        totalEntries: validated.data.entries.length,
        dateRange: getDateRange(validated.data.entries)
      }
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'Import preparation failed.'
    });
  }
};
