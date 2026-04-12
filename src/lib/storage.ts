// Architecture: ADR-0009, ADR-0017, and ADR-0019 require truthful storage
// diagnostics that favor conservative Safari-family risk language and export-first
// recovery over optimistic browser persistence claims.
const STORAGE_PERSISTENCE_FLAG = 'opsnormal-storage-persistence-attempted';
const STORAGE_PERSISTENCE_CONTEXT_KEY = 'opsnormal-storage-persistence-context';
const STORAGE_DIAGNOSTICS_EVENT = 'opsnormal-storage-diagnostics-changed';
const HIGH_STORAGE_USAGE_THRESHOLD = 0.8;
const PERSISTENT_STORAGE_REQUEST_COOLDOWN_MS = 60 * 1000;

export type StorageReconnectState = 'steady' | 'recovering' | 'failed';
export type StorageWriteVerificationResult =
  | 'unknown'
  | 'verified'
  | 'mismatch'
  | 'failed';

export interface SafariStorageDiagnostics {
  connectionDropsDetected: number;
  reconnectSuccesses: number;
  reconnectFailures: number;
  reconnectState: StorageReconnectState;
  lastReconnectError: string | null;
  persistAttempted: boolean;
  persistGranted: boolean;
  standaloneMode: boolean;
  installRecommended: boolean;
  webKitRisk: boolean;
  lastVerificationResult: StorageWriteVerificationResult;
  lastVerifiedAt: string | null;
}

export interface StorageHealth {
  persisted: boolean;
  persistenceAvailable: boolean;
  estimateAvailable: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  percentUsed: number | null;
  status: 'protected' | 'monitor' | 'warning' | 'unavailable';
  message: string;
  safari: SafariStorageDiagnostics;
}

export interface StorageHealthOptions {
  requestPersistence?: boolean;
  allowRepeatRequest?: boolean;
}

interface PersistentStorageAttemptContext {
  requestedAt: string;
  standaloneMode: boolean;
}

interface ErrorLike {
  name?: string;
  message?: string;
  code?: number;
  inner?: unknown;
  cause?: unknown;
}

const storageDiagnosticsState: Omit<
  SafariStorageDiagnostics,
  'standaloneMode' | 'installRecommended' | 'webKitRisk' | 'persistAttempted' | 'persistGranted'
> = {
  connectionDropsDetected: 0,
  reconnectSuccesses: 0,
  reconnectFailures: 0,
  reconnectState: 'steady',
  lastReconnectError: null,
  lastVerificationResult: 'unknown',
  lastVerifiedAt: null
};

let storageHealthTestOverride: StorageHealth | null = null;

function cloneStorageHealth(storageHealth: StorageHealth): StorageHealth {
  return {
    ...storageHealth,
    safari: {
      ...storageHealth.safari
    }
  };
}

function getStorageManager(): StorageManager | null {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return null;
  }

  return navigator.storage;
}

function emitStorageDiagnosticsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(STORAGE_DIAGNOSTICS_EVENT));
}

function updateStorageDiagnosticsState(
  updater: (current: typeof storageDiagnosticsState) => void
): void {
  updater(storageDiagnosticsState);
  emitStorageDiagnosticsChanged();
}

function readLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage access failures.
  }
}

function getPersistentStorageAttemptContext(): PersistentStorageAttemptContext | null {
  const rawValue = readLocalStorageItem(STORAGE_PERSISTENCE_CONTEXT_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    const requestedAt = candidate.requestedAt;
    const standaloneMode = candidate.standaloneMode;

    if (typeof requestedAt !== 'string' || typeof standaloneMode !== 'boolean') {
      return null;
    }

    if (Number.isNaN(Date.parse(requestedAt))) {
      return null;
    }

    return {
      requestedAt,
      standaloneMode
    };
  } catch {
    return null;
  }
}

function recordPersistentStorageAttempt(): void {
  const attemptContext: PersistentStorageAttemptContext = {
    requestedAt: new Date().toISOString(),
    standaloneMode: isStandaloneDisplayMode()
  };

  writeLocalStorageItem(STORAGE_PERSISTENCE_FLAG, 'true');
  writeLocalStorageItem(STORAGE_PERSISTENCE_CONTEXT_KEY, JSON.stringify(attemptContext));
}

function hasAttemptedPersistentStorageInCurrentContext(): boolean {
  if (!hasAttemptedPersistentStorage()) {
    return false;
  }

  const context = getPersistentStorageAttemptContext();

  if (!context) {
    return false;
  }

  return context.standaloneMode === isStandaloneDisplayMode();
}

