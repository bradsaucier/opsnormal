const LAST_EXPORT_AT_KEY = 'opsnormal-last-export-at';

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

export function clearLastExportCompletedAt(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LAST_EXPORT_AT_KEY);
}

export function formatLastExportCompletedAt(value: string | null): string {
  if (!value) {
    return 'No external backup recorded on this browser yet. If the app returns blank after Safari inactivity, restore from the latest JSON export immediately.';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Last backup timestamp is unreadable. Export again to refresh the record, and restore from the latest JSON export immediately if the app returns blank after Safari inactivity.';
  }

  return `Last external backup: ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate)}.`;
}
