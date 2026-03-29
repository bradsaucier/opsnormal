import { useCallback, useEffect, useState } from 'react';

import {
  getStorageHealth,
  type StorageHealth,
  type StorageHealthOptions
} from '../lib/storage';

interface UseStorageHealthResult {
  storageHealth: StorageHealth | null;
  refreshStorageHealth: (options?: StorageHealthOptions) => Promise<StorageHealth>;
}

export function useStorageHealth(): UseStorageHealthResult {
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);

  const refreshStorageHealth = useCallback(async (options: StorageHealthOptions = {}) => {
    const nextHealth = await getStorageHealth(options);
    setStorageHealth(nextHealth);
    return nextHealth;
  }, []);

  useEffect(() => {
    void refreshStorageHealth();

    function handleForegroundRefresh() {
      void refreshStorageHealth();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        handleForegroundRefresh();
      }
    }

    const intervalId = window.setInterval(handleForegroundRefresh, 5 * 60 * 1000);
    window.addEventListener('focus', handleForegroundRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleForegroundRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStorageHealth]);

  return {
    storageHealth,
    refreshStorageHealth
  };
}
