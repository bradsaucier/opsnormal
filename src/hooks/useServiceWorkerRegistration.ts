import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkForServiceWorkerUpdate(
  swUrl: string,
  registration: ServiceWorkerRegistration
): Promise<void> {
  if (registration.installing) {
    return;
  }

  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return;
  }

  try {
    const probeUrl = new URL(swUrl, window.location.href);
    probeUrl.searchParams.set('v', Date.now().toString());

    const response = await fetch(probeUrl.toString(), {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache'
      }
    });

    if (response.ok) {
      await registration.update();
    }
  } catch {
    // Remain silent when the device is offline or the host refuses the probe.
  }
}

export function useServiceWorkerRegistration() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const registrationState = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!swUrl || !registration) {
        return;
      }

      cleanupRef.current?.();

      const runCheck = () => {
        void checkForServiceWorkerUpdate(swUrl, registration);
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          runCheck();
        }
      };

      const intervalId = window.setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);

      window.addEventListener('online', runCheck);
      window.addEventListener('focus', runCheck);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      cleanupRef.current = () => {
        window.clearInterval(intervalId);
        window.removeEventListener('online', runCheck);
        window.removeEventListener('focus', runCheck);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  });

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return registrationState;
}
