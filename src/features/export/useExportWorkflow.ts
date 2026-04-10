import { useMemo, useState } from 'react';

import { getErrorMessage } from '../../lib/errors';
import {
  downloadTextFile,
  exportCurrentEntriesAsCsv,
  exportCurrentEntriesAsJson,
  formatLastExportCompletedAt,
  getLastExportCompletedAt,
  recordExportCompleted
} from '../../lib/export';
import type { StatusMessage } from './workflowTypes';

interface UseExportWorkflowOptions {
  onBackupCompleted?: (exportedAt: string) => void;
  onStatusMessage: (message: StatusMessage) => void;
}

interface UseExportWorkflowResult {
  backupStatus: string;
  handleCsvExport: () => Promise<void>;
  handleJsonExport: () => Promise<void>;
  markBackupCompleted: (exportedAt: string) => void;
}

export function useExportWorkflow({
  onBackupCompleted = () => undefined,
  onStatusMessage
}: UseExportWorkflowOptions): UseExportWorkflowResult {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(getLastExportCompletedAt());

  const backupStatus = useMemo(() => formatLastExportCompletedAt(lastBackupAt), [lastBackupAt]);

  function markBackupCompleted(exportedAt: string) {
    recordExportCompleted(exportedAt);
    setLastBackupAt(exportedAt);
    onBackupCompleted(exportedAt);
  }

  async function handleJsonExport() {
    try {
      const exportResult: Awaited<ReturnType<typeof exportCurrentEntriesAsJson>> =
        await exportCurrentEntriesAsJson();
      downloadTextFile('opsnormal-export.json', exportResult.payload, 'application/json');
      markBackupCompleted(exportResult.exportedAt);
      onStatusMessage({
        tone: 'success',
        text: `JSON export complete. ${exportResult.entryCount} entries written to disk.`
      });
    } catch (error: unknown) {
      onStatusMessage({
        tone: 'error',
        text: getErrorMessage(error, 'JSON export failed. Reload the app and try again.')
      });
    }
  }

  async function handleCsvExport() {
    try {
      const exportResult: Awaited<ReturnType<typeof exportCurrentEntriesAsCsv>> =
        await exportCurrentEntriesAsCsv();
      downloadTextFile('opsnormal-export.csv', exportResult.payload, 'text/csv;charset=utf-8');
      onStatusMessage({
        tone: 'success',
        text: `CSV export complete. ${exportResult.entryCount} entries written to disk.`
      });
    } catch (error: unknown) {
      onStatusMessage({
        tone: 'error',
        text: getErrorMessage(error, 'CSV export failed. Reload the app and try again.')
      });
    }
  }

  return {
    backupStatus,
    handleCsvExport,
    handleJsonExport,
    markBackupCompleted
  };
}