function getPersistentStorageRetryCooldownRemainingMs(): number {
  const context = getPersistentStorageAttemptContext();

  if (!context) {
    return 0;
  }

  const requestedAtMs = Date.parse(context.requestedAt);

  if (Number.isNaN(requestedAtMs)) {
    return 0;
  }

  return Math.max(0, PERSISTENT_STORAGE_REQUEST_COOLDOWN_MS - (Date.now() - requestedAtMs));
}

function resolveErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return null;
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

function isDesktopSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isSafari = /safari/i.test(userAgent);
  const isExcluded = /chrome|crios|chromium|android|edg|opr|fxios|firefox/i.test(userAgent);

  return isSafari && !isExcluded && !isIOSDevice();
}

function isStandaloneIOSPwa(): boolean {
  return isIOSDevice() && isStandaloneDisplayMode();
}

export function hasWebKitEvictionRisk(): boolean {
  return isDesktopSafariBrowser() || (isIOSDevice() && !isStandaloneIOSPwa());
}

function usesConservativeProtectionLanguage(persisted: boolean): boolean {
  return persisted && (hasWebKitEvictionRisk() || isStandaloneIOSPwa());
}

function getProtectionSummary(persisted: boolean): string {
  if (!persisted) {
    return 'Protection not granted';
  }

  return usesConservativeProtectionLanguage(persisted)
    ? 'Best-effort protection active'
    : 'Protection active';
}

function buildStorageDiagnostics(persisted = false): SafariStorageDiagnostics {
  const standaloneMode = isStandaloneDisplayMode();
  const webKitRisk = hasWebKitEvictionRisk();

  return {
    ...storageDiagnosticsState,
    persistAttempted: hasAttemptedPersistentStorage(),
    persistGranted: persisted,
    standaloneMode,
    installRecommended: isIOSDevice() && !standaloneMode,
    webKitRisk
  };
}

export function subscribeToStorageDiagnostics(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = () => listener();
  window.addEventListener(STORAGE_DIAGNOSTICS_EVENT, handler);

  return () => {
    window.removeEventListener(STORAGE_DIAGNOSTICS_EVENT, handler);
  };
}

export function getStorageDurabilityDiagnostics(persisted = false): SafariStorageDiagnostics {
  return buildStorageDiagnostics(persisted);
}

export function recordStorageConnectionDrop(): void {
  updateStorageDiagnosticsState((current) => {
    current.connectionDropsDetected += 1;
    current.reconnectState = 'recovering';
    current.lastReconnectError = null;
  });
}

export function recordStorageReconnectSuccess(): void {
  updateStorageDiagnosticsState((current) => {
    current.reconnectSuccesses += 1;
    current.reconnectState = 'steady';
    current.lastReconnectError = null;
  });
}

export function recordStorageReconnectFailure(error: unknown): void {
  updateStorageDiagnosticsState((current) => {
    current.reconnectFailures += 1;
    current.reconnectState = 'failed';
    current.lastReconnectError = resolveErrorMessage(error);
  });
}

export function recordStorageWriteVerification(
  result: Exclude<StorageWriteVerificationResult, 'unknown'>
): void {
  updateStorageDiagnosticsState((current) => {
    current.lastVerificationResult = result;
    current.lastVerifiedAt = new Date().toISOString();
  });
}

export function resetStorageDurabilityDiagnostics(): void {
  storageHealthTestOverride = null;

  updateStorageDiagnosticsState((current) => {
    current.connectionDropsDetected = 0;
    current.reconnectSuccesses = 0;
    current.reconnectFailures = 0;
    current.reconnectState = 'steady';
    current.lastReconnectError = null;
    current.lastVerificationResult = 'unknown';
    current.lastVerifiedAt = null;
  });
}

export function setStorageHealthForTesting(storageHealth: StorageHealth | null): void {
  storageHealthTestOverride = storageHealth ? cloneStorageHealth(storageHealth) : null;
  emitStorageDiagnosticsChanged();
}

export function clearStorageHealthForTesting(): void {
  storageHealthTestOverride = null;
  emitStorageDiagnosticsChanged();
}

