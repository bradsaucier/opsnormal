import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from './registerSw';

import {
  closeDatabaseForServiceWorkerHandoff,
  shouldSuppressControllerReload
} from '../../db/appDb';
import { reloadCurrentPage } from '../../lib/runtime';
import {
  broadcastControllerReloadRecoveryClear,
  clearControllerReloadState,
  isControllerReloadRecoveryMessage,
  isControllerReloadRecoveryRequired,
  recordControllerReloadAttempt,
  subscribeToControllerReloadRecovery
} from './controllerReloadRecovery';
import {
  CONTROLLER_RELOAD_DELAY_MS,
  CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS,
  FOREGROUND_REVALIDATION_THROTTLE_MS,
  UPDATE_HANDOFF_TIMEOUT_MS,
  UPDATE_REVALIDATION_INTERVAL_MS
} from './pwaUpdateConstants';
import type { PwaUpdateController } from './pwaUpdateTypes';
import { isNavigatorOffline, resolveWaitingWorkerForApply } from './swUpdateRuntime';

let controllerReloadInFlight = false;

export function usePwaUpdate(): PwaUpdateController {
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStalled, setUpdateStalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [reloadRecoveryRequired, setReloadRecoveryRequired] = useState(() =>
    isControllerReloadRecoveryRequired()
  );
  const isMountedRef = useRef(true);
  const updateTimeoutRef = useRef<number | null>(null);
  const syntheticUpdateModeRef = useRef(false);
  const hadControllerRef = useRef(false);
  const lastRegistrationRevalidationAtRef = useRef(0);
  const dismissedWaitingWorkerRef = useRef<ServiceWorker | null>(null);
  const syntheticForegroundUpdateReadyRef = useRef(false);
  const syntheticForegroundRevalidationCountRef = useRef(0);

  const clearUpdateTimeout = useCallback(() => {
    if (updateTimeoutRef.current !== null) {
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  const scheduleReload = useCallback(() => {
    window.setTimeout(() => {
      reloadCurrentPage();
    }, CONTROLLER_RELOAD_DELAY_MS);
  }, []);

  const resetTransientState = useCallback(() => {
    clearUpdateTimeout();
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
  }, [clearUpdateTimeout]);

  const handleRegisteredSW = useCallback(
    (_swUrl: string, registration?: ServiceWorkerRegistration) => {
      setSwRegistration(registration ?? null);
    },
    []
  );

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [rawOfflineReady, setOfflineReady]
  } = useRegisterSW({
    onRegisteredSW: handleRegisteredSW
  });

  const clearBannerState = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
  }, [setNeedRefresh, setOfflineReady]);

  const surfaceWaitingWorker = useCallback(
    (waitingWorker: ServiceWorker, options: { force?: boolean } = {}) => {
      if (!options.force && dismissedWaitingWorkerRef.current === waitingWorker) {
        return;
      }

      dismissedWaitingWorkerRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

      setNeedRefresh(true);
      setOfflineReady(false);
      setOfflineBannerDismissed(false);
    },
    [setNeedRefresh, setOfflineReady]
  );

  const revalidateRegistration = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!swRegistration) {
        return;
      }

      const waitingWorker = swRegistration.waiting;

      if (waitingWorker) {
        surfaceWaitingWorker(waitingWorker, options);
        return;
      }

      if (swRegistration.installing || isNavigatorOffline()) {
        return;
      }

      const now = Date.now();

      if (
        !options.force &&
        now - lastRegistrationRevalidationAtRef.current < FOREGROUND_REVALIDATION_THROTTLE_MS
      ) {
        return;
      }

      lastRegistrationRevalidationAtRef.current = now;

      try {
        await swRegistration.update();
      } catch {
        return;
      }

      if (!isMountedRef.current || !swRegistration.waiting) {
        return;
      }

      surfaceWaitingWorker(swRegistration.waiting, options);
    },
    [surfaceWaitingWorker, swRegistration]
  );

  useEffect(() => {
    isMountedRef.current = true;
    controllerReloadInFlight = false;

    if (isControllerReloadRecoveryRequired()) {
      syntheticUpdateModeRef.current = false;
    }

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

    void revalidateRegistration({ force: true });

    const intervalId = window.setInterval(() => {
      void revalidateRegistration({ force: true });
    }, UPDATE_REVALIDATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [revalidateRegistration, swRegistration]);

  useEffect(() => {
    if (!swRegistration && import.meta.env.MODE !== 'e2e') {
      return;
    }

    const handleForegroundRevalidation = () => {
      if (import.meta.env.MODE === 'e2e' && syntheticForegroundUpdateReadyRef.current) {
        const now = Date.now();

        if (now - lastRegistrationRevalidationAtRef.current < FOREGROUND_REVALIDATION_THROTTLE_MS) {
          return;
        }

        lastRegistrationRevalidationAtRef.current = now;
        syntheticForegroundUpdateReadyRef.current = false;
        syntheticForegroundRevalidationCountRef.current += 1;
        syntheticUpdateModeRef.current = true;
        setNeedRefresh(true);
        setOfflineReady(false);
        setOfflineBannerDismissed(false);
        setIsApplyingUpdate(false);
        setUpdateStalled(false);
        return;
      }

      void revalidateRegistration();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      handleForegroundRevalidation();
    };

    window.addEventListener('focus', handleForegroundRevalidation);
    window.addEventListener('online', handleForegroundRevalidation);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleForegroundRevalidation);
      window.removeEventListener('online', handleForegroundRevalidation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [revalidateRegistration, swRegistration, setNeedRefresh, setOfflineReady]);

  useEffect(() => {
    const unsubscribe = subscribeToControllerReloadRecovery((event) => {
      if (!isControllerReloadRecoveryMessage(event.data)) {
        return;
      }

      clearControllerReloadState();
      controllerReloadInFlight = false;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();

      if (!isMountedRef.current || (!reloadRecoveryRequired && !updateStalled)) {
        return;
      }

      setReloadRecoveryRequired(false);
      clearBannerState();
    });

    return unsubscribe ?? undefined;
  }, [clearBannerState, clearUpdateTimeout, reloadRecoveryRequired, updateStalled]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = navigator.serviceWorker.controller !== null;
        return;
      }

      if (controllerReloadInFlight || reloadRecoveryRequired || shouldSuppressControllerReload()) {
        return;
      }

      const now = Date.now();

      if (isControllerReloadRecoveryRequired(now)) {
        controllerReloadInFlight = false;
        syntheticUpdateModeRef.current = false;
        clearUpdateTimeout();

        if (!isMountedRef.current) {
          return;
        }

        setReloadRecoveryRequired(true);
        setNeedRefresh(true);
        setOfflineReady(false);
        setOfflineBannerDismissed(false);
        setIsApplyingUpdate(false);
        setUpdateStalled(false);
        return;
      }

      controllerReloadInFlight = true;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();

      const automaticReloadCount = recordControllerReloadAttempt(now);

      if (automaticReloadCount >= CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS) {
        controllerReloadInFlight = false;

        if (!isMountedRef.current) {
          return;
        }

        setReloadRecoveryRequired(true);
        setNeedRefresh(true);
        setOfflineReady(false);
        setOfflineBannerDismissed(false);
        setIsApplyingUpdate(false);
        setUpdateStalled(false);
        return;
      }

      closeDatabaseForServiceWorkerHandoff(now);

      if (!isMountedRef.current) {
        return;
      }

      setReloadRecoveryRequired(false);
      clearBannerState();
      scheduleReload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [clearBannerState, clearUpdateTimeout, reloadRecoveryRequired, scheduleReload, setNeedRefresh, setOfflineReady]);

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.MODE !== 'e2e') {
      return;
    }

    window.__opsNormalPwaTestApi__ = {
      markUpdateReady() {
        syntheticForegroundUpdateReadyRef.current = false;
        syntheticUpdateModeRef.current = true;
        controllerReloadInFlight = false;
        setReloadRecoveryRequired(false);
        setOfflineBannerDismissed(false);
        setNeedRefresh(true);
        setOfflineReady(false);
        setIsApplyingUpdate(false);
        setUpdateStalled(false);
      },
      queueForegroundUpdateReady() {
        syntheticForegroundUpdateReadyRef.current = true;
      },
      getForegroundRevalidationCount() {
        return syntheticForegroundRevalidationCountRef.current;
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
    setReloadRecoveryRequired(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(true);

    dismissedWaitingWorkerRef.current = null;

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

    void (async () => {
      const waitingWorker = await resolveWaitingWorkerForApply(swRegistration);

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
    })();
  }, [clearUpdateTimeout, resetTransientState, swRegistration]);

  const handleDismissBanner = useCallback(() => {
    if (reloadRecoveryRequired || (needRefresh && updateStalled)) {
      return;
    }

    syntheticUpdateModeRef.current = false;

    if (needRefresh && swRegistration?.waiting) {
      dismissedWaitingWorkerRef.current = swRegistration.waiting;
    }

    resetTransientState();
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(true);
  }, [needRefresh, reloadRecoveryRequired, resetTransientState, setNeedRefresh, setOfflineReady, swRegistration, updateStalled]);

  const handleReloadPage = useCallback(() => {
    if (controllerReloadInFlight) {
      return;
    }

    controllerReloadInFlight = true;
    syntheticUpdateModeRef.current = false;
    dismissedWaitingWorkerRef.current = null;
    broadcastControllerReloadRecoveryClear();
    clearControllerReloadState();
    clearUpdateTimeout();
    setReloadRecoveryRequired(false);
    clearBannerState();
    closeDatabaseForServiceWorkerHandoff();
    scheduleReload();
  }, [clearBannerState, clearUpdateTimeout, scheduleReload]);

  return {
    needRefresh: needRefresh || reloadRecoveryRequired,
    offlineReady: rawOfflineReady && !offlineBannerDismissed && !reloadRecoveryRequired,
    isApplyingUpdate: needRefresh && !reloadRecoveryRequired ? isApplyingUpdate : false,
    updateStalled: needRefresh && !reloadRecoveryRequired ? updateStalled : false,
    reloadRecoveryRequired,
    handleApplyUpdate,
    handleDismissBanner,
    handleReloadPage
  };
}
