import Dexie, { type EntityTable } from 'dexie';

import { createStorageOperationError, isDatabaseClosedError } from '../lib/storage';
import type { DailyEntry, SectorId, UiStatus } from '../types';
import { applyOpsNormalDbSchema, OPSNORMAL_DB_NAME } from './schema';

const SCHEMA_RELOAD_GUARD_KEY = 'opsnormal-schema-reload-guard';
const SCHEMA_RELOAD_GUARD_WINDOW_MS = 5000;

class OpsNormalDb extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor() {
    super(OPSNORMAL_DB_NAME, { chromeTransactionDurability: 'strict' });
    applyOpsNormalDbSchema(this);
  }
}

export const db = new OpsNormalDb();

let databaseRecoveryRequired = false;
let schemaReloadLoopDetected = false;

export function shouldBlockVersionChangeReload(
  now: number,
  lastReloadAt: number | null,
  windowMs = SCHEMA_RELOAD_GUARD_WINDOW_MS
): boolean {
  return lastReloadAt !== null && now - lastReloadAt < windowMs;
}

function readLastSchemaReloadAt(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SCHEMA_RELOAD_GUARD_KEY);

    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function recordSchemaReloadAt(timestamp: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(SCHEMA_RELOAD_GUARD_KEY, String(timestamp));
  } catch {
    // Ignore sessionStorage access failures during emergency handoff.
  }
}

function clearSchemaReloadGuard(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(SCHEMA_RELOAD_GUARD_KEY);
  } catch {
    // Ignore sessionStorage access failures during normal recovery.
  }
}

db.on('close', () => {
  databaseRecoveryRequired = true;
});

db.on('ready', () => {
  databaseRecoveryRequired = false;
  schemaReloadLoopDetected = false;
  clearSchemaReloadGuard();
});

db.on('versionchange', () => {
  databaseRecoveryRequired = true;

  try {
    db.close();
  } catch {
    // Ignore redundant close failures during version handoff.
  }

  if (typeof window === 'undefined') {
    return;
  }

  const now = Date.now();
  const lastReloadAt = readLastSchemaReloadAt();

  if (shouldBlockVersionChangeReload(now, lastReloadAt)) {
    schemaReloadLoopDetected = true;
    return;
  }

  recordSchemaReloadAt(now);
  window.location.reload();
});

export function isDatabaseRecoveryRequired(): boolean {
  return databaseRecoveryRequired;
}

export async function reopenIfClosed(): Promise<void> {
  if (schemaReloadLoopDetected) {
    throw new Error(
      'Schema upgrade handoff stalled. Close duplicate OpsNormal tabs, reload once, then verify local data before retrying.'
    );
  }

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
