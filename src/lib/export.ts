import Dexie from 'dexie';

import { applyOpsNormalDbSchema, OPSNORMAL_DB_NAME } from '../db/schema';
import { DailyEntrySchema } from '../schemas/import';
import type { CrashStorageDiagnostics, DailyEntry } from '../types';
import { getStorageDurabilityDiagnostics, isPersistentStorageGranted } from './storage';

export interface CrashExportSnapshot {
  entries: DailyEntry[];
  skippedCount: number;
  storageDiagnostics: CrashStorageDiagnostics;
}

function compareEntries(left: DailyEntry, right: DailyEntry): number {
  const leftKey = `${left.date}:${left.sectorId}`;
  const rightKey = `${right.date}:${right.sectorId}`;
  return leftKey.localeCompare(rightKey);
}

function sanitizeCrashExportEntries(rawEntries: unknown[]): Pick<CrashExportSnapshot, 'entries' | 'skippedCount'> {
  const entries: DailyEntry[] = [];
  let skippedCount = 0;

  for (const rawEntry of rawEntries) {
    const parsed = DailyEntrySchema.safeParse(rawEntry);

    if (!parsed.success) {
      skippedCount += 1;
      continue;
    }

    const { date, sectorId, status, updatedAt } = parsed.data;
    entries.push({
      date,
      sectorId,
      status,
      updatedAt
    });
  }

  entries.sort(compareEntries);

  return {
    entries,
    skippedCount
  };
}

async function readCrashStorageDiagnostics(): Promise<CrashStorageDiagnostics> {
  const persisted = await isPersistentStorageGranted();
  return getStorageDurabilityDiagnostics(persisted);
}

export async function readCrashExportSnapshot(): Promise<CrashExportSnapshot> {
  const tempDb = new Dexie(OPSNORMAL_DB_NAME);
  applyOpsNormalDbSchema(tempDb);

  try {
    const rawEntries = (await tempDb.table('dailyEntries').toArray()) as unknown[];
    const snapshot = sanitizeCrashExportEntries(rawEntries);
    const storageDiagnostics = await readCrashStorageDiagnostics();

    return {
      ...snapshot,
      storageDiagnostics
    };
  } finally {
    tempDb.close();
  }
}

export async function readEntriesForCrashExport(): Promise<DailyEntry[]> {
  const snapshot = await readCrashExportSnapshot();
  return snapshot.entries;
}
