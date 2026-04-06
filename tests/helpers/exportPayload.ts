import { computeJsonExportChecksum } from '../../src/lib/export';
import { JsonImportSchema } from '../../src/schemas/import';
import type { JsonExportPayload } from '../../src/types';

type ChecksumPayload = Parameters<typeof computeJsonExportChecksum>[0];

export interface ParsedExportPayloadDetails {
  payload: JsonExportPayload;
  rawChecksumPayload: ChecksumPayload;
}

function buildRawChecksumPayload(parsed: unknown, payload: JsonExportPayload): ChecksumPayload {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Export payload must be a JSON object.');
  }

  const parsedRecord = parsed as Record<string, unknown>;
  const rawEntries = parsedRecord.entries;
  const rawCrashDiagnostics = parsedRecord.crashDiagnostics;

  if (!Array.isArray(rawEntries)) {
    throw new Error('Export payload entries must be an array.');
  }

  return {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: rawEntries as ChecksumPayload['entries'],
    ...(rawCrashDiagnostics && typeof rawCrashDiagnostics === 'object'
      ? {
          crashDiagnostics: rawCrashDiagnostics as NonNullable<ChecksumPayload['crashDiagnostics']>
        }
      : {})
  };
}

export function parseExportPayloadDetails(rawText: string): ParsedExportPayloadDetails {
  const parsed: unknown = JSON.parse(rawText) as unknown;
  const payload = JsonImportSchema.parse(parsed);

  return {
    payload,
    rawChecksumPayload: buildRawChecksumPayload(parsed, payload)
  };
}

export function parseExportPayload(rawText: string): JsonExportPayload {
  return parseExportPayloadDetails(rawText).payload;
}
