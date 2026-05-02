import { ZodError } from 'zod';

import { computeJsonExportChecksum } from '../lib/export';
import { JsonImportSchema } from '../schemas/import';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  STALE_IMPORT_BUFFER_MS,
  type CrashStorageDiagnostics,
  type DailyEntry,
  type ImportIntegrityStatus,
  type JsonExportPayload,
  type RejectedImportPreview,
  type SuccessfulImportPreview,
} from '../types';

export interface ParsedImportSummary {
  payload: JsonExportPayload;
  integrityStatus: ImportIntegrityStatus;
  totalEntries: number;
  dateRange: SuccessfulImportPreview['dateRange'];
}

interface RawChecksumPayload {
  app: JsonExportPayload['app'];
  schemaVersion: JsonExportPayload['schemaVersion'];
  exportedAt: JsonExportPayload['exportedAt'];
  entries: JsonExportPayload['entries'];
  crashDiagnostics?: JsonExportPayload['crashDiagnostics'];
  checksum?: JsonExportPayload['checksum'];
}

type ParsedChecksumPayload = Parameters<typeof computeJsonExportChecksum>[0];

interface ValidationIssueDetails {
  path: string | null;
  message: string;
}

type IncompatibleImportReason = 'app' | 'schema-version';

const BLOCKED_IMPORT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

class UnreadableImportError extends Error {
  constructor() {
    super('Import rejected. File is not valid JSON.');
    this.name = 'UnreadableImportError';
  }
}

class BlockedKeyImportError extends Error {
  blockedKey: string;

  constructor(blockedKey: string) {
    super(`Import rejected. File contains blocked key "${blockedKey}".`);
    this.name = 'BlockedKeyImportError';
    this.blockedKey = blockedKey;
  }
}

class OversizeImportError extends Error {
  maxBytes: number;

  constructor(maxBytes: number) {
    super('Import rejected. File exceeds the 5 MB limit.');
    this.name = 'OversizeImportError';
    this.maxBytes = maxBytes;
  }
}

class IncompatibleImportError extends Error {
  reason: IncompatibleImportReason;
  detectedAppName: string | null;
  detectedSchemaVersion: number | null;

  constructor(args: {
    reason: IncompatibleImportReason;
    detectedAppName?: string | null;
    detectedSchemaVersion?: number | null;
  }) {
    super(
      args.reason === 'app'
        ? 'Import rejected. File is not an OpsNormal backup.'
        : 'Import rejected. Backup schema version is incompatible with this build.',
    );
    this.name = 'IncompatibleImportError';
    this.reason = args.reason;
    this.detectedAppName = args.detectedAppName ?? null;
    this.detectedSchemaVersion = args.detectedSchemaVersion ?? null;
  }
}

class InvalidImportPayloadError extends Error {
  issuePath: string | null;
  issueMessage: string;

  constructor(issue: ValidationIssueDetails) {
    super(issue.path ? `${issue.path} - ${issue.message}` : issue.message);
    this.name = 'InvalidImportPayloadError';
    this.issuePath = issue.path;
    this.issueMessage = issue.message;
  }
}

export class ChecksumFailedImportError extends Error {
  constructor() {
    super(
      'Import rejected. File integrity check failed. The backup may be corrupted or modified.',
    );
    this.name = 'ChecksumFailedImportError';
  }
}

export function isBlockedImportKey(key: string): boolean {
  return BLOCKED_IMPORT_KEYS.has(key);
}

function parseJsonImportText(rawText: string): unknown {
  let blockedKeyDetected: string | null = null;

  const reviver = (key: string, value: unknown): unknown => {
    if (isBlockedImportKey(key)) {
      blockedKeyDetected = key;
      return undefined;
    }

    return value;
  };

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText, reviver) as unknown;
  } catch {
    throw new UnreadableImportError();
  }

  if (blockedKeyDetected) {
    throw new BlockedKeyImportError(blockedKeyDetected);
  }

  return parsed;
}

function getValidationIssueDetails(error: ZodError): ValidationIssueDetails {
  const primaryIssue = error.issues[0];

  if (!primaryIssue) {
    return {
      path: null,
      message: 'Import validation failed.',
    };
  }

  return {
    path: primaryIssue.path.length > 0 ? primaryIssue.path.join('.') : null,
    message: primaryIssue.message,
  };
}

export function formatValidationError(error: ZodError): string {
  const issue = getValidationIssueDetails(error);
  return issue.path ? `${issue.path} - ${issue.message}` : issue.message;
}

function throwIfImportIsIncompatible(parsed: unknown): void {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }

  const candidate = parsed as Record<string, unknown>;
  const detectedAppName =
    typeof candidate.app === 'string' ? candidate.app : null;
  const detectedSchemaVersion =
    typeof candidate.schemaVersion === 'number'
      ? candidate.schemaVersion
      : null;

  if (detectedAppName && detectedAppName !== OPSNORMAL_APP_NAME) {
    throw new IncompatibleImportError({
      reason: 'app',
      detectedAppName,
      detectedSchemaVersion,
    });
  }

  if (
    detectedSchemaVersion !== null &&
    detectedSchemaVersion !== EXPORT_SCHEMA_VERSION
  ) {
    throw new IncompatibleImportError({
      reason: 'schema-version',
      detectedAppName,
      detectedSchemaVersion,
    });
  }
}

export function getImportIntegrityStatus(
  payload: JsonExportPayload,
): ImportIntegrityStatus {
  return payload.checksum ? 'verified' : 'legacy-unverified';
}

