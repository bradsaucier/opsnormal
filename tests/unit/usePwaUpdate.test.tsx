import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

const mocks = vi.hoisted(() => ({
  updateServiceWorker: vi.fn(() => Promise.resolve()),
  reloadCurrentPage: vi.fn(),
  registration: {
    installing: null as ServiceWorker | null,
    update: vi.fn()
  },
  state: {
    needRefresh: true,
    offlineReady: false
  },
  autoRegister: true,
  hasRegistered: false
}));

vi.mock('../../src/features/pwa/registerSw', () => ({
  useRegisterSW: vi.fn((options?: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void }) => {
    const [needRefresh, setNeedRefresh] = React.useState(mocks.state.needRefresh);
    const [offlineReady, setOfflineReady] = React.useState(mocks.state.offlineReady);

    React.useEffect(() => {
      if (mocks.autoRegister && !mocks.hasRegistered) {
        mocks.hasRegistered = true;
        options?.onRegisteredSW?.('/sw.js', mocks.registration as unknown as ServiceWorkerRegistration);
      }
    }, [options]);

    return {
      needRefresh: [needRefresh, setNeedRefresh] as const,
      offlineReady: [offlineReady, setOfflineReady] as const,
      updateServiceWorker: mocks.updateServiceWorker
    };
  })
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage
  };
});

import { usePwaUpdate } from '../../src/features/pwa/usePwaUpdate';

describe('usePwaUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.state.needRefresh = true;
    mocks.state.offlineReady = false;
    mocks.registration.installing = null;
    mocks.autoRegister = true;
    mocks.hasRegistered = false;
    mocks.updateServiceWorker.mockImplementation(() => Promise.resolve());
  });

  it('marks the update as stalled when the handoff timeout expires', () => {
    const { result } = renderHook(() => usePwaUpdate());

    act(() => {
      result.current.handleApplyUpdate();
    });

    expect(result.current.isApplyingUpdate).toBe(true);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.isApplyingUpdate).toBe(false);
    expect(result.current.updateStalled).toBe(true);
  });

  it('keeps the stalled state visible when the update helper rejects after the timeout', async () => {
    let rejectUpdate: ((reason?: unknown) => void) | null = null;

    mocks.updateServiceWorker.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectUpdate = reject;
        })
    );

    const { result } = renderHook(() => usePwaUpdate());

    act(() => {
      result.current.handleApplyUpdate();
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.updateStalled).toBe(true);

    await act(async () => {
      rejectUpdate?.(new Error('handoff failed'));
      await Promise.resolve();
    });

    expect(result.current.isApplyingUpdate).toBe(false);
    expect(result.current.updateStalled).toBe(true);
  });

  it('re-establishes background revalidation after a strict-mode effect replay', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const strictWrapper = ({ children }: { children: React.ReactNode }) => React.createElement(React.StrictMode, null, children);

    renderHook(() => usePwaUpdate(), { wrapper: strictWrapper });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('resets the transient state when the banner is dismissed', () => {
    const { result } = renderHook(() => usePwaUpdate());

    act(() => {
      result.current.handleApplyUpdate();
      vi.advanceTimersByTime(4000);
    });

    act(() => {
      result.current.handleDismissBanner();
    });

    expect(result.current.needRefresh).toBe(false);
    expect(result.current.offlineReady).toBe(false);
    expect(result.current.updateStalled).toBe(false);
    expect(result.current.isApplyingUpdate).toBe(false);
  });

  it('reloads the page through the runtime helper', () => {
    const { result } = renderHook(() => usePwaUpdate());

    act(() => {
      result.current.handleReloadPage();
    });

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });
});
