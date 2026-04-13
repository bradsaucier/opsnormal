import type { ImportMode, ImportPreview } from '../../types';
import type { StatusMessage } from './workflowTypes';

export function getImportImpactText(
  preview: ImportPreview,
  mode: ImportMode,
): string {
  if (mode === 'replace') {
    return `Replace ${preview.existingEntryCount} current rows with ${preview.totalEntries} imported rows.`;
  }

  return `${preview.newEntryCount} new rows and ${preview.overwriteCount} overwrites will be applied. All other local rows stay in place.`;
}

export function getDefaultStatusMessage(): StatusMessage {
  return {
    tone: 'info',
    text: 'Backup and recovery are local actions. No cloud sync. No account system.',
  };
}
