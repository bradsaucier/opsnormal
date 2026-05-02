import { computeJsonExportChecksum } from '../../src/lib/export';
import { JsonImportSchema } from '../../src/schemas/import';
import type { JsonExportPayload } from '../../src/types';

type ChecksumPayload = Parameters<typeof computeJsonExportChecksum>[0];

export interface ParsedExportPayloadDetails {
  payload: JsonExportPayload;
  rawChecksumPayload: ChecksumPayload;
}

export interface ParseExportPayloadOptions {
  legacyV1?: boolean;
}

function buildRawChecksumPayload(
  parsed: unknown,
  payload: JsonExportPayload,
  options: ParseExportPayloadOptions = {},
): ChecksumPayload {
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
    ...(!options.legacyV1 && payload.checksumAlgorithm
      ? { checksumAlgorithm: payload.checksumAlgorithm }
      : {}),
    exportedAt: payload.exportedAt,
    entries: rawEntries as ChecksumPayload['entries'],
    ...(rawCrashDiagnostics && typeof rawCrashDiagnostics === 'object'
      ? {
          crashDiagnostics: rawCrashDiagnostics as NonNullable<
            ChecksumPayload['crashDiagnostics']
          >,
        }
      : {}),
  };
}

export function parseExportPayloadDetails(
  rawText: string,
  options: ParseExportPayloadOptions = {},
): ParsedExportPayloadDetails {
  const parsed: unknown = JSON.parse(rawText) as unknown;
  const payload = JsonImportSchema.parse(parsed);

  return {
    payload,
    rawChecksumPayload: buildRawChecksumPayload(parsed, payload, options),
  };
}

export function parseExportPayload(
  rawText: string,
  options: ParseExportPayloadOptions = {},
): JsonExportPayload {
  return parseExportPayloadDetails(rawText, options).payload;
}
