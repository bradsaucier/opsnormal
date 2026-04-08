import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from './registerSw';

import {
  closeDatabaseForServiceWorkerHandoff,
  shouldSuppressControllerReload
} from '../../db/appDb';
import { reloadCurrentPage } from '../../lib/runtime';

const UPDATE_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_HANDOFF_TIMEOUT_MS = 4000;
const CONTROLLER_RELOAD_WINDOW_MS = 15 * 1000;
const FOREGROUND_REVALIDATION_THROTTLE_MS = 60 * 1000;
const CONTROLLER_RELOAD_COUNT_KEY = 'opsnormal-sw-controller-reload-count';
const CONTROLLER_RELOAD_LAST_AT_KEY = 'opsnormal-sw-controller-reload-last-at';
const CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS = 2;
const CONTROLLER_RELOAD_RECOVERY_CHANNEL_NAME = 'opsnormal-pwa-update-recovery';
const CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE = 'controller-reload-recovery-cleared';
// Best-effort separation from the Dexie close request before forcing navigation.
// This delay reduces same-turn reload churn but is not a formal ordering guarantee.
const CONTROLLER_RELOAD_DELAY_MS = 50;

let controllerReloadInFlight = false;

interface ControllerReloadState {
  count: number;
  lastAt: number | null;
}

interface ControllerReloadRecoveryMessage {
  type: typeof CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE;
}

declare global {
  interface Window {
    __opsNormalPwaTestApi__?: {
      markUpdateReady: () => void;
      queueForegroundUpdateReady: () => void;
      getForegroundRevalidationCount: () => number;
      dispatchControllerChange: () => void;
    };
  }
}

export interface PwaUpdateController {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  reloadRecoveryRequired: boolean;
  handleApplyUpdate: () => void;
  handleDismissBanner: () => void;
  handleReloadPage: () => void;
}

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
}

function readSessionNumber(key: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function readControllerReloadState(now = Date.now()): ControllerReloadState {
  const count = Math.max(0, readSessionNumber(CONTROLLER_RELOAD_COUNT_KEY) ?? 0);
  const lastAt = readSessionNumber(CONTROLLER_RELOAD_LAST_AT_KEY);

  if (lastAt === null || now - lastAt > CONTROLLER_RELOAD_WINDOW_MS) {
    return {
      count: 0,
      lastAt: null
    };
  }

  return {
    count,
    lastAt
  };
}

function writeControllerReloadState(count: number, timestamp: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(CONTROLLER_RELOAD_COUNT_KEY, String(count));
    window.sessionStorage.setItem(CONTROLLER_RELOAD_LAST_AT_KEY, String(timestamp));
  } catch {
    // Ignore sessionStorage access failures during recovery bookkeeping.
  }
}

function clearControllerReloadState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(CONTROLLER_RELOAD_COUNT_KEY);
    window.sessionStorage.removeItem(CONTROLLER_RELOAD_LAST_AT_KEY);
  } catch {
    // Ignore sessionStorage access failures during recovery bookkeeping.
  }
}

function recordControllerReloadAttempt(now = Date.now()): number {
  const currentState = readControllerReloadState(now);
  const nextCount = currentState.lastAt === null ? 1 : currentState.count + 1;
  writeControllerReloadState(nextCount, now);
  return nextCount;
}

function isControllerReloadRecoveryRequired(now = Date.now()): boolean {
  return readControllerReloadState(now).count >= CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS;
}

function createRecoveryBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(CONTROLLER_RELOAD_RECOVERY_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function isControllerReloadRecoveryMessage(value: unknown): value is ControllerReloadRecoveryMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE
  );
}

function broadcastControllerReloadRecoveryClear(): void {
  const channel = createRecoveryBroadcastChannel();

  if (!channel) {
    return;
  }

  try {
    channel.postMessage({ type: CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE } satisfies ControllerReloadRecoveryMessage);
  } catch {
    // Ignore channel delivery failures during manual recovery.
  } finally {
    channel.close();
  }
}

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

  const revalidateRegistration = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!swRegistration) {
        return;
      }

      const surfaceWaitingWorker = (waitingWorker: ServiceWorker): void => {
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
      };

      const waitingWorker = swRegistration.waiting;

      if (waitingWorker) {
        surfaceWaitingWorker(waitingWorker);
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

      surfaceWaitingWorker(swRegistration.waiting);
    },
    [setNeedRefresh, setOfflineReady, swRegistration]
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
  }, [revalidateRegistration, setNeedRefresh, setOfflineReady, swRegistration]);

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
  }, [revalidateRegistration, setNeedRefresh, setOfflineReady, swRegistration]);

  useEffect(() => {
    const channel = createRecoveryBroadcastChannel();

    if (!channel) {
      return;
    }

    const handleRecoveryMessage = (event: MessageEvent<unknown>) => {
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
      setNeedRefresh(false);
      setOfflineReady(false);
      setOfflineBannerDismissed(false);
      setIsApplyingUpdate(false);
      setUpdateStalled(false);
    };

    channel.addEventListener('message', handleRecoveryMessage);

    return () => {
      channel.removeEventListener('message', handleRecoveryMessage);
      channel.close();
    };
  }, [clearUpdateTimeout, reloadRecoveryRequired, setNeedRefresh, setOfflineReady, updateStalled]);

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
      setNeedRefresh(false);
      setOfflineReady(false);
      setOfflineBannerDismissed(false);
      setIsApplyingUpdate(false);
      setUpdateStalled(false);
      scheduleReload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [clearUpdateTimeout, reloadRecoveryRequired, scheduleReload, setNeedRefresh, setOfflineReady]);

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
    setNeedRefresh(false);
    setOfflineReady(false);
    setOfflineBannerDismissed(false);
    setIsApplyingUpdate(false);
    setUpdateStalled(false);
    closeDatabaseForServiceWorkerHandoff();
    scheduleReload();
  }, [clearUpdateTimeout, scheduleReload, setNeedRefresh, setOfflineReady]);

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
