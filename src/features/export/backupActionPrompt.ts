import type { StorageHealth } from '../../lib/storage';

// Architecture: ADR-0017 and ADR-0019 enforce explicit backup prompts over silent hints.
// WebKit tab exposure and backup age are operator risk signals, not durability guarantees.
const SAFARI_EXPORT_REFRESH_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

export interface BackupActionPrompt {
  title: string;
  detail: string;
  tone: 'warning';
}

function parseTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasRecentJsonBackup(
  lastBackupAt: string | null,
  maxAgeMs: number,
  nowMs: number
): boolean {
  const parsedLastBackupAt = parseTimestamp(lastBackupAt);

  if (parsedLastBackupAt === null) {
    return false;
  }

  return nowMs - parsedLastBackupAt < maxAgeMs;
}

function hasStorageRecoveryWarning(storageHealth: StorageHealth): boolean {
  return (
    storageHealth.safari.reconnectState !== 'steady' ||
    storageHealth.safari.lastVerificationResult === 'mismatch' ||
    storageHealth.safari.lastVerificationResult === 'failed'
  );
}

function hasElevatedSafariTabRisk(storageHealth: StorageHealth): boolean {
  return storageHealth.safari.webKitRisk && !storageHealth.safari.standaloneMode;
}

export function createBackupActionPrompt(
  storageHealth: StorageHealth | null,
  lastBackupAt: string | null,
  now: Date = new Date()
): BackupActionPrompt | null {
  if (!storageHealth) {
    return null;
  }

  const nowMs = now.getTime();
  const hasFreshBackupForSafariWindow = hasRecentJsonBackup(
    lastBackupAt,
    SAFARI_EXPORT_REFRESH_WINDOW_MS,
    nowMs
  );
  const hasRecordedBackup = parseTimestamp(lastBackupAt) !== null;

  if (hasStorageRecoveryWarning(storageHealth)) {
    return {
      tone: 'warning',
      title: 'Confirm state and refresh the JSON backup',
      detail:
        'Recent storage diagnostics show a reconnect or write-verification warning. Confirm the latest visible check-in, then create a fresh JSON export before more edits.'
    };
  }

  if (hasElevatedSafariTabRisk(storageHealth) && !hasFreshBackupForSafariWindow) {
    return {
      tone: 'warning',
      title: 'Safari tab risk requires a fresh backup',
      detail:
        'This session is running in a Safari-family browser tab rather than an installed app context. Refresh the JSON export now and install to Home Screen when that path is available.'
    };
  }

  if ((storageHealth.status === 'warning' || storageHealth.status === 'unavailable') && !hasRecordedBackup) {
    return {
      tone: 'warning',
      title: 'No external JSON backup recorded',
      detail:
        'Browser-managed storage is under elevated risk and this browser has no recorded JSON backup yet. Create one now before relying on local-only data.'
    };
  }

  return null;
}
