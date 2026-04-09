import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getStorageHealth,
  subscribeToStorageDiagnostics,
  type StorageHealth,
  type StorageHealthOptions
} from '../lib/storage';

interface UseStorageHealthResult {
  storageHealth: StorageHealth | null;
  refreshStorageHealth: (options?: StorageHealthOptions) => Promise<StorageHealth>;
  requestStorageProtection: () => Promise<StorageHealth>;
  isRequestingStorageProtection: boolean;
}

export function useStorageHealth(): UseStorageHealthResult {
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [isRequestingStorageProtection, setIsRequestingStorageProtection] = useState(false);
  const requestInFlightRef = useRef(false);

  const refreshStorageHealth = useCallback(async (options: StorageHealthOptions = {}) => {
    const nextHealth = await getStorageHealth(options);
    setStorageHealth(nextHealth);
    return nextHealth;
  }, []);

  const requestStorageProtection = useCallback(async () => {
    if (requestInFlightRef.current) {
      return storageHealth ?? refreshStorageHealth();
    }

    requestInFlightRef.current = true;
    setIsRequestingStorageProtection(true);

    try {
      return await refreshStorageHealth({ requestPersistence: true, allowRepeatRequest: true });
    } finally {
      requestInFlightRef.current = false;
      setIsRequestingStorageProtection(false);
    }
  }, [refreshStorageHealth, storageHealth]);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refreshStorageHealth();
    }, 0);

    function handleForegroundRefresh() {
      void refreshStorageHealth();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        handleForegroundRefresh();
      }
    }

    const unsubscribeDiagnostics = subscribeToStorageDiagnostics(handleForegroundRefresh);
    const intervalId = window.setInterval(handleForegroundRefresh, 5 * 60 * 1000);
    window.addEventListener('focus', handleForegroundRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeDiagnostics();
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStorageHealth]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    // Chromium can transition a shared origin from a tab into a standalone window.
    // iPhone and iPad PWAs launch inside a fresh isolated container, so this listener
    // mainly catches the shared-origin install path rather than the iOS relaunch path.
    const handleDisplayModeChange = () => {
      void refreshStorageHealth();
    };

    if (typeof displayModeQuery.addEventListener === 'function') {
      displayModeQuery.addEventListener('change', handleDisplayModeChange);

      return () => {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      };
    }

    displayModeQuery.addListener(handleDisplayModeChange);

    return () => {
      displayModeQuery.removeListener(handleDisplayModeChange);
    };
  }, [refreshStorageHealth]);

  return {
    storageHealth,
    refreshStorageHealth,
    requestStorageProtection,
    isRequestingStorageProtection
  };
}
