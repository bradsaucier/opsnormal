import { useMemo, useState } from 'react';

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
  onStatusMessage: (message: StatusMessage) => void;
}

interface UseExportWorkflowResult {
  backupStatus: string;
  handleCsvExport: () => Promise<void>;
  handleJsonExport: () => Promise<void>;
  markBackupCompleted: (exportedAt: string) => void;
}

export function useExportWorkflow({
  onStatusMessage
}: UseExportWorkflowOptions): UseExportWorkflowResult {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastExportCompletedAt());


  const backupStatus = useMemo(() => formatLastExportCompletedAt(lastBackupAt), [lastBackupAt]);

  function markBackupCompleted(exportedAt: string) {
    recordExportCompleted(exportedAt);
    setLastBackupAt(exportedAt);
  }

  async function handleJsonExport() {
    try {
      const { entryCount, exportedAt, payload } = await exportCurrentEntriesAsJson();
      downloadTextFile('opsnormal-export.json', payload, 'application/json');
      markBackupCompleted(exportedAt);
      onStatusMessage({
        tone: 'success',
        text: `JSON export complete. ${entryCount} entries written to disk.`
      });
    } catch (error) {
      onStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'JSON export failed. Reload the app and try again.'
      });
    }
  }

  async function handleCsvExport() {
    try {
      const { entryCount, payload } = await exportCurrentEntriesAsCsv();
      downloadTextFile('opsnormal-export.csv', payload, 'text/csv;charset=utf-8');
      onStatusMessage({
        tone: 'success',
        text: `CSV export complete. ${entryCount} entries written to disk.`
      });
    } catch (error) {
      onStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'CSV export failed. Reload the app and try again.'
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
