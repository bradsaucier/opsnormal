const STORAGE_PERSISTENCE_FLAG = 'opsnormal-storage-persistence-attempted';

function canUseStorageApi(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!canUseStorageApi() || !navigator.storage.persist) {
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    window.localStorage.setItem(STORAGE_PERSISTENCE_FLAG, 'true');
    return persisted;
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (!canUseStorageApi() || !navigator.storage.estimate) {
    return null;
  }

  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}

export function hasAttemptedPersistentStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STORAGE_PERSISTENCE_FLAG) === 'true';
}

export function formatStorageHint(estimate: StorageEstimate | null, persisted: boolean): string {
  if (persisted) {
    return 'Persistent storage granted. Local data is less likely to be evicted by browser cleanup.';
  }

  if (!estimate?.quota) {
    return 'Persistent storage status unavailable on this browser. Export routinely as an external backup.';
  }

  const quotaMegabytes = Math.max(1, Math.round(estimate.quota / (1024 * 1024)));
  const usageRatio =
    estimate.usage && estimate.quota ? Math.min(estimate.usage / estimate.quota, 1) : 0;

  if (usageRatio >= 0.8) {
    return `Persistent storage not granted. Local quota is ${quotaMegabytes} MB and current usage is elevated. Export now.`;
  }

  return `Persistent storage not granted. Estimated local quota: ${quotaMegabytes} MB. Export routinely as an external backup.`;
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
