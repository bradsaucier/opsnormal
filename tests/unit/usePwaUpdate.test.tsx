import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: {
    needRefresh: true,
    offlineReady: false
  },
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  registration: {
    installing: null as ServiceWorker | null,
    waiting: {
      postMessage: vi.fn<(message: unknown) => void>()
    },
    update: vi.fn<() => Promise<void>>().mockResolvedValue()
  },
  closeDatabaseForServiceWorkerHandoff: vi.fn(),
  reloadCurrentPage: vi.fn(),
  suppressControllerReload: vi.fn(() => false)
}));

let mockServiceWorkerContainer: EventTarget & { controller: ServiceWorker | null };

vi.mock('../../src/features/pwa/registerSw', async () => {
  const React = await import('react');

  return {
    useRegisterSW: ({ onRegisteredSW }: { onRegisteredSW?: (_swUrl: string, registration?: ServiceWorkerRegistration) => void }) => {
      React.useEffect(() => {
        onRegisteredSW?.('/sw.js', mocks.registration as unknown as ServiceWorkerRegistration);
      }, [onRegisteredSW]);

      return {
        needRefresh: [mocks.state.needRefresh, mocks.setNeedRefresh],
        offlineReady: [mocks.state.offlineReady, mocks.setOfflineReady]
      };
    }
  };
});

vi.mock('../../src/db/appDb', () => ({
  closeDatabaseForServiceWorkerHandoff: mocks.closeDatabaseForServiceWorkerHandoff,
  shouldSuppressControllerReload: mocks.suppressControllerReload
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage
  };
});

import { usePwaUpdate } from '../../src/features/pwa/usePwaUpdate';

const strictWrapper = ({ children }: { children: React.ReactNode }) => React.createElement(React.StrictMode, null, children);

describe('usePwaUpdate', () => {
  beforeEach(() => {
    mockServiceWorkerContainer = Object.assign(new EventTarget(), {
      controller: {} as ServiceWorker
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: mockServiceWorkerContainer
    });

    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.state.needRefresh = true;
    mocks.state.offlineReady = false;
    mocks.registration.installing = null;
    mocks.registration.waiting.postMessage.mockReset();
    mocks.setNeedRefresh.mockReset();
    mocks.setOfflineReady.mockReset();
    mocks.suppressControllerReload.mockReturnValue(false);
  });

  it('posts SKIP_WAITING to the waiting worker and stalls if no controller handoff arrives', () => {
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleApplyUpdate();
    });

    expect(mocks.registration.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(result.current.isApplyingUpdate).toBe(true);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.isApplyingUpdate).toBe(false);
    expect(result.current.updateStalled).toBe(true);
  });

  it('closes Dexie and reloads exactly once when controllerchange fires repeatedly in Strict Mode', () => {
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleApplyUpdate();
    });

    act(() => {
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
    });

    expect(mocks.closeDatabaseForServiceWorkerHandoff).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);

    const closeCallOrder = mocks.closeDatabaseForServiceWorkerHandoff.mock.invocationCallOrder[0]!;
    const reloadCallOrder = mocks.reloadCurrentPage.mock.invocationCallOrder[0]!;

    expect(closeCallOrder).toBeLessThan(reloadCallOrder);
    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
    expect(result.current.updateStalled).toBe(false);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('suppresses controllerchange reload when the schema guard reports a recent handoff', () => {
    mocks.suppressControllerReload.mockReturnValue(true);
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleApplyUpdate();
      mockServiceWorkerContainer.dispatchEvent(new Event('controllerchange'));
    });

    expect(mocks.closeDatabaseForServiceWorkerHandoff).not.toHaveBeenCalled();
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();
  });

  it('re-establishes background revalidation across unmount and remount', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const firstMount = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);

    firstMount.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    expect(setIntervalSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores dismiss while stalled update guidance is pinned', () => {
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleApplyUpdate();
      vi.advanceTimersByTime(4000);
    });

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(result.current.needRefresh).toBe(true);
    expect(result.current.updateStalled).toBe(true);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('resets the transient state when the banner is dismissed before the handoff stalls', () => {
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(mocks.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(mocks.setOfflineReady).toHaveBeenCalledWith(false);
    expect(result.current.updateStalled).toBe(false);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('closes Dexie before the operator-triggered reload path', () => {
    const { result } = renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    act(() => {
      result.current.handleReloadPage();
    });

    expect(mocks.closeDatabaseForServiceWorkerHandoff).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
    expect(mocks.closeDatabaseForServiceWorkerHandoff.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.reloadCurrentPage.mock.invocationCallOrder.at(-1) ?? Number.POSITIVE_INFINITY
    );
  });
});
