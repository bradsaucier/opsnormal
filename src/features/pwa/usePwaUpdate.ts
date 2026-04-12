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
  broadcastPwaUpdateHandoffCleared,
  broadcastPwaUpdateHandoffStalled,
  broadcastPwaUpdateHandoffStarted,
  createPwaUpdateTabId,
  isPwaUpdateCoordinationMessage,
  subscribeToPwaUpdateCoordination
} from './pwaUpdateCoordination';
import {
  CONTROLLER_RELOAD_DELAY_MS,
  CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS,
  EXTERNAL_UPDATE_HANDOFF_DEADMAN_TIMEOUT_MS,
  FOREGROUND_REVALIDATION_THROTTLE_MS,
  UPDATE_HANDOFF_TIMEOUT_MS,
  UPDATE_REVALIDATION_INTERVAL_MS
} from './pwaUpdateConstants';
import type { PwaUpdateController } from './pwaUpdateTypes';
import {
  isNavigatorOffline,
  resolveServiceWorkerRegistration,
  resolveWaitingWorkerForApply
} from './swUpdateRuntime';

// Architecture: ADR-0015 keeps service-worker updates in prompt mode with multi-tab
// coordination, controlled handoff, and post-close reload instead of hot-swapping the UI.
let controllerReloadInFlight = false;

