import Dexie, { type EntityTable } from 'dexie';

import { createStorageOperationError, isDatabaseClosedError } from '../lib/storage';
import type { DailyEntry, SectorId, UiStatus } from '../types';

class OpsNormalDb extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor() {
    super('opsnormal');
    this.version(1).stores({
      dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
    });
    this.version(2).stores({
      dailyEntries: '++id, &[date+sectorId]'
    });
  }
}

export const db = new OpsNormalDb();

let databaseRecoveryRequired = false;

db.on('close', () => {
  databaseRecoveryRequired = true;
});

db.on('ready', () => {
  databaseRecoveryRequired = false;
});

export function isDatabaseRecoveryRequired(): boolean {
  return databaseRecoveryRequired;
}

export async function reopenIfClosed(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }

  databaseRecoveryRequired = false;
}

async function runDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    if (databaseRecoveryRequired || !db.isOpen()) {
      await reopenIfClosed();
    }

    return await operation();
  } catch (error) {
    if (isDatabaseClosedError(error)) {
      await reopenIfClosed();

      try {
        return await operation();
      } catch (retryError) {
        throw createStorageOperationError(retryError);
      }
    }

    throw createStorageOperationError(error);
  }
}

export async function runDatabaseWrite<T>(operation: () => Promise<T>): Promise<T> {
  return runDatabaseOperation(operation);
}

export async function setDailyStatus(
  date: string,
  sectorId: SectorId,
  status: UiStatus
): Promise<UiStatus> {
  return runDatabaseWrite(async () => {
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
  });
}

export async function cycleDailyStatus(date: string, sectorId: SectorId): Promise<UiStatus> {
  return runDatabaseOperation(async () => {
    const existing = await db.dailyEntries.where('[date+sectorId]').equals([date, sectorId]).first();

    if (!existing) {
      return setDailyStatus(date, sectorId, 'nominal');
    }

    if (existing.status === 'nominal') {
      return setDailyStatus(date, sectorId, 'degraded');
    }

    return setDailyStatus(date, sectorId, 'unmarked');
  });
}

export async function getAllEntries(): Promise<DailyEntry[]> {
  return runDatabaseOperation(async () => db.dailyEntries.orderBy('[date+sectorId]').toArray());
}
