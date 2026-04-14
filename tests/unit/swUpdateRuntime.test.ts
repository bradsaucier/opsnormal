import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isNavigatorOffline,
  resolveServiceWorkerRegistration,
  resolveWaitingWorkerForApply,
} from '../../src/features/pwa/swUpdateRuntime';

function createMockWorker(state: ServiceWorkerState) {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    state,
    addEventListener: vi.fn((eventName: string, listener: EventListener) => {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }

      listeners.get(eventName)?.add(listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListener) => {
      listeners.get(eventName)?.delete(listener);
    }),
    dispatch(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener(new Event(eventName));
      }
    },
  } as ServiceWorker & { dispatch: (eventName: string) => void };
}

describe('service worker update runtime helpers', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
  });

  it('reflects navigator offline state conservatively', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    expect(isNavigatorOffline()).toBe(true);

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    expect(isNavigatorOffline()).toBe(false);
  });

  it('returns the current registration when service worker lookup is unavailable or fails', async () => {
    const currentRegistration = { waiting: null } as ServiceWorkerRegistration;

    await expect(
      resolveServiceWorkerRegistration(currentRegistration),
    ).resolves.toBe(currentRegistration);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockRejectedValue(new Error('lookup failed')),
      },
    });

    await expect(
      resolveServiceWorkerRegistration(currentRegistration),
    ).resolves.toBe(currentRegistration);
  });

  it('returns the latest service worker registration when lookup succeeds', async () => {
    const currentRegistration = { waiting: null } as ServiceWorkerRegistration;
    const nextRegistration = { waiting: null } as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(nextRegistration),
      },
    });

    await expect(
      resolveServiceWorkerRegistration(currentRegistration),
    ).resolves.toBe(nextRegistration);
  });

  it('returns an existing waiting worker immediately', async () => {
    const waitingWorker = createMockWorker('installed');
    const registration = {
      waiting: waitingWorker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });

    await expect(resolveWaitingWorkerForApply(registration)).resolves.toBe(
      waitingWorker,
    );
  });

  it('waits for an installing worker to settle into waiting', async () => {
    const waitingWorker = createMockWorker('installed');
    const installingWorker = createMockWorker('installing');
    const registration = {
      waiting: null,
      installing: installingWorker,
      update: vi.fn().mockResolvedValue(undefined),
    } as ServiceWorkerRegistration & {
      waiting: ServiceWorker | null;
      installing:
        | (ServiceWorker & { dispatch: (eventName: string) => void })
        | null;
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });

    const waitingPromise = resolveWaitingWorkerForApply(registration);
    registration.waiting = waitingWorker;
    (installingWorker as ServiceWorker & { state: ServiceWorkerState }).state =
      'installed';
    installingWorker.dispatch('statechange');

    await expect(waitingPromise).resolves.toBe(waitingWorker);
  });

  it('falls back to update() and returns null when no waiting worker appears', async () => {
    const registration = {
      waiting: null,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });

    await expect(
      resolveWaitingWorkerForApply(registration),
    ).resolves.toBeNull();
    expect(registration.update.mock.calls).toHaveLength(1);
  });

  it('returns the current waiting worker when update() throws after registration lookup', async () => {
    const waitingWorker = createMockWorker('installed');
    const registration = {
      waiting: waitingWorker,
      installing: null,
      update: vi.fn().mockRejectedValue(new Error('offline update failure')),
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });

    await expect(resolveWaitingWorkerForApply(null)).resolves.toBe(
      waitingWorker,
    );
  });
});
