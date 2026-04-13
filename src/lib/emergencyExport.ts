import type { CrashExportSnapshot } from './crashExport';
import { readCrashExportSnapshot } from './crashExport';
import { recordExportCompleted } from './exportPersistence';
import { createCrashJsonExport, createCsvExport } from './exportSerialization';
import { downloadTextFile } from './fileDownload';

export interface EmergencyExportResult {
  recoveredCount: number;
  skippedCount: number;
  exportedAt: string;
}

function buildEmergencyExportResult(
  snapshot: CrashExportSnapshot,
  exportedAt: string,
): EmergencyExportResult {
  return {
    recoveredCount: snapshot.entries.length,
    skippedCount: snapshot.skippedCount,
    exportedAt,
  };
}

export async function exportEmergencyJsonBackup(
  fileName = 'opsnormal-emergency-export.json',
): Promise<EmergencyExportResult> {
  const snapshot = await readCrashExportSnapshot();
  const exportedAt = new Date().toISOString();
  const payload = await createCrashJsonExport(
    snapshot.entries,
    snapshot.storageDiagnostics,
    exportedAt,
  );

  downloadTextFile(fileName, payload, 'application/json');
  recordExportCompleted(exportedAt);

  return buildEmergencyExportResult(snapshot, exportedAt);
}

export async function exportEmergencyCsvBackup(
  fileName = 'opsnormal-emergency-export.csv',
): Promise<EmergencyExportResult> {
  const snapshot = await readCrashExportSnapshot();
  const exportedAt = new Date().toISOString();
  const payload = createCsvExport(snapshot.entries);

  downloadTextFile(fileName, payload, 'text/csv;charset=utf-8');
  recordExportCompleted(exportedAt);

  return buildEmergencyExportResult(snapshot, exportedAt);
}
