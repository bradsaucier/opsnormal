import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useViewportMatch } from '../../src/features/history/useViewportMatch';

type ChangeListener = (event: MediaQueryListEvent) => void;

function installMatchMediaController(
  initialMatches: boolean,
  useLegacyListeners = false,
) {
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(min-width: 48rem)',
    onchange: null,
    addEventListener: useLegacyListeners
      ? undefined
      : vi.fn(
          (eventName: string, listener: EventListenerOrEventListenerObject) => {
            if (eventName === 'change' && typeof listener === 'function') {
              listeners.add(listener as ChangeListener);
            }
          },
        ),
    removeEventListener: useLegacyListeners
      ? undefined
      : vi.fn(
          (eventName: string, listener: EventListenerOrEventListenerObject) => {
            if (eventName === 'change' && typeof listener === 'function') {
              listeners.delete(listener as ChangeListener);
            }
          },
        ),
    addListener: vi.fn((listener: ChangeListener) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: ChangeListener) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    mediaQueryList,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches,
        media: '(min-width: 48rem)',
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe('useViewportMatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks viewport state through matchMedia change events', () => {
    const controller = installMatchMediaController(false);
    const { result } = renderHook(() => useViewportMatch('(min-width: 48rem)'));

    expect(result.current).toBe(false);

    act(() => {
      controller.setMatches(true);
    });

    expect(result.current).toBe(true);
    expect(controller.mediaQueryList.addEventListener.mock.calls).toHaveLength(
      1,
    );
  });

  it('falls back to legacy addListener and removeListener support', () => {
    const controller = installMatchMediaController(false, true);
    const { result, unmount } = renderHook(() =>
      useViewportMatch('(min-width: 48rem)'),
    );

    expect(result.current).toBe(false);

    act(() => {
      controller.setMatches(true);
    });

    expect(result.current).toBe(true);
    expect(controller.mediaQueryList.addListener.mock.calls).toHaveLength(1);

    unmount();

    expect(controller.mediaQueryList.removeListener.mock.calls).toHaveLength(1);
  });
});
