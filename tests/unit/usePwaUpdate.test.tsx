import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXTERNAL_UPDATE_HANDOFF_DEADMAN_TIMEOUT_MS,
  FOREGROUND_REVALIDATION_THROTTLE_MS,
  UPDATE_HANDOFF_TIMEOUT_MS,
} from '../../src/features/pwa/pwaUpdateConstants';

const mocks = vi.hoisted(() => ({
  state: {
    needRefresh: true,
    offlineReady: false,
  },
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  registration: {
    installing: null as ServiceWorker | null,
    waiting: {
      postMessage: vi.fn<(message: unknown) => void>(),
    } as {
      postMessage: ReturnType<typeof vi.fn<(message: unknown) => void>>;
    } | null,
    update: vi.fn<() => Promise<void>>().mockResolvedValue(),
  },
  getRegistration: vi
    .fn<() => Promise<ServiceWorkerRegistration | null>>()
    .mockResolvedValue(null as ServiceWorkerRegistration | null),
  closeDatabaseForServiceWorkerHandoff: vi.fn(),
  reloadCurrentPage: vi.fn(),
  suppressControllerReload: vi.fn(() => false),
}));

let mockServiceWorkerContainer: EventTarget & {
  controller: ServiceWorker | null;
  getRegistration: () => Promise<ServiceWorkerRegistration | null>;
};

class MockBroadcastChannel extends EventTarget {
  static instances: MockBroadcastChannel[] = [];

  readonly name: string;
  closed = false;

  constructor(name: string) {
    super();
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    for (const instance of MockBroadcastChannel.instances) {
      if (instance === this || instance.closed || instance.name !== this.name) {
        continue;
      }

      const event = new Event('message') as MessageEvent<unknown>;
      Object.defineProperty(event, 'data', { value: message });
      instance.dispatchEvent(event);
    }
  }

  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter(
      (instance) => instance !== this,
    );
  }
}

vi.mock('../../src/features/pwa/registerSw', async () => {
  const React = await import('react');

  return {
    useRegisterSW: ({
      onRegisteredSW,
    }: {
      onRegisteredSW?: (
        _swUrl: string,
        registration?: ServiceWorkerRegistration,
      ) => void;
    }) => {
      React.useEffect(() => {
        onRegisteredSW?.(
          '/sw.js',
          mocks.registration as unknown as ServiceWorkerRegistration,
        );
      }, [onRegisteredSW]);

      return {
        needRefresh: [mocks.state.needRefresh, mocks.setNeedRefresh],
        offlineReady: [mocks.state.offlineReady, mocks.setOfflineReady],
      };
    },
  };
});

vi.mock('../../src/db/appDb', () => ({
  closeDatabaseForServiceWorkerHandoff:
    mocks.closeDatabaseForServiceWorkerHandoff,
  shouldSuppressControllerReload: mocks.suppressControllerReload,
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage,
  };
});

import { usePwaUpdate } from '../../src/features/pwa/usePwaUpdate';

const strictWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.StrictMode, null, children);

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceClock(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePwaUpdate', () => {
  beforeEach(() => {
    mockServiceWorkerContainer = Object.assign(new EventTarget(), {
      controller: {} as ServiceWorker,
      getRegistration: mocks.getRegistration,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: mockServiceWorkerContainer,
    });

    Object.defineProperty(window, 'BroadcastChannel', {
      configurable: true,
      value: MockBroadcastChannel,
    });

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    MockBroadcastChannel.instances = [];
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
    vi.clearAllMocks();

    mocks.state.needRefresh = true;
    mocks.state.offlineReady = false;
    mocks.registration.installing = null;
    mocks.registration.waiting = {
      postMessage: vi.fn<(message: unknown) => void>(),
    };
    mocks.registration.update.mockResolvedValue();
    mocks.getRegistration.mockResolvedValue(
      mocks.registration as unknown as ServiceWorkerRegistration,
    );
    mocks.setNeedRefresh.mockReset();
    mocks.setOfflineReady.mockReset();
    mocks.suppressControllerReload.mockReturnValue(false);
  });

  it('surfaces a waiting worker immediately when registration already carries one', async () => {
    mocks.state.needRefresh = false;
    mocks.state.offlineReady = true;

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });
    await settle();

    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(true);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('revalidates on focus after the foreground throttle window expires', async () => {
    mocks.state.needRefresh = false;
    mocks.registration.waiting = null;

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });
    await settle();

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);

    mocks.registration.update.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(FOREGROUND_REVALIDATION_THROTTLE_MS + 1);
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated foreground events into one revalidation inside the throttle window', async () => {
    mocks.state.needRefresh = false;
    mocks.registration.waiting = null;

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });
    await settle();

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);

    mocks.registration.update.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(FOREGROUND_REVALIDATION_THROTTLE_MS + 1);

      for (let attempt = 0; attempt < 50; attempt += 1) {
        window.dispatchEvent(new Event('focus'));
      }

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);
  });

  it('does not re-surface the same waiting worker on foreground return after dismissal inside the same session', async () => {
    mocks.state.needRefresh = true;
    mocks.state.offlineReady = false;

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(true);

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);

    await act(async () => {
      vi.advanceTimersByTime(FOREGROUND_REVALIDATION_THROTTLE_MS + 1);
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const resurfaceCalls = mocks.setNeedRefresh.mock.calls.filter(
      ([value]) => value === true,
    );
    expect(resurfaceCalls).toHaveLength(1);
  });

  it('skips foreground revalidation while offline without consuming the next online check', async () => {
    mocks.state.needRefresh = false;
    mocks.registration.waiting = null;

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });
    await settle();

    expect(mocks.registration.update).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(FOREGROUND_REVALIDATION_THROTTLE_MS + 1);
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(0);

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);
  });

  it('posts SKIP_WAITING to the waiting worker and stalls if no controller handoff arrives', async () => {
    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.waiting?.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });

    await advanceClock(UPDATE_HANDOFF_TIMEOUT_MS);

    expect(result.current.isApplyingUpdate).toBe(false);
    expect(result.current.updateStalled).toBe(true);
  });

  it('waits for an installing worker to reach installed before posting SKIP_WAITING', async () => {
    const recoveredWaitingWorker = {
      postMessage: vi.fn<(message: unknown) => void>(),
    };

    const installingWorker = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    }) as ServiceWorker;

    mocks.registration.waiting = null;
    mocks.registration.installing = installingWorker;

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isApplyingUpdate).toBe(true);
    expect(recoveredWaitingWorker.postMessage).not.toHaveBeenCalled();

    await act(async () => {
      Object.assign(installingWorker, {
        state: 'installed' satisfies ServiceWorkerState,
      });
      mocks.registration.installing = null;
      mocks.registration.waiting = recoveredWaitingWorker;
      installingWorker.dispatchEvent(new Event('statechange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).not.toHaveBeenCalled();
    expect(recoveredWaitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(result.current.updateStalled).toBe(false);
  });

  it('forces one registration revalidation if the waiting worker disappears before apply and then waits for install completion', async () => {
    const recoveredWaitingWorker = {
      postMessage: vi.fn<(message: unknown) => void>(),
    };
    const installingWorker = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    }) as ServiceWorker;

    mocks.registration.waiting = null;
    mocks.registration.update.mockImplementationOnce(() => {
      mocks.registration.installing = installingWorker;
      return Promise.resolve();
    });

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);
    expect(result.current.isApplyingUpdate).toBe(true);
    expect(recoveredWaitingWorker.postMessage).not.toHaveBeenCalled();

    await act(async () => {
      Object.assign(installingWorker, {
        state: 'installed' satisfies ServiceWorkerState,
      });
      mocks.registration.installing = null;
      mocks.registration.waiting = recoveredWaitingWorker;
      installingWorker.dispatchEvent(new Event('statechange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recoveredWaitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
    expect(result.current.updateStalled).toBe(false);
  });

  it('keeps the handoff timeout active when apply cannot reacquire a waiting worker', async () => {
    mocks.registration.waiting = null;

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);

    mocks.registration.update.mockClear();
    mocks.getRegistration.mockResolvedValueOnce(
      mocks.registration as unknown as ServiceWorkerRegistration,
    );

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.registration.update).toHaveBeenCalledTimes(1);
    expect(result.current.isApplyingUpdate).toBe(true);
    expect(result.current.updateStalled).toBe(false);

    await advanceClock(UPDATE_HANDOFF_TIMEOUT_MS);

    expect(result.current.isApplyingUpdate).toBe(false);
    expect(result.current.updateStalled).toBe(true);
  });

  it('surfaces coordinated update-in-progress guidance in a second tab when another tab starts apply', async () => {
    const primaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    const secondaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await settle();

    await act(async () => {
      void primaryTab.result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(primaryTab.result.current.isApplyingUpdate).toBe(true);
    expect(secondaryTab.result.current.externalUpdateInProgress).toBe(true);
    expect(secondaryTab.result.current.externalUpdateStalled).toBe(false);
    expect(secondaryTab.result.current.isApplyingUpdate).toBe(false);
  });

  it('pins coordinated recovery in a second tab when the initiating tab stalls', async () => {
    const primaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    const secondaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await settle();

    await act(async () => {
      void primaryTab.result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    await advanceClock(UPDATE_HANDOFF_TIMEOUT_MS);

    expect(primaryTab.result.current.updateStalled).toBe(true);
    expect(secondaryTab.result.current.externalUpdateInProgress).toBe(false);
    expect(secondaryTab.result.current.externalUpdateStalled).toBe(true);
  });

  it('breaks a stale external handoff lock after the dead-man timeout and clears the in-progress flag', async () => {
    const primaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    const secondaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await settle();
    mocks.registration.update.mockClear();

    await act(async () => {
      void primaryTab.result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(secondaryTab.result.current.externalUpdateInProgress).toBe(true);
    expect(secondaryTab.result.current.externalUpdateStalled).toBe(false);

    await advanceClock(EXTERNAL_UPDATE_HANDOFF_DEADMAN_TIMEOUT_MS);

    expect(secondaryTab.result.current.externalUpdateInProgress).toBe(false);
  });

  it('closes Dexie and reloads exactly once when controllerchange fires repeatedly in Strict Mode', async () => {
    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      vi.advanceTimersByTime(50);
    });

    expect(mocks.closeDatabaseForServiceWorkerHandoff).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);

    const closeCallOrder =
      mocks.closeDatabaseForServiceWorkerHandoff.mock.invocationCallOrder[0]!;
    const reloadCallOrder =
      mocks.reloadCurrentPage.mock.invocationCallOrder[0]!;

    expect(closeCallOrder).toBeLessThan(reloadCallOrder);
    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
    expect(result.current.updateStalled).toBe(false);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('suppresses controllerchange reload when the schema guard reports a recent handoff', async () => {
    mocks.suppressControllerReload.mockReturnValue(true);
    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      vi.advanceTimersByTime(50);
    });

    expect(mocks.closeDatabaseForServiceWorkerHandoff).not.toHaveBeenCalled();
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();
  });

  it('preserves loop-breaker session markers on mount', async () => {
    window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
    window.sessionStorage.setItem(
      'opsnormal-sw-controller-reload-last-at',
      String(Date.now()),
    );

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-count'),
    ).toBe('2');
    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-last-at'),
    ).not.toBeNull();
    expect(result.current.needRefresh).toBe(true);
    expect(result.current.offlineReady).toBe(false);
  });

  it('clears the loop-breaker session state before the operator-triggered reload path', async () => {
    window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
    window.sessionStorage.setItem(
      'opsnormal-sw-controller-reload-last-at',
      String(Date.now()),
    );

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    act(() => {
      result.current.handleReloadPage();
    });

    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-count'),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-last-at'),
    ).toBeNull();
    expect(mocks.closeDatabaseForServiceWorkerHandoff).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();

    await advanceClock(50);

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
    expect(
      mocks.closeDatabaseForServiceWorkerHandoff.mock.invocationCallOrder.at(
        -1,
      ),
    ).toBeLessThan(
      mocks.reloadCurrentPage.mock.invocationCallOrder.at(-1) ??
        Number.POSITIVE_INFINITY,
    );
  });

  it('resets expired loop-breaker state instead of pinning recovery outside the active window', async () => {
    const now = Date.now();
    window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
    window.sessionStorage.setItem(
      'opsnormal-sw-controller-reload-last-at',
      String(now - 15001),
    );

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    expect(result.current.reloadRecoveryRequired).toBe(false);

    act(() => {
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
    });

    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-count'),
    ).toBe('1');
    expect(mocks.closeDatabaseForServiceWorkerHandoff).toHaveBeenCalledTimes(1);

    await advanceClock(50);

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });

  it('broadcasts recovery clear so a second tab does not stay pinned after manual recovery starts', async () => {
    window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
    window.sessionStorage.setItem(
      'opsnormal-sw-controller-reload-last-at',
      String(Date.now()),
    );

    const primaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    const secondaryTab = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    act(() => {
      primaryTab.result.current.handleReloadPage();
    });

    expect(
      window.sessionStorage.getItem('opsnormal-sw-controller-reload-count'),
    ).toBeNull();
    expect(secondaryTab.result.current.reloadRecoveryRequired).toBe(false);
    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('cleans up the recovery BroadcastChannel across Strict Mode remounts', () => {
    expect(MockBroadcastChannel.instances).toHaveLength(0);

    const mounted = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    expect(MockBroadcastChannel.instances).toHaveLength(2);

    mounted.unmount();

    expect(MockBroadcastChannel.instances).toHaveLength(0);
  });

  it('re-establishes background revalidation across unmount and remount', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const firstMount = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000,
    );

    firstMount.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });
    await settle();

    expect(setIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores dismiss while stalled update guidance is pinned', async () => {
    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });

    await act(async () => {
      void result.current.handleApplyUpdate();
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(UPDATE_HANDOFF_TIMEOUT_MS);
      await Promise.resolve();
    });

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(result.current.needRefresh).toBe(true);
    expect(result.current.updateStalled).toBe(true);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('does not clear loop-breaker session markers on dismiss', async () => {
    const countKey = 'opsnormal-sw-controller-reload-count';
    const lastAtKey = 'opsnormal-sw-controller-reload-last-at';

    window.sessionStorage.setItem(countKey, '2');
    window.sessionStorage.setItem(lastAtKey, String(Date.now()));

    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    const countBefore = window.sessionStorage.getItem(countKey);
    const lastAtBefore = window.sessionStorage.getItem(lastAtKey);

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(window.sessionStorage.getItem(countKey)).toBe(countBefore);
    expect(window.sessionStorage.getItem(lastAtKey)).toBe(lastAtBefore);
  });

  it('resets the transient state when the banner is dismissed before the handoff stalls', async () => {
    const { result } = renderHook(() => usePwaUpdate(), {
      wrapper: strictWrapper,
    });
    await settle();

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
    expect(result.current.updateStalled).toBe(false);
    expect(result.current.isApplyingUpdate).toBe(false);
  });
});
