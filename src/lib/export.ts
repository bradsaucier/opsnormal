import type { DailyEntry } from '../types';
import { db, reopenIfClosed } from '../db/appDb';
import { createStorageOperationError } from './storage';
import {
  downloadTextFile,
  canUseVerifiedFileSave,
  isSaveVerificationUnavailableError,
  saveTextFileWithPicker,
} from './fileDownload';
import {
  createCrashJsonExport,
  createCsvExport,
  createJsonExport,
  computeJsonExportChecksum,
} from './exportSerialization';
import {
  clearLastExportCompletedAt,
  recordExportCompleted,
  getLastExportCompletedAt,
  formatLastExportCompletedAt,
} from './exportPersistence';

// Architecture: ADR-0007, ADR-0008, ADR-0010, and ADR-0012 define the local-only
// data-sovereignty perimeter. Export artifacts must be versioned, checksummed, and
// validated before destructive replace paths are allowed to proceed.
interface ExportSnapshotResult {
  entries: DailyEntry[];
  exportedAt: string;
}

export type BackupCheckpointResult =
  | { kind: 'verified-save-succeeded'; fileName: string; exportedAt: string }
  | {
      kind: 'manual-verification-required';
      fileName: string;
      exportedAt: string;
      message: string;
    }
  | {
      kind: 'fallback-download-triggered';
      fileName: string;
      exportedAt: string;
    }
  | {
      kind: 'save-cancelled';
      fileName: string;
      exportedAt: string;
      message: string;
    }
  | {
      kind: 'save-failed';
      fileName: string;
      exportedAt: string;
      message: string;
    };

function isSaveCancellationError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return error instanceof Error && /cancelled|canceled/i.test(error.message);
}

export async function checkpointJsonBackupToDisk(args: {
  fileName: string;
  exportedAt: string;
  payload: string;
}): Promise<BackupCheckpointResult> {
  if (canUseVerifiedFileSave()) {
    try {
      await saveTextFileWithPicker(
        args.fileName,
        args.payload,
        'application/json',
      );
      return {
        kind: 'verified-save-succeeded',
        fileName: args.fileName,
        exportedAt: args.exportedAt,
      };
    } catch (error) {
      if (isSaveCancellationError(error)) {
        return {
          kind: 'save-cancelled',
          fileName: args.fileName,
          exportedAt: args.exportedAt,
          message: 'Backup save cancelled. Local data unchanged.',
        };
      }

      if (isSaveVerificationUnavailableError(error)) {
        return {
          kind: 'manual-verification-required',
          fileName: args.fileName,
          exportedAt: args.exportedAt,
          message:
            'Backup save completed, but the browser could not read the saved file back for verification. Confirm the file on local disk before replace unlocks.',
        };
      }

      return {
        kind: 'save-failed',
        fileName: args.fileName,
        exportedAt: args.exportedAt,
        message:
          error instanceof Error
            ? error.message
            : 'Pre-replace backup failed. Local data remains untouched.',
      };
    }
  }

  try {
    downloadTextFile(args.fileName, args.payload, 'application/json');
    return {
      kind: 'fallback-download-triggered',
      fileName: args.fileName,
      exportedAt: args.exportedAt,
    };
  } catch (error) {
    return {
      kind: 'save-failed',
      fileName: args.fileName,
      exportedAt: args.exportedAt,
      message:
        error instanceof Error
          ? error.message
          : 'Pre-replace backup failed. Local data remains untouched.',
    };
  }
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
    payload,
  };
}

export async function exportCurrentEntriesAsCsv(): Promise<{
  entryCount: number;
  payload: string;
}> {
  const snapshot = await readExportSnapshot();

  return {
    entryCount: snapshot.entries.length,
    payload: createCsvExport(snapshot.entries),
  };
}

async function readExportSnapshot(): Promise<ExportSnapshotResult> {
  try {
    await reopenIfClosed();

    const entries = await db.transaction('r', db.dailyEntries, async () =>
      db.dailyEntries.orderBy('[date+sectorId]').toArray(),
    );

    return {
      entries,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw createStorageOperationError(error);
  }
}

export {
  canUseVerifiedFileSave,
  clearLastExportCompletedAt,
  computeJsonExportChecksum,
  createCrashJsonExport,
  createCsvExport,
  createJsonExport,
  downloadTextFile,
  formatLastExportCompletedAt,
  getLastExportCompletedAt,
  recordExportCompleted,
  saveTextFileWithPicker,
};
