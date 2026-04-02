import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type DailyEntry,
  type JsonExportPayload
} from '../types';
import { db, reopenIfClosed } from '../db/appDb';
import { createStorageOperationError } from './storage';

const LAST_EXPORT_AT_KEY = 'opsnormal-last-export-at';

interface ChecksumPayload {
  app: JsonExportPayload['app'];
  schemaVersion: JsonExportPayload['schemaVersion'];
  exportedAt: JsonExportPayload['exportedAt'];
  entries: JsonExportPayload['entries'];
}

interface ExportSnapshotResult {
  entries: DailyEntry[];
  exportedAt: string;
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

  return JSON.stringify({ ...payload, checksum }, null, 2);
}

export function createCsvExport(entries: DailyEntry[]): string {
  const header = ['date', 'sectorId', 'status', 'updatedAt'];
  const rows = entries
    .map((entry) => [entry.date, entry.sectorId, entry.status, entry.updatedAt])
    .map((row) => row.map(escapeCsvCell).join(','));

  return [header.join(','), ...rows].join('\n');
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function recordExportCompleted(exportedAt: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LAST_EXPORT_AT_KEY, exportedAt);
}

export function getLastExportCompletedAt(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LAST_EXPORT_AT_KEY);
}

export function formatLastExportCompletedAt(value: string | null): string {
  if (!value) {
    return 'No external backup recorded on this browser yet.';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Last backup timestamp is unreadable. Export again to refresh the record.';
  }

  return `Last external backup: ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(parsedDate)}.`;
}

export async function exportCurrentEntriesAsJson(): Promise<{
  entryCount: number;
  exportedAt: string;
  payload: string;
}> {
  const snapshot = await readExportSnapshot();
  const payload = await createJsonExport(snapshot.entries, snapshot.exportedAt);

  return {
    entryCount: snapshot.entries.length,
    exportedAt: snapshot.exportedAt,
    payload
  };
}

export async function exportCurrentEntriesAsCsv(): Promise<{
  entryCount: number;
  payload: string;
}> {
  const snapshot = await readExportSnapshot();

  return {
    entryCount: snapshot.entries.length,
    payload: createCsvExport(snapshot.entries)
  };
}

export async function computeJsonExportChecksum(payload: ChecksumPayload): Promise<string> {
  const subtleCrypto = getSubtleCrypto();
  const serialized = JSON.stringify({
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries
  });
  const bytes = encodeChecksumInput(serialized);
  const digest = await subtleCrypto.digest('SHA-256', toArrayBuffer(bytes));

  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function readExportSnapshot(): Promise<ExportSnapshotResult> {
  try {
    await reopenIfClosed();

    const entries = await db.transaction('r', db.dailyEntries, async () =>
      db.dailyEntries.orderBy('[date+sectorId]').toArray()
    );

    return {
      entries,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    throw createStorageOperationError(error);
  }
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function escapeCsvCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replaceAll('"', '""')}"`;
  }

  return cell;
}
