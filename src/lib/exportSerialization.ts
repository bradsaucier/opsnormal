import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type CrashStorageDiagnostics,
  type DailyEntry,
  type JsonExportPayload
} from '../types';

interface ChecksumPayload {
  app: JsonExportPayload['app'];
  schemaVersion: JsonExportPayload['schemaVersion'];
  exportedAt: JsonExportPayload['exportedAt'];
  entries: JsonExportPayload['entries'];
  crashDiagnostics?: JsonExportPayload['crashDiagnostics'];
}

function buildChecksumPayload(payload: ChecksumPayload): ChecksumPayload {
  return {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries,
    ...(payload.crashDiagnostics ? { crashDiagnostics: payload.crashDiagnostics } : {})
  };
}

export async function createJsonExport(
  entries: DailyEntry[],
  exportedAt: string = new Date().toISOString()
): Promise<string> {
  const payload: ChecksumPayload = {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    entries
  };

  const checksum = await computeJsonExportChecksum(payload);

  return JSON.stringify({ ...buildChecksumPayload(payload), checksum }, null, 2);
}

export async function createCrashJsonExport(
  entries: DailyEntry[],
  crashDiagnostics: CrashStorageDiagnostics,
  exportedAt: string = new Date().toISOString()
): Promise<string> {
  const payload: ChecksumPayload = {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    entries,
    crashDiagnostics
  };
  const checksum = await computeJsonExportChecksum(payload);

  return JSON.stringify({ ...buildChecksumPayload(payload), checksum }, null, 2);
}

export function createCsvExport(entries: DailyEntry[]): string {
  const header = ['date', 'sectorId', 'status', 'updatedAt'];
  const rows = entries
    .map((entry) => [entry.date, entry.sectorId, entry.status, entry.updatedAt])
    .map((row) => row.map(escapeCsvCell).join(','));

  return [header.join(','), ...rows].join('\n');
}

export async function computeJsonExportChecksum(payload: ChecksumPayload): Promise<string> {
  const subtleCrypto = getSubtleCrypto();
  const serialized = JSON.stringify(buildChecksumPayload(payload));
  const bytes = encodeChecksumInput(serialized);
  const digestInput = toDigestBuffer(bytes);
  const digest = await subtleCrypto.digest('SHA-256', digestInput);

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }

  const secureContextHint =
    typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean'
      ? window.isSecureContext
      : typeof globalThis.isSecureContext === 'boolean'
        ? globalThis.isSecureContext
        : true;

  if (!secureContextHint) {
    throw new Error(
      'Export integrity check unavailable. Open the app from a secure HTTPS origin, then retry the export.'
    );
  }

  throw new Error(
    'Export integrity check unavailable. This browser does not expose the required Web Crypto API.'
  );
}

function encodeChecksumInput(serialized: string): Uint8Array {
  const bytes = new TextEncoder().encode(serialized);

  if (serialized.length > 0 && bytes.length === 0) {
    throw new Error(
      'Export integrity check failed while encoding the backup payload. Retry the export before trusting the file.'
    );
  }

  return bytes;
}

function toDigestBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const digestInput = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  digestInput.set(bytes);
  return digestInput;
}

function escapeCsvCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replaceAll('"', '""')}"`;
  }

  return cell;
}
