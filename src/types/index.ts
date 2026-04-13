export const OPSNORMAL_APP_NAME = 'OpsNormal';
export const EXPORT_SCHEMA_VERSION = 1;

export const SECTORS = [
  {
    id: 'work-school',
    label: 'Work or School',
    shortLabel: 'WORK',
    description: 'Professional load, classwork, deadlines, and mission focus.',
  },
  {
    id: 'household',
    label: 'Household',
    shortLabel: 'HOME',
    description: 'Admin, maintenance, chores, and domestic follow-through.',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    shortLabel: 'RELS',
    description: 'Partnership, family, and close human connection.',
  },
  {
    id: 'body',
    label: 'Body',
    shortLabel: 'BODY',
    description: 'Exercise, nutrition, hygiene, and physical maintenance.',
  },
  {
    id: 'rest',
    label: 'Rest',
    shortLabel: 'REST',
    description: 'Sleep, downtime, decompression, and recovery margin.',
  },
] as const;

export type Sector = (typeof SECTORS)[number];
export type SectorId = Sector['id'];

export type EntryStatus = 'nominal' | 'degraded';
export type UiStatus = EntryStatus | 'unmarked';
export type ImportMode = 'merge' | 'replace';
export type ImportIntegrityStatus = 'verified' | 'legacy-unverified';

export interface DailyEntry {
  id?: number;
  date: string;
  sectorId: SectorId;
  status: EntryStatus;
  updatedAt: string;
}

export interface CrashStorageDiagnostics {
  connectionDropsDetected: number;
  reconnectSuccesses: number;
  reconnectFailures: number;
  reconnectState: 'steady' | 'recovering' | 'failed';
  lastReconnectError: string | null;
  persistAttempted: boolean;
  persistGranted: boolean;
  standaloneMode: boolean;
  installRecommended: boolean;
  webKitRisk: boolean;
  lastVerificationResult: 'unknown' | 'verified' | 'mismatch' | 'failed';
  lastVerifiedAt: string | null;
}

export interface JsonExportPayload {
  app: typeof OPSNORMAL_APP_NAME;
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  entries: DailyEntry[];
  checksum?: string;
  crashDiagnostics?: CrashStorageDiagnostics;
}

export interface ImportPreview {
  payload: JsonExportPayload;
  integrityStatus: ImportIntegrityStatus;
  existingEntryCount: number;
  overwriteCount: number;
  newEntryCount: number;
  totalEntries: number;
  dateRange: {
    start: string;
    end: string;
  } | null;
}
