import {
  EXPORT_SCHEMA_VERSION,
  type ImportMode,
  type ImportPreview,
  type SuccessfulImportPreview,
} from '../../types';
import type { StatusMessage } from './workflowTypes';

export function getImportImpactText(
  preview: SuccessfulImportPreview,
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

export function getImportPreviewHeadline(preview: ImportPreview): string {
  switch (preview.kind) {
    case 'good':
      return 'Backup file ready to import.';
    case 'stale':
      return 'Backup file is older than the freshness buffer.';
    case 'legacy-unverified':
      return 'Legacy backup. Structure validated.';
    case 'incompatible':
      return 'Backup is from an unsupported schema or app.';
    case 'checksum-failed':
      return 'Backup file failed the integrity check.';
    case 'oversize':
      return 'Backup file exceeds the import limit.';
    case 'blocked-key':
      return 'Backup file contains a blocked key.';
    case 'invalid':
      return 'Backup did not validate.';
    case 'unreadable':
      return 'File is not valid JSON.';
  }
}

export function getImportPreviewDetailText(preview: ImportPreview): string {
  switch (preview.kind) {
    case 'good':
      return 'Integrity verified. Embedded SHA-256 checksum matched.';
    case 'stale':
      return 'Integrity verified. Embedded SHA-256 checksum matched, but this backup is older than the freshness buffer.';
    case 'legacy-unverified':
      return 'This file has no integrity checksum. Structure validated, but the file contents could not be checked against a saved hash.';
    case 'incompatible':
      return preview.reason === 'app'
        ? `This file identifies app "${preview.detectedAppName ?? 'unknown'}". OpsNormal imports only OpsNormal backups. Import is not available.`
        : `This backup declares schema version ${preview.detectedSchemaVersion ?? 'unknown'}. This build supports schema version ${EXPORT_SCHEMA_VERSION}. Import is not available.`;
    case 'checksum-failed':
      return 'The embedded SHA-256 checksum did not match the file contents. The file may be corrupted or modified. Import is not available.';
    case 'oversize':
      return `File exceeds the ${formatImportByteLimit(preview.maxBytes)} import limit. Import is not available.`;
    case 'blocked-key':
      return `File contains a blocked key (${preview.blockedKey}). Import is not available.`;
    case 'invalid': {
      const issuePrefix = preview.issuePath ? `${preview.issuePath} - ` : '';
      return `Backup did not validate. ${issuePrefix}${preview.issueMessage} Import is not available.`;
    }
    case 'unreadable':
      return 'File is not valid JSON. Import is not available.';
  }
}

export function getImportPreviewStatusMessage(
  preview: ImportPreview,
): StatusMessage {
  switch (preview.kind) {
    case 'good':
      return {
        tone: 'success',
        text: `Import staged. ${preview.totalEntries} entries validated. Review the preview and confirm the write path.`,
      };
    case 'stale':
      return {
        tone: 'warning',
        text: `Stale backup staged. ${preview.totalEntries} entries validated, but this file is older than the freshness buffer. Review the preview and acknowledge the risk before import unlocks.`,
      };
    case 'legacy-unverified':
      return {
        tone: 'warning',
        text: `Legacy import staged. ${preview.totalEntries} entries validated, but this file has no integrity checksum. Review the preview and acknowledge the risk before import unlocks.`,
      };
    case 'incompatible':
    case 'checksum-failed':
    case 'oversize':
    case 'blocked-key':
    case 'invalid':
    case 'unreadable':
      return {
        tone: 'error',
        text: `${getImportPreviewHeadline(preview)} Local data unchanged.`,
      };
  }
}

export function formatImportExportedAt(exportedAt: string): string {
  const parsedDate = new Date(exportedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unreadable export timestamp';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
}

export function formatImportAge(ageMs: number): string {
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  if (ageMs < hourMs) {
    return 'Less than 1 hour old';
  }

  if (ageMs < dayMs) {
    const hours = Math.floor(ageMs / hourMs);
    return `${hours} hour${hours === 1 ? '' : 's'} old`;
  }

  const days = Math.floor(ageMs / dayMs);
  return `${days} day${days === 1 ? '' : 's'} old`;
}

export function getImportRiskAcknowledgmentLabel(
  preview: SuccessfulImportPreview,
): string {
  return preview.kind === 'stale'
    ? 'I reviewed the export time and date range and accept that this backup may miss more recent local entries.'
    : 'I understand this backup has no checksum and that corruption or modification would not be detected.';
}

function formatImportByteLimit(maxBytes: number): string {
  const maxMegabytes = maxBytes / (1024 * 1024);
  return `${maxMegabytes.toFixed(0)} MB`;
}
