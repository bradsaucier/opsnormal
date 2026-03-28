import Dexie, { type EntityTable } from 'dexie';

import type { DailyEntry, SectorId, UiStatus } from '../types';

class OpsNormalDb extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor() {
    super('opsnormal');
    this.version(1).stores({
      dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
    });
  }
}

export const db = new OpsNormalDb();

export async function setDailyStatus(
  date: string,
  sectorId: SectorId,
  status: UiStatus
): Promise<UiStatus> {
  const existing = await db.dailyEntries.where('[date+sectorId]').equals([date, sectorId]).first();

  if (status === 'unmarked') {
    if (existing?.id !== undefined) {
      await db.dailyEntries.delete(existing.id);
    }

    return 'unmarked';
  }

  const payload: DailyEntry = {
    id: existing?.id,
    date,
    sectorId,
    status,
    updatedAt: new Date().toISOString()
  };

  await db.dailyEntries.put(payload);

  return payload.status;
}

export async function cycleDailyStatus(date: string, sectorId: SectorId): Promise<UiStatus> {
  const existing = await db.dailyEntries.where('[date+sectorId]').equals([date, sectorId]).first();

  if (!existing) {
    return setDailyStatus(date, sectorId, 'nominal');
  }

  if (existing.status === 'nominal') {
    return setDailyStatus(date, sectorId, 'degraded');
  }

  return setDailyStatus(date, sectorId, 'unmarked');
}

export async function getAllEntries(): Promise<DailyEntry[]> {
  return db.dailyEntries.orderBy('date').toArray();
}
