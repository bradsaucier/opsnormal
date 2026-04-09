export function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
}

function waitForInstallingWorkerToSettle(
  registration: ServiceWorkerRegistration,
  installingWorker: ServiceWorker
): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    const finalize = (worker: ServiceWorker | null) => {
      installingWorker.removeEventListener('statechange', handleStateChange);
      resolve(worker);
    };

    const handleStateChange = () => {
      switch (installingWorker.state) {
        case 'installed':
          finalize(registration.waiting ?? null);
          return;
        case 'redundant':
        case 'activating':
        case 'activated':
          finalize(null);
          return;
        default:
          return;
      }
    };

    if (installingWorker.state === 'installed') {
      finalize(registration.waiting ?? null);
      return;
    }

    if (
      installingWorker.state === 'redundant' ||
      installingWorker.state === 'activating' ||
      installingWorker.state === 'activated'
    ) {
      finalize(null);
      return;
    }

    installingWorker.addEventListener('statechange', handleStateChange);
  });
}

export async function resolveWaitingWorkerForApply(
  registration: ServiceWorkerRegistration | null
): Promise<ServiceWorker | null> {
  if (!registration) {
    return null;
  }

  if (registration.waiting) {
    return registration.waiting;
  }

  if (registration.installing) {
    return waitForInstallingWorkerToSettle(registration, registration.installing);
  }

  try {
    await registration.update();
  } catch {
    return registration.waiting ?? null;
  }

  if (registration.waiting) {
    return registration.waiting;
  }

  if (registration.installing) {
    return waitForInstallingWorkerToSettle(registration, registration.installing);
  }

  return null;
}
