import Dexie from 'dexie';

import type { DailyEntry } from '../types';

/**
 * Read all entries using a fresh, isolated Dexie connection.
 *
 * This function is used only by the crash fallback to export data
 * when the app has faulted. It avoids the main db singleton because
 * that instance may have tainted connection state from the crash.
 */
export async function readEntriesForCrashExport(): Promise<DailyEntry[]> {
  const tempDb = new Dexie('opsnormal');

  tempDb.version(1).stores({
    dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
  });

  tempDb.version(2).stores({
    dailyEntries: '++id, &[date+sectorId]'
  });

  try {
    return await tempDb.table<DailyEntry>('dailyEntries').orderBy('[date+sectorId]').toArray();
  } finally {
    tempDb.close();
  }
}