export function getDateRange(
  entries: DailyEntry[],
): SuccessfulImportPreview['dateRange'] {
  if (entries.length === 0) {
    return null;
  }

  const sortedDateKeys = entries.map((entry) => entry.date).sort();

  return {
    start: sortedDateKeys[0] ?? '',
    end: sortedDateKeys[sortedDateKeys.length - 1] ?? '',
  };
}

export function getImportAgeMs(exportedAt: string, now = Date.now()): number {
  const exportedAtMs = Date.parse(exportedAt);

  if (Number.isNaN(exportedAtMs)) {
    return 0;
  }

  return Math.max(0, now - exportedAtMs);
}

export function getSuccessfulImportPreviewKind(
  payload: JsonExportPayload,
  now = Date.now(),
): SuccessfulImportPreview['kind'] {
  if (!payload.checksum) {
    return 'legacy-unverified';
  }

  return getImportAgeMs(payload.exportedAt, now) > STALE_IMPORT_BUFFER_MS
    ? 'stale'
    : 'good';
}

export function summarizeParsedPayload(
  payload: JsonExportPayload,
): ParsedImportSummary {
  return {
    payload,
    integrityStatus: getImportIntegrityStatus(payload),
    totalEntries: payload.entries.length,
    dateRange: getDateRange(payload.entries),
  };
}

export async function verifyExportChecksum(
  rawPayload: RawChecksumPayload,
  validatedPayload: JsonExportPayload,
): Promise<void> {
  if (!validatedPayload.checksum) {
    return;
  }

  const computedChecksum = await computeJsonExportChecksum({
    app: rawPayload.app,
    schemaVersion: rawPayload.schemaVersion,
    exportedAt: rawPayload.exportedAt,
    entries: rawPayload.entries,
    crashDiagnostics: rawPayload.crashDiagnostics,
  });

  if (computedChecksum !== validatedPayload.checksum) {
    throw new ChecksumFailedImportError();
  }
}

function buildParsedChecksumPayload(
  payload: JsonExportPayload,
  crashDiagnostics = payload.crashDiagnostics,
): ParsedChecksumPayload {
  const checksumPayload: ParsedChecksumPayload = {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries,
  };

  return crashDiagnostics
    ? {
        ...checksumPayload,
        crashDiagnostics,
      }
    : checksumPayload;
}

function buildCrashDiagnosticsInExportOrder(
  diagnostics: CrashStorageDiagnostics,
): CrashStorageDiagnostics {
  return {
    connectionDropsDetected: diagnostics.connectionDropsDetected,
    reconnectSuccesses: diagnostics.reconnectSuccesses,
    reconnectFailures: diagnostics.reconnectFailures,
    reconnectState: diagnostics.reconnectState,
    lastReconnectError: diagnostics.lastReconnectError,
    lastVerificationResult: diagnostics.lastVerificationResult,
    lastVerifiedAt: diagnostics.lastVerifiedAt,
    persistAttempted: diagnostics.persistAttempted,
    persistGranted: diagnostics.persistGranted,
    standaloneMode: diagnostics.standaloneMode,
    installRecommended: diagnostics.installRecommended,
    webKitRisk: diagnostics.webKitRisk,
  };
}

/**
 * Re-verifies a JsonExportPayload's SHA-256 checksum against its canonical
 * projection. Throws ChecksumFailedImportError on mismatch. Returns silently
 * when no checksum is present. Call before any IndexedDB write.
 */
export async function verifyParsedExportChecksum(
  payload: JsonExportPayload,
): Promise<void> {
  if (!payload.checksum) {
    return;
  }

  const computedChecksum = await computeJsonExportChecksum(
    buildParsedChecksumPayload(payload),
  );

  if (computedChecksum === payload.checksum) {
    return;
  }

  if (payload.crashDiagnostics) {
    const exportOrderChecksum = await computeJsonExportChecksum(
      buildParsedChecksumPayload(
        payload,
        buildCrashDiagnosticsInExportOrder(payload.crashDiagnostics),
      ),
    );

    if (exportOrderChecksum === payload.checksum) {
      return;
    }
  }

  throw new ChecksumFailedImportError();
}

export async function parseImportPayload(
  rawText: string,
): Promise<JsonExportPayload> {
  const parsed = parseJsonImportText(rawText);

  throwIfImportIsIncompatible(parsed);

  const validated = JsonImportSchema.safeParse(parsed);

  if (!validated.success) {
    throw new InvalidImportPayloadError(
      getValidationIssueDetails(validated.error),
    );
  }

  await verifyExportChecksum(parsed as RawChecksumPayload, validated.data);

  return validated.data;
}

export function createRejectedImportPreview(
  error: unknown,
): RejectedImportPreview | null {
  if (error instanceof UnreadableImportError) {
    return {
      kind: 'unreadable',
    };
  }

  if (error instanceof BlockedKeyImportError) {
    return {
      kind: 'blocked-key',
      blockedKey: error.blockedKey,
    };
  }

  if (error instanceof OversizeImportError) {
    return {
      kind: 'oversize',
      maxBytes: error.maxBytes,
    };
  }

  if (error instanceof IncompatibleImportError) {
    return {
      kind: 'incompatible',
      reason: error.reason,
      detectedAppName: error.detectedAppName,
      detectedSchemaVersion: error.detectedSchemaVersion,
    };
  }

  if (error instanceof InvalidImportPayloadError) {
    return {
      kind: 'invalid',
      issuePath: error.issuePath,
      issueMessage: error.issueMessage,
    };
  }

  if (error instanceof ChecksumFailedImportError) {
    return {
      kind: 'checksum-failed',
    };
  }

  return null;
}

export function validateImportFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new OversizeImportError(MAX_IMPORT_BYTES);
  }
}
