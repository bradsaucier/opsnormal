const STORAGE_PERSISTENCE_FLAG = 'opsnormal-storage-persistence-attempted';
const HIGH_STORAGE_USAGE_THRESHOLD = 0.8;

export interface StorageHealth {
  persisted: boolean;
  persistenceAvailable: boolean;
  estimateAvailable: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  percentUsed: number | null;
  status: 'protected' | 'monitor' | 'warning' | 'unavailable';
  message: string;
}

export interface StorageHealthOptions {
  requestPersistence?: boolean;
  allowRepeatRequest?: boolean;
}

interface ErrorLike {
  name?: string;
  message?: string;
  code?: number;
  inner?: unknown;
  cause?: unknown;
}

function getStorageManager(): StorageManager | null {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return null;
  }

  return navigator.storage;
}

function recordPersistentStorageAttempt(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_PERSISTENCE_FLAG, 'true');
  } catch {
    // Ignore localStorage access failures.
  }
}

function hasErrorMatch(
  error: unknown,
  predicate: (candidate: ErrorLike) => boolean,
  seen = new Set<unknown>()
): boolean {
  if (!error || typeof error !== 'object' || seen.has(error)) {
    return false;
  }

  seen.add(error);

  const candidate = error as ErrorLike;

  if (predicate(candidate)) {
    return true;
  }

  return (
    hasErrorMatch(candidate.inner, predicate, seen) || hasErrorMatch(candidate.cause, predicate, seen)
  );
}

function resolvePercentUsed(usageBytes: number | null, quotaBytes: number | null): number | null {
  if (usageBytes === null || quotaBytes === null || quotaBytes <= 0) {
    return null;
  }

  return Math.min(usageBytes / quotaBytes, 1);
}

export function canUseStorageApi(): boolean {
  return getStorageManager() !== null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storageManager = getStorageManager();

  if (!storageManager?.persist) {
    return false;
  }

  recordPersistentStorageAttempt();

  try {
    return await storageManager.persist();
  } catch {
    return false;
  }
}

export async function isPersistentStorageGranted(): Promise<boolean> {
  const storageManager = getStorageManager();

  if (!storageManager?.persisted) {
    return false;
  }

  try {
    return await storageManager.persisted();
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  const storageManager = getStorageManager();

  if (!storageManager?.estimate) {
    return null;
  }

  try {
    return await storageManager.estimate();
  } catch {
    return null;
  }
}

export function hasAttemptedPersistentStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(STORAGE_PERSISTENCE_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex] ?? 'TB'}`;
}

export function createStorageHealth(
  estimate: StorageEstimate | null,
  persisted: boolean,
  persistenceAvailable = canUseStorageApi() && typeof getStorageManager()?.persist === 'function'
): StorageHealth {
  const usageBytes = typeof estimate?.usage === 'number' ? estimate.usage : null;
  const quotaBytes = typeof estimate?.quota === 'number' ? estimate.quota : null;
  const percentUsed = resolvePercentUsed(usageBytes, quotaBytes);
  const estimateAvailable = quotaBytes !== null || usageBytes !== null;

  let status: StorageHealth['status'];
  let message: string;

  if (persisted) {
    status = 'protected';

    if (estimateAvailable && usageBytes !== null && quotaBytes !== null) {
      message = `Persistent storage active. ${formatBytes(usageBytes)} used of ${formatBytes(quotaBytes)} quota.`;
    } else {
      message = 'Persistent storage active. Quota telemetry unavailable on this browser.';
    }
  } else if (!persistenceAvailable && !estimateAvailable) {
    status = 'unavailable';
    message = 'Storage durability telemetry unavailable on this browser. Export routinely as the external backup.';
  } else if (percentUsed !== null && percentUsed >= HIGH_STORAGE_USAGE_THRESHOLD) {
    status = 'warning';
    message = `Persistent storage not granted. ${formatBytes(usageBytes ?? 0)} used of ${formatBytes(quotaBytes ?? 0)} quota. Export now.`;
  } else {
    status = 'monitor';

    if (estimateAvailable && usageBytes !== null && quotaBytes !== null) {
      message = `Persistent storage not granted. ${formatBytes(usageBytes)} used of ${formatBytes(quotaBytes)} quota. Export routinely.`;
    } else {
      message = 'Persistent storage not granted. Quota telemetry unavailable. Export routinely as the external backup.';
    }
  }

  return {
    persisted,
    persistenceAvailable,
    estimateAvailable,
    usageBytes,
    quotaBytes,
    percentUsed,
    status,
    message
  };
}

export async function getStorageHealth(options: StorageHealthOptions = {}): Promise<StorageHealth> {
  let persisted = await isPersistentStorageGranted();

  if (
    options.requestPersistence &&
    !persisted &&
    (!hasAttemptedPersistentStorage() || options.allowRepeatRequest)
  ) {
    persisted = await requestPersistentStorage();

    if (!persisted) {
      persisted = await isPersistentStorageGranted();
    }
  }

  const estimate = await estimateStorage();

  return createStorageHealth(estimate, persisted);
}

export function formatStorageHint(estimate: StorageEstimate | null, persisted: boolean): string {
  return createStorageHealth(estimate, persisted).message;
}

export function formatStorageSummary(storageHealth: StorageHealth): string {
  const protectionSummary = storageHealth.persisted ? 'Protection active' : 'Protection not granted';

  if (storageHealth.usageBytes !== null && storageHealth.quotaBytes !== null) {
    return `${protectionSummary}. ${formatBytes(storageHealth.usageBytes)} used of ${formatBytes(storageHealth.quotaBytes)} quota.`;
  }

  return `${protectionSummary}. Quota telemetry unavailable.`;
}

export function isQuotaExceededError(error: unknown): boolean {
  return hasErrorMatch(error, (candidate) => {
    const normalizedName = candidate.name?.toLowerCase() ?? '';
    return (
      normalizedName === 'quotaexceedederror' ||
      candidate.code === 22 ||
      candidate.code === 1014
    );
  });
}

export function isDatabaseClosedError(error: unknown): boolean {
  return hasErrorMatch(error, (candidate) => {
    const normalizedName = candidate.name?.toLowerCase() ?? '';
    const normalizedMessage = candidate.message?.toLowerCase() ?? '';

    return (
      normalizedName === 'databaseclosederror' ||
      normalizedMessage.includes('databaseclosederror') ||
      normalizedMessage.includes('connection to indexed database server lost') ||
      normalizedMessage.includes('database connection is closing') ||
      normalizedMessage.includes('database is closed')
    );
  });
}

export function createStorageOperationError(error: unknown): Error {
  if (isQuotaExceededError(error)) {
    return new Error(
      'Local storage quota reached. Export now, reduce browser storage pressure, then retry.'
    );
  }

  if (isDatabaseClosedError(error)) {
    return new Error(
      'Local database connection was interrupted. Reload the app, confirm the data view, then retry.'
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Local database operation failed. Export your data, then reload the app.');
}

export function isStandaloneDisplayMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof navigator !== 'undefined' &&
      'standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIOSDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
