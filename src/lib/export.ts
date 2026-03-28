import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type DailyEntry,
  type JsonExportPayload
} from '../types';

const LAST_EXPORT_AT_KEY = 'opsnormal-last-export-at';

export function createJsonExport(
  entries: DailyEntry[],
  exportedAt: string = new Date().toISOString()
): string {
  const payload: JsonExportPayload = {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt,
    entries
  };

  return JSON.stringify(payload, null, 2);
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

function escapeCsvCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replaceAll('"', '""')}"`;
  }

  return cell;
}
