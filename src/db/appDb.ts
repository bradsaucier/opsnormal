import Dexie, { type EntityTable } from 'dexie';

import {
  createStorageOperationError,
  isDatabaseClosedError,
  recordStorageConnectionDrop,
  recordStorageReconnectFailure,
  recordStorageReconnectSuccess,
  recordStorageWriteVerification
} from '../lib/storage';
import { reloadCurrentPage } from '../lib/runtime';
import type { DailyEntry, SectorId, UiStatus } from '../types';
import { applyOpsNormalDbSchema, OPSNORMAL_DB_NAME } from './schema';

const SCHEMA_RELOAD_GUARD_KEY = 'opsnormal-schema-reload-guard';
const SCHEMA_RELOAD_GUARD_WINDOW_MS = 5000;
const DATABASE_REOPEN_MAX_ATTEMPTS = 3;
const DATABASE_REOPEN_BACKOFF_MS = 150;
const DATABASE_OPEN_TIMEOUT_MS = 1000;
const DATABASE_RELOAD_DELAY_MS = 2000;
const WRITE_VERIFICATION_TIMEOUT_MS = 500;
const SCHEMA_RELOAD_RETRY_BUFFER_MS = 50;

declare global {
  interface Window {
    __opsNormalDbTestApi__?: {
      simulateVersionChange: () => 'reloading' | 'blocked' | 'noop';
      isRecoveryRequired: () => boolean;
    };
  }
}

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
let databaseRecoveryReloadScheduled = false;
let schemaReloadRetryTimeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(
          error instanceof Error
            ? error
            : new Error('Local database operation timed out before a valid failure reason was returned.')
        );
      }
    );
  });
}

function scheduleDatabaseRecoveryReload(): void {
  if (databaseRecoveryReloadScheduled || typeof window === 'undefined') {
    return;
  }

  databaseRecoveryReloadScheduled = true;

  globalThis.setTimeout(() => {
    reloadCurrentPage();
  }, DATABASE_RELOAD_DELAY_MS);
}

function clearDatabaseRecoveryReload(): void {
  databaseRecoveryReloadScheduled = false;
}

function scheduleSchemaReloadRetry(delayMs: number): void {
  if (typeof window === 'undefined' || schemaReloadRetryTimeoutId !== null) {
    return;
  }

  schemaReloadRetryTimeoutId = globalThis.setTimeout(() => {
    schemaReloadRetryTimeoutId = null;
    recordSchemaReloadAt(Date.now());
    reloadCurrentPage();
  }, delayMs);
}

function clearSchemaReloadRetry(): void {
  if (schemaReloadRetryTimeoutId !== null) {
    globalThis.clearTimeout(schemaReloadRetryTimeoutId);
    schemaReloadRetryTimeoutId = null;
  }
}

async function openDatabaseWithTimeout(): Promise<void> {
  await withTimeout(
    db.open(),
    DATABASE_OPEN_TIMEOUT_MS,
    'Local database reopen stalled. Reload initiated to recover the browser storage connection.'
  );
}

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

function recordSchemaReloadAt(timestamp: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.sessionStorage.setItem(SCHEMA_RELOAD_GUARD_KEY, String(timestamp));
    return true;
  } catch {
    return false;
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

function clearDatabaseRecoveryRequirement(): void {
  databaseRecoveryRequired = false;
}


function closeDatabaseConnection(): void {
  databaseRecoveryRequired = true;

  try {
    db.close();
  } catch {
    // Ignore redundant close failures during update or schema handoff.
  }
}

export function closeDatabaseForVersionUpgrade(): void {
  closeDatabaseConnection();
}

export function closeDatabaseForServiceWorkerHandoff(now = Date.now()): void {
  schemaReloadLoopDetected = false;
  clearSchemaReloadRetry();
  closeDatabaseConnection();
  recordSchemaReloadAt(now);
}

export function shouldSuppressControllerReload(now = Date.now()): boolean {
  return shouldBlockVersionChangeReload(now, readLastSchemaReloadAt());
}

async function verifyPersistedDailyStatus(
  date: string,
  sectorId: SectorId,
  expectedStatus: UiStatus,
  expectedUpdatedAt: string | null
): Promise<void> {
  let persistedEntry: DailyEntry | undefined;

  try {
    persistedEntry = await withTimeout(
      db.dailyEntries.where('[date+sectorId]').equals([date, sectorId]).first(),
      WRITE_VERIFICATION_TIMEOUT_MS,
      'Local write verification stalled. Confirm the latest check-in, export now, then reload before continuing.'
    );
  } catch (error) {
    recordStorageWriteVerification('failed');

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      'Local write verification failed. Confirm the latest check-in, export now, then reload before continuing.'
    );
  }

  if (expectedStatus === 'unmarked') {
    if (persistedEntry) {
      recordStorageWriteVerification('mismatch');
      throw new Error(
        'Local write verification failed. Confirm the latest check-in, export now, then reload before continuing.'
      );
    }

    recordStorageWriteVerification('verified');
    return;
  }

  const matchesExpectedWrite =
    persistedEntry?.status === expectedStatus &&
    persistedEntry.updatedAt === expectedUpdatedAt;

  if (!matchesExpectedWrite) {
    recordStorageWriteVerification('mismatch');
    throw new Error(
      'Local write verification failed. Confirm the latest check-in, export now, then reload before continuing.'
    );
  }

  recordStorageWriteVerification('verified');
}

