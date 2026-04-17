import { useState } from 'react';
import { useRegisterSW as useVitePwaRegisterSWSentinel } from 'virtual:pwa-register/react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

import { trustedScriptURL } from '../../lib/trustedTypes';

// Architecture: ADR-0015 keeps service-worker registration on the prompt-mode path.
// Do not bypass this wrapper with an auto-apply flow that skips waiting-worker coordination.
// Keep the virtual import in scope so vite-plugin-pwa does not inject registerSW.js,
// which would bypass this Trusted Types aware wrapper.

void useVitePwaRegisterSWSentinel;

const SERVICE_WORKER_TYPE = 'classic';

function resolveServiceWorkerScope(): string {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);

  return baseUrl.pathname;
}

function resolveServiceWorkerScriptUrl(): string {
  return new URL(
    'sw.js',
    new URL(import.meta.env.BASE_URL, window.location.origin),
  ).toString();
}

function registerSW(options: RegisterSWOptions = {}) {
  const {
    immediate = false,
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisteredSW,
    onRegisterError,
  } = options;
  let messageSkipWaiting: (() => void) | undefined;

  const updateServiceWorker = async (): Promise<void> => {
    await registerPromise;
    messageSkipWaiting?.();
  };

  async function register() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const { Workbox } = await import('workbox-window').catch((error) => {
      onRegisterError?.(error);
      return { Workbox: undefined };
    });

    if (!Workbox) {
      return;
    }

    const swScriptUrl = resolveServiceWorkerScriptUrl();
    const trustedSwScriptUrl = trustedScriptURL(
      swScriptUrl,
      'register the OpsNormal service worker script',
    );
    const workbox = new Workbox(trustedSwScriptUrl as unknown as string, {
      scope: resolveServiceWorkerScope(),
      type: SERVICE_WORKER_TYPE,
    });
    let onNeedRefreshCalled = false;

    messageSkipWaiting = () => {
      workbox.messageSkipWaiting();
    };

    const showSkipWaitingPrompt = () => {
      onNeedRefreshCalled = true;
      workbox.addEventListener('controlling', (event) => {
        if (event.isUpdate) {
          window.location.reload();
        }
      });
      onNeedRefresh?.();
    };

    workbox.addEventListener('installed', (event) => {
      if (typeof event.isUpdate === 'undefined') {
        if (typeof event.isExternal !== 'undefined') {
          if (event.isExternal) {
            showSkipWaitingPrompt();
          } else if (!onNeedRefreshCalled) {
            onOfflineReady?.();
          }
        } else if (!onNeedRefreshCalled) {
          onOfflineReady?.();
        }
      } else if (!event.isUpdate) {
        onOfflineReady?.();
      }
    });

    workbox.addEventListener('waiting', showSkipWaitingPrompt);

    await workbox
      .register({ immediate })
      .then((registration) => {
        if (onRegisteredSW) {
          onRegisteredSW(swScriptUrl, registration);
        } else {
          onRegistered?.(registration);
        }
      })
      .catch((error) => {
        onRegisterError?.(error);
      });
  }

  const registerPromise = register();

  return updateServiceWorker;
}

export function useRegisterSW(options: RegisterSWOptions = {}) {
  const {
    immediate = true,
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisteredSW,
    onRegisterError,
  } = options;
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateServiceWorker] = useState(() => {
    return registerSW({
      immediate,
      onOfflineReady() {
        setOfflineReady(true);
        onOfflineReady?.();
      },
      onNeedRefresh() {
        setNeedRefresh(true);
        onNeedRefresh?.();
      },
      onRegistered,
      onRegisteredSW,
      onRegisterError,
    });
  });

  return {
    needRefresh: [needRefresh, setNeedRefresh] as const,
    offlineReady: [offlineReady, setOfflineReady] as const,
    updateServiceWorker,
  };
}
