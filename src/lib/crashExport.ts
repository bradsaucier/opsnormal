import Dexie from 'dexie';

import { applyOpsNormalDbSchema, OPSNORMAL_DB_NAME } from '../db/schema';
import { DailyEntrySchema } from '../schemas/import';
import type { DailyEntry } from '../types';

export interface CrashExportSnapshot {
  entries: DailyEntry[];
  skippedCount: number;
}

function compareEntries(left: DailyEntry, right: DailyEntry): number {
  const leftKey = `${left.date}:${left.sectorId}`;
  const rightKey = `${right.date}:${right.sectorId}`;
  return leftKey.localeCompare(rightKey);
}

function sanitizeCrashExportEntries(rawEntries: unknown[]): CrashExportSnapshot {
  const entries: DailyEntry[] = [];
  let skippedCount = 0;

  for (const rawEntry of rawEntries) {
    const parsed = DailyEntrySchema.safeParse(rawEntry);

    if (!parsed.success) {
      skippedCount += 1;
      continue;
    }

    entries.push(parsed.data);
  }

  entries.sort(compareEntries);

  return {
    entries,
    skippedCount
  };
}

/**
 * Read all crash-recoverable entries using a fresh, isolated Dexie connection.
 *
 * This function is used only by the crash fallback to export data
 * when the app has faulted. It avoids the main db singleton because
 * that instance may have tainted connection state from the crash.
 *
 * Malformed rows are skipped so recoverable records can still be exported.
 */
export async function readCrashExportSnapshot(): Promise<CrashExportSnapshot> {
  const tempDb = new Dexie(OPSNORMAL_DB_NAME);
  applyOpsNormalDbSchema(tempDb);

  try {
    const rawEntries = (await tempDb.table('dailyEntries').toArray()) as unknown[];
    return sanitizeCrashExportEntries(rawEntries);
  } finally {
    tempDb.close();
  }
}

export async function readEntriesForCrashExport(): Promise<DailyEntry[]> {
  const snapshot = await readCrashExportSnapshot();
  return snapshot.entries;
}
