import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { reloadCurrentPage } from '../../lib/runtime';

const UPDATE_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_HANDOFF_TIMEOUT_MS = 4000;

export interface PwaUpdateController {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  handleApplyUpdate: () => void;
  handleDismissBanner: () => void;
  handleReloadPage: () => void;
}

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
}

export function usePwaUpdate(): PwaUpdateController {
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStalled, setUpdateStalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const isMountedRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);

  const clearUpdateTimeout = useCallback(() => {
    if (updateTimeoutRef.current !== null) {
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  const resetTransientState = useCallback(() => {
    clearUpdateTimeout();
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
  }, [clearUpdateTimeout]);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [rawOfflineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      setSwRegistration(registration ?? null);
    }
  });

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearUpdateTimeout();
    };
  }, [clearUpdateTimeout]);

  useEffect(() => {
    if (!swRegistration) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (swRegistration.installing || isNavigatorOffline()) {
        return;
      }

      void swRegistration.update();
    }, UPDATE_REVALIDATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [swRegistration]);

  useEffect(() => {
    if (!needRefresh) {
      clearUpdateTimeout();
    }
  }, [clearUpdateTimeout, needRefresh]);

  const handleApplyUpdate = useCallback(() => {
    resetTransientState();
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(true);

    let handoffTimedOut = false;

    updateTimeoutRef.current = window.setTimeout(() => {
      handoffTimedOut = true;
      updateTimeoutRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

      setIsApplyingUpdate(false);
      setUpdateStalled(true);
    }, UPDATE_HANDOFF_TIMEOUT_MS);

    void updateServiceWorker(true).catch(() => {
      clearUpdateTimeout();

      if (!isMountedRef.current) {
        return;
      }

      setIsApplyingUpdate(false);

      if (!handoffTimedOut) {
        setUpdateStalled(true);
      }
    });
  }, [clearUpdateTimeout, resetTransientState, updateServiceWorker]);

  const handleDismissBanner = useCallback(() => {
    resetTransientState();
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(true);
  }, [resetTransientState, setNeedRefresh, setOfflineReady]);

  const handleReloadPage = useCallback(() => {
    reloadCurrentPage();
  }, []);

  return {
    needRefresh,
    offlineReady: rawOfflineReady && !offlineBannerDismissed,
    isApplyingUpdate: needRefresh ? isApplyingUpdate : false,
    updateStalled: needRefresh ? updateStalled : false,
    handleApplyUpdate,
    handleDismissBanner,
    handleReloadPage
  };
}