export function canUseStorageApi(): boolean {
  return getStorageManager() !== null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storageManager = getStorageManager();

  if (!storageManager?.persist) {
    emitStorageDiagnosticsChanged();
    return false;
  }

  recordPersistentStorageAttempt();
  emitStorageDiagnosticsChanged();

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
  return readLocalStorageItem(STORAGE_PERSISTENCE_FLAG) === 'true';
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
  const standaloneIOSPwa = isStandaloneIOSPwa();
  const webKitEvictionRisk = hasWebKitEvictionRisk();
  const iOSNotInstalledRisk = isIOSDevice() && !standaloneIOSPwa;
  const diagnostics = buildStorageDiagnostics(persisted);

  let status: StorageHealth['status'];
  let message: string;

  if (diagnostics.reconnectState === 'failed') {
    status = 'warning';
    message =
      'Local database reconnection failed. Reload the app, confirm the last visible check-in, and export before further edits.';
  } else if (
    diagnostics.lastVerificationResult === 'mismatch' ||
    diagnostics.lastVerificationResult === 'failed'
  ) {
    status = 'warning';
    message =
      'Recent local write verification failed. Confirm the latest visible check-in, export now, then reload before continuing.';
  } else if (persisted) {
    status = 'protected';

    if (iOSNotInstalledRisk) {
      message =
        'Best-effort storage protection is active, but iPhone and iPad browsers can still evict non-installed app data. Install to Home Screen and export routinely.';
    } else if (standaloneIOSPwa) {
      message =
        'Best-effort storage protection is active. Home Screen mode avoids the standard Safari browser inactivity purge, but local-only data can still be lost to storage pressure or manual clearing. Export routinely.';
    } else if (webKitEvictionRisk) {
      message =
        'Best-effort storage protection is active, but Safari-family browsers can still evict local data. Keep routine exports and verify the installed path when available.';
    } else if (estimateAvailable && usageBytes !== null && quotaBytes !== null) {
      message = `Persistent storage active. ${formatBytes(usageBytes)} used of ${formatBytes(quotaBytes)} quota.`;
    } else {
      message = 'Persistent storage active. Quota telemetry unavailable on this browser.';
    }
  } else if (iOSNotInstalledRisk) {
    status = 'warning';
    message =
      'High-risk storage posture on iPhone or iPad. Browser data can be evicted after inactivity. Install to Home Screen and export routinely.';
  } else if (standaloneIOSPwa) {
    status = 'monitor';

    if (estimateAvailable && usageBytes !== null && quotaBytes !== null) {
      message = `Persistent storage not granted. Home Screen mode reduces Safari inactivity eviction risk. ${formatBytes(usageBytes)} used of ${formatBytes(quotaBytes)} quota. Export routinely.`;
    } else {
      message =
        'Persistent storage not granted. Home Screen mode reduces Safari inactivity eviction risk, but export remains the external backup.';
    }
  } else if (webKitEvictionRisk) {
    status = 'warning';
    message =
      'High-risk storage posture on Safari-family browsers. Local browser data can disappear without backup. Export routinely.';
  } else if (!persistenceAvailable && !estimateAvailable) {
    status = 'unavailable';
    message = 'Storage telemetry unavailable on this browser. Export routinely as the external backup.';
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

  if (diagnostics.reconnectState === 'recovering' && status !== 'warning') {
    status = 'monitor';
    message = 'Recent local database interruption detected. Recovery is in progress. Confirm the latest check-in and export routinely.';
  }

  return {
    persisted,
    persistenceAvailable,
    estimateAvailable,
    usageBytes,
    quotaBytes,
    percentUsed,
    status,
    message,
    safari: diagnostics
  };
}

export async function getStorageHealth(options: StorageHealthOptions = {}): Promise<StorageHealth> {
  if (storageHealthTestOverride) {
    return cloneStorageHealth(storageHealthTestOverride);
  }

  let persisted = await isPersistentStorageGranted();

  const currentContextAttempted = hasAttemptedPersistentStorageInCurrentContext();
  const cooldownRemainingMs = getPersistentStorageRetryCooldownRemainingMs();
  const canRepeatRequest = options.allowRepeatRequest && cooldownRemainingMs === 0;

  if (options.requestPersistence && !persisted && (!currentContextAttempted || canRepeatRequest)) {
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
  const protectionSummary = getProtectionSummary(storageHealth.persisted);
  const reconnectSuffix =
    storageHealth.safari.connectionDropsDetected > 0
      ? ` Session reconnect events: ${storageHealth.safari.connectionDropsDetected}.`
      : '';

  if (storageHealth.usageBytes !== null && storageHealth.quotaBytes !== null) {
    return `${protectionSummary}. ${formatBytes(storageHealth.usageBytes)} used of ${formatBytes(storageHealth.quotaBytes)} quota.${reconnectSuffix}`;
  }

  return `${protectionSummary}. Quota telemetry unavailable.${reconnectSuffix}`;
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
  if (typeof window === 'undefined') {
    return false;
  }

  const matchMediaSupported = typeof window.matchMedia === 'function';
  const displayModeStandalone = matchMediaSupported
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;

  return (
    displayModeStandalone ||
    (typeof navigator !== 'undefined' &&
      'standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isIOSUserAgent = /iphone|ipad|ipod/i.test(userAgent);
  const isMacTouch = /macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return isIOSUserAgent || isMacTouch;
}
