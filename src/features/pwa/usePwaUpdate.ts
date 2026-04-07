import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from './registerSw';

import {
  closeDatabaseForServiceWorkerHandoff,
  shouldSuppressControllerReload
} from '../../db/appDb';
import { reloadCurrentPage } from '../../lib/runtime';

const UPDATE_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_HANDOFF_TIMEOUT_MS = 4000;

let controllerReloadInFlight = false;

declare global {
  interface Window {
    __opsNormalPwaTestApi__?: {
      markUpdateReady: () => void;
      dispatchControllerChange: () => void;
    };
  }
}

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
  const syntheticUpdateModeRef = useRef(false);
  const hadControllerRef = useRef(false);

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
    offlineReady: [rawOfflineReady, setOfflineReady]
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      setSwRegistration(registration ?? null);
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    controllerReloadInFlight = false;

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      hadControllerRef.current = navigator.serviceWorker.controller !== null;
    }

    return () => {
      isMountedRef.current = false;
      clearUpdateTimeout();
      controllerReloadInFlight = false;
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
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = navigator.serviceWorker.controller !== null;
        return;
      }

      if (controllerReloadInFlight || shouldSuppressControllerReload()) {
        return;
      }

      controllerReloadInFlight = true;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();

      closeDatabaseForServiceWorkerHandoff();

      if (!isMountedRef.current) {
        return;
      }

      setNeedRefresh(false);
      setOfflineReady(false);
      setOfflineBannerDismissed(false);
      setIsApplyingUpdate(false);
      setUpdateStalled(false);
      reloadCurrentPage();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [clearUpdateTimeout, setNeedRefresh, setOfflineReady]);

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.MODE !== 'e2e') {
      return;
    }

    window.__opsNormalPwaTestApi__ = {
      markUpdateReady() {
        syntheticUpdateModeRef.current = true;
        controllerReloadInFlight = false;
        setOfflineBannerDismissed(false);
        setNeedRefresh(true);
        setOfflineReady(false);
        setIsApplyingUpdate(false);
        setUpdateStalled(false);
      },
      dispatchControllerChange() {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
          return;
        }

        hadControllerRef.current = true;
        navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      }
    };

    return () => {
      delete window.__opsNormalPwaTestApi__;
    };
  }, [setNeedRefresh, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) {
      clearUpdateTimeout();
    }
  }, [clearUpdateTimeout, needRefresh]);

  const handleApplyUpdate = useCallback(() => {
    resetTransientState();
    controllerReloadInFlight = false;
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(true);

    updateTimeoutRef.current = window.setTimeout(() => {
      updateTimeoutRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

      setIsApplyingUpdate(false);
      setUpdateStalled(true);
    }, UPDATE_HANDOFF_TIMEOUT_MS);

    if (import.meta.env.MODE === 'e2e' && syntheticUpdateModeRef.current) {
      return;
    }

    const waitingWorker = swRegistration?.waiting;

    if (!waitingWorker) {
      return;
    }

    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      clearUpdateTimeout();

      if (!isMountedRef.current) {
        return;
      }

      setIsApplyingUpdate(false);
      setUpdateStalled(true);
    }
  }, [clearUpdateTimeout, resetTransientState, swRegistration]);

  const handleDismissBanner = useCallback(() => {
    if (needRefresh && updateStalled) {
      return;
    }

    syntheticUpdateModeRef.current = false;
    resetTransientState();
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(true);
  }, [needRefresh, resetTransientState, setNeedRefresh, setOfflineReady, updateStalled]);

  const handleReloadPage = useCallback(() => {
    closeDatabaseForServiceWorkerHandoff();
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
