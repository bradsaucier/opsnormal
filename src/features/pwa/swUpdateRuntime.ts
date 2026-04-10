export function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
}

export async function resolveServiceWorkerRegistration(
  currentRegistration: ServiceWorkerRegistration | null
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return currentRegistration;
  }

  if (typeof navigator.serviceWorker.getRegistration !== 'function') {
    return currentRegistration;
  }

  try {
    return (await navigator.serviceWorker.getRegistration()) ?? currentRegistration;
  } catch {
    return currentRegistration;
  }
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
  const activeRegistration = await resolveServiceWorkerRegistration(registration);

  if (!activeRegistration) {
    return null;
  }

  if (activeRegistration.waiting) {
    return activeRegistration.waiting;
  }

  if (activeRegistration.installing) {
    return waitForInstallingWorkerToSettle(activeRegistration, activeRegistration.installing);
  }

  try {
    await activeRegistration.update();
  } catch {
    return activeRegistration.waiting ?? null;
  }

  if (activeRegistration.waiting) {
    return activeRegistration.waiting;
  }

  if (activeRegistration.installing) {
    return waitForInstallingWorkerToSettle(activeRegistration, activeRegistration.installing);
  }

  return null;
}