export function usePwaUpdate(): PwaUpdateController {
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStalled, setUpdateStalled] = useState(false);
  const [externalUpdateInProgress, setExternalUpdateInProgress] = useState(false);
  const [externalUpdateStalled, setExternalUpdateStalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [reloadRecoveryRequired, setReloadRecoveryRequired] = useState(() =>
    isControllerReloadRecoveryRequired()
  );
  const isMountedRef = useRef(true);
  const tabIdRef = useRef(createPwaUpdateTabId());
  const updateTimeoutRef = useRef<number | null>(null);
  const externalHandoffTimeoutRef = useRef<number | null>(null);
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

  const clearExternalHandoffTimeout = useCallback(() => {
    if (externalHandoffTimeoutRef.current !== null) {
      window.clearTimeout(externalHandoffTimeoutRef.current);
      externalHandoffTimeoutRef.current = null;
    }
  }, []);

  const clearExternalUpdateState = useCallback(() => {
    clearExternalHandoffTimeout();
    setExternalUpdateInProgress(false);
    setExternalUpdateStalled(false);
  }, [clearExternalHandoffTimeout]);

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

  const surfaceUpdateReady = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    clearExternalUpdateState();
    setReloadRecoveryRequired(false);
    setNeedRefresh(true);
    setOfflineReady(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
  }, [clearExternalUpdateState, setNeedRefresh, setOfflineReady]);

  const pinReloadRecovery = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    clearExternalUpdateState();
    setReloadRecoveryRequired(true);
    setNeedRefresh(true);
    setOfflineReady(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
  }, [clearExternalUpdateState, setNeedRefresh, setOfflineReady]);

  const pinExternalUpdateState = useCallback(
    (stalled: boolean) => {
      if (!isMountedRef.current) {
        return;
      }

      setReloadRecoveryRequired(false);
      setNeedRefresh(true);
      setOfflineReady(false);
      setOfflineBannerDismissed(false);
      setIsApplyingUpdate(false);
      setUpdateStalled(false);
      setExternalUpdateInProgress(!stalled);
      setExternalUpdateStalled(stalled);
    },
    [setNeedRefresh, setOfflineReady]
  );

  const clearBannerState = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
    clearExternalUpdateState();
  }, [clearExternalUpdateState, setNeedRefresh, setOfflineReady]);

  const surfaceWaitingWorker = useCallback(
    (waitingWorker: ServiceWorker, options: { force?: boolean } = {}) => {
      if (!options.force && dismissedWaitingWorkerRef.current === waitingWorker) {
        return;
      }

      dismissedWaitingWorkerRef.current = null;
      surfaceUpdateReady();
    },
    [surfaceUpdateReady]
  );

  const revalidateRegistration = useCallback(
    async (options: { force?: boolean } = {}) => {
      const activeRegistration = await resolveServiceWorkerRegistration(swRegistration);

      if (activeRegistration && activeRegistration !== swRegistration && isMountedRef.current) {
        setSwRegistration(activeRegistration);
      }

      if (!activeRegistration) {
        return;
      }

      const waitingWorker = activeRegistration.waiting;

      if (waitingWorker) {
        surfaceWaitingWorker(waitingWorker, options);
        return;
      }

      if (activeRegistration.installing || isNavigatorOffline()) {
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
        await activeRegistration.update();
      } catch {
        return;
      }

      if (!isMountedRef.current || !activeRegistration.waiting) {
        return;
      }

      surfaceWaitingWorker(activeRegistration.waiting, options);
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
      clearExternalHandoffTimeout();
      controllerReloadInFlight = false;
    };
  }, [clearExternalHandoffTimeout, clearUpdateTimeout]);

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
        surfaceUpdateReady();
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
  }, [revalidateRegistration, surfaceUpdateReady, swRegistration]);

  useEffect(() => {
    const unsubscribe = subscribeToControllerReloadRecovery((event) => {
      if (!isControllerReloadRecoveryMessage(event.data)) {
        return;
      }

      clearControllerReloadState();
      controllerReloadInFlight = false;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();

      if (!isMountedRef.current || (!reloadRecoveryRequired && !updateStalled && !externalUpdateStalled)) {
        return;
      }

      setReloadRecoveryRequired(false);
      clearBannerState();
    });

    return unsubscribe ?? undefined;
  }, [
    clearBannerState,
    clearUpdateTimeout,
    externalUpdateStalled,
    reloadRecoveryRequired,
    updateStalled
  ]);

  useEffect(() => {
    const unsubscribe = subscribeToPwaUpdateCoordination((event) => {
      if (!isPwaUpdateCoordinationMessage(event.data) || event.data.sourceTabId === tabIdRef.current) {
        return;
      }

      controllerReloadInFlight = false;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();
      clearExternalHandoffTimeout();

      switch (event.data.type) {
        case 'update-handoff-started':
          pinExternalUpdateState(false);
          externalHandoffTimeoutRef.current = window.setTimeout(() => {
            clearExternalUpdateState();
            void revalidateRegistration({ force: true });
          }, EXTERNAL_UPDATE_HANDOFF_DEADMAN_TIMEOUT_MS);
          return;
        case 'update-handoff-stalled':
          pinExternalUpdateState(true);
          return;
        case 'update-handoff-cleared':
          clearExternalUpdateState();
          return;
        default:
          return;
      }
    });

    return () => {
      unsubscribe?.();
      clearExternalHandoffTimeout();
    };
  }, [
    clearExternalHandoffTimeout,
    clearExternalUpdateState,
    clearUpdateTimeout,
    pinExternalUpdateState,
    revalidateRegistration
  ]);

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
        broadcastPwaUpdateHandoffStalled(tabIdRef.current, now);
        pinReloadRecovery();
        return;
      }

      controllerReloadInFlight = true;
      syntheticUpdateModeRef.current = false;
      clearUpdateTimeout();

      const automaticReloadCount = recordControllerReloadAttempt(now);

      if (automaticReloadCount >= CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS) {
        controllerReloadInFlight = false;
        broadcastPwaUpdateHandoffStalled(tabIdRef.current, now);
        pinReloadRecovery();
        return;
      }

      broadcastPwaUpdateHandoffCleared(tabIdRef.current, now);
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
  }, [
    clearBannerState,
    clearUpdateTimeout,
    pinReloadRecovery,
    reloadRecoveryRequired,
    scheduleReload
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.MODE !== 'e2e') {
      return;
    }

    window.__opsNormalPwaTestApi__ = {
      markUpdateReady() {
        syntheticForegroundUpdateReadyRef.current = false;
        syntheticUpdateModeRef.current = true;
        controllerReloadInFlight = false;
        surfaceUpdateReady();
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
  }, [surfaceUpdateReady]);

  useEffect(() => {
    if (!needRefresh) {
      clearUpdateTimeout();
    }
  }, [clearUpdateTimeout, needRefresh]);

  const handleApplyUpdate = useCallback(() => {
    resetTransientState();
    clearExternalUpdateState();
    controllerReloadInFlight = false;
    setReloadRecoveryRequired(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(true);

    dismissedWaitingWorkerRef.current = null;
    broadcastPwaUpdateHandoffStarted(tabIdRef.current);

    updateTimeoutRef.current = window.setTimeout(() => {
      updateTimeoutRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

      setIsApplyingUpdate(false);
      setUpdateStalled(true);
      broadcastPwaUpdateHandoffStalled(tabIdRef.current);
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
        broadcastPwaUpdateHandoffStalled(tabIdRef.current);
      }
    })();
  }, [clearExternalUpdateState, clearUpdateTimeout, resetTransientState, swRegistration]);

  const handleDismissBanner = useCallback(() => {
    if (
      reloadRecoveryRequired ||
      externalUpdateInProgress ||
      externalUpdateStalled ||
      (needRefresh && updateStalled)
    ) {
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
  }, [
    externalUpdateInProgress,
    externalUpdateStalled,
    needRefresh,
    reloadRecoveryRequired,
    resetTransientState,
    setNeedRefresh,
    setOfflineReady,
    swRegistration,
    updateStalled
  ]);

  const handleReloadPage = useCallback(() => {
    if (controllerReloadInFlight) {
      return;
    }

    controllerReloadInFlight = true;
    syntheticUpdateModeRef.current = false;
    dismissedWaitingWorkerRef.current = null;
    broadcastPwaUpdateHandoffCleared(tabIdRef.current);
    broadcastControllerReloadRecoveryClear();
    clearControllerReloadState();
    clearUpdateTimeout();
    setReloadRecoveryRequired(false);
    clearBannerState();
    closeDatabaseForServiceWorkerHandoff();
    scheduleReload();
  }, [clearBannerState, clearUpdateTimeout, scheduleReload]);

  return {
    needRefresh:
      needRefresh || reloadRecoveryRequired || externalUpdateInProgress || externalUpdateStalled,
    offlineReady:
      rawOfflineReady &&
      !offlineBannerDismissed &&
      !reloadRecoveryRequired &&
      !externalUpdateInProgress &&
      !externalUpdateStalled,
    isApplyingUpdate:
      needRefresh && !reloadRecoveryRequired && !externalUpdateInProgress && !externalUpdateStalled
        ? isApplyingUpdate
        : false,
    updateStalled:
      needRefresh && !reloadRecoveryRequired && !externalUpdateInProgress && !externalUpdateStalled
        ? updateStalled
        : false,
    reloadRecoveryRequired,
    externalUpdateInProgress,
    externalUpdateStalled,
    handleApplyUpdate,
    handleDismissBanner,
    handleReloadPage
  };
}