db.on('close', () => {
  databaseRecoveryRequired = true;
  recordStorageConnectionDrop();
});

db.on('ready', () => {
  clearDatabaseRecoveryRequirement();
  schemaReloadLoopDetected = false;
  clearSchemaReloadGuard();
  clearDatabaseRecoveryReload();
  clearSchemaReloadRetry();
});

export function handleDatabaseVersionChange(now = Date.now()): 'reloading' | 'blocked' | 'noop' {
  closeDatabaseForVersionUpgrade();

  if (typeof window === 'undefined') {
    return 'noop';
  }

  const lastReloadAt = readLastSchemaReloadAt();

  if (shouldBlockVersionChangeReload(now, lastReloadAt)) {
    schemaReloadLoopDetected = true;
    clearSchemaReloadRetry();

    if (lastReloadAt !== null) {
      const remainingWindowMs = Math.max(0, SCHEMA_RELOAD_GUARD_WINDOW_MS - (now - lastReloadAt));
      scheduleSchemaReloadRetry(remainingWindowMs + SCHEMA_RELOAD_RETRY_BUFFER_MS);
    } else {
      recordSchemaReloadAt(now);
      reloadCurrentPage();
      return 'reloading';
    }

    return 'blocked';
  }

  schemaReloadLoopDetected = false;
  clearSchemaReloadRetry();
  recordSchemaReloadAt(now);
  reloadCurrentPage();
  return 'reloading';
}

db.on('versionchange', () => {
  handleDatabaseVersionChange();
  return false;
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

  if (db.isOpen() && !databaseRecoveryRequired) {
    return;
  }

  let lastError: unknown;
  const recovering = databaseRecoveryRequired;

  for (let attempt = 0; attempt < DATABASE_REOPEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      if (databaseRecoveryRequired && db.isOpen()) {
        try {
          db.close();
        } catch {
          // Ignore redundant close failures during recovery retry.
        }
      }

      if (!db.isOpen() || databaseRecoveryRequired) {
        await openDatabaseWithTimeout();
      }

      clearDatabaseRecoveryRequirement();
      clearDatabaseRecoveryReload();

      if (recovering) {
        recordStorageReconnectSuccess();
      }

      return;
    } catch (error) {
      lastError = error;
      databaseRecoveryRequired = true;

      try {
        db.close();
      } catch {
        // Ignore redundant close failures during recovery retry.
      }

      if (attempt < DATABASE_REOPEN_MAX_ATTEMPTS - 1) {
        await delay(DATABASE_REOPEN_BACKOFF_MS * (attempt + 1));
      }
    }
  }

  recordStorageReconnectFailure(lastError);
  scheduleDatabaseRecoveryReload();
  throw new Error(
    'Local database connection was interrupted. Recovery reload initiated. Confirm the data view after reload, then export before more edits.'
  );
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
    let savedStatus: UiStatus = status;
    let expectedUpdatedAt: string | null = null;

    await db.transaction('rw', db.dailyEntries, async () => {
      const existing = await db.dailyEntries.where('[date+sectorId]').equals([date, sectorId]).first();

      if (status === 'unmarked') {
        if (existing?.id !== undefined) {
          await db.dailyEntries.delete(existing.id);
        }

        savedStatus = 'unmarked';
        expectedUpdatedAt = null;
        return;
      }

      expectedUpdatedAt = new Date().toISOString();
      const payload: DailyEntry = {
        id: existing?.id,
        date,
        sectorId,
        status,
        updatedAt: expectedUpdatedAt
      };

      await db.dailyEntries.put(payload);
      savedStatus = payload.status;
    });

    await verifyPersistedDailyStatus(date, sectorId, savedStatus, expectedUpdatedAt);

    return savedStatus;
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

if (typeof window !== 'undefined' && import.meta.env.MODE === 'e2e') {
  window.__opsNormalDbTestApi__ = {
    simulateVersionChange() {
      return handleDatabaseVersionChange();
    },
    isRecoveryRequired() {
      return isDatabaseRecoveryRequired();
    }
  };
}
