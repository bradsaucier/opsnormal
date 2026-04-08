import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstallPrompt } from '../../src/features/install/useInstallPrompt';

type InstallOutcome = 'accepted' | 'dismissed';

type MockInstallPromptEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

type InstallChoice = { outcome: InstallOutcome; platform: string };

type MediaQueryListener = (event: MediaQueryListEvent) => void;

type DeferredPromise<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
};

function InstallPromptProbe() {
  const { isIOS, isStandalone, canPromptInstall } = useInstallPrompt();

  return (
    <div>
      <span data-testid="ios">{String(isIOS)}</span>
      <span data-testid="standalone">{String(isStandalone)}</span>
      <span data-testid="promptable">{String(canPromptInstall)}</span>
    </div>
  );
}

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent
  });
}

function setNavigatorStandalone(standalone: boolean | undefined) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone
  });
}

function installMatchMediaController(
  initialMatches: boolean,
  options: {
    supportsEventListener?: boolean;
  } = {}
) {
  let matches = initialMatches;
  const listeners = new Set<MediaQueryListener>();
  const supportsEventListener = options.supportsEventListener ?? true;

  const addEventListenerSpy = vi.fn(
    (eventName: string, listener: EventListenerOrEventListenerObject) => {
      if (!supportsEventListener || eventName !== 'change' || typeof listener !== 'function') {
        return;
      }

      listeners.add(listener as MediaQueryListener);
    }
  );

  const removeEventListenerSpy = vi.fn(
    (eventName: string, listener: EventListenerOrEventListenerObject) => {
      if (!supportsEventListener || eventName !== 'change' || typeof listener !== 'function') {
        return;
      }

      listeners.delete(listener as MediaQueryListener);
    }
  );

  const addListenerSpy = vi.fn((listener: MediaQueryListener) => {
    listeners.add(listener);
  });

  const removeListenerSpy = vi.fn((listener: MediaQueryListener) => {
    listeners.delete(listener);
  });

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(display-mode: standalone)',
    onchange: null,
    addEventListener: addEventListenerSpy,
    removeEventListener: removeEventListenerSpy,
    addListener: addListenerSpy,
    removeListener: removeListenerSpy,
    dispatchEvent: vi.fn()
  } as MediaQueryList;

  if (!supportsEventListener) {
    Object.defineProperty(mediaQueryList, 'addEventListener', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(mediaQueryList, 'removeEventListener', {
      configurable: true,
      value: undefined
    });
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      ...mediaQueryList,
      media: query
    }))
  });

  return {
    mediaQueryList,
    addListenerSpy,
    removeListenerSpy,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches,
        media: '(display-mode: standalone)'
      } as MediaQueryListEvent;

      listeners.forEach((listener) => listener(event));
      mediaQueryList.onchange?.(event);
    }
  };
}

function createDeferredPromise<T>(): DeferredPromise<T> {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, rejectFn) => {
    void resolve;
    reject = rejectFn;
  });

  return { promise, reject };
}

function createMockInstallPromptEvent(
  outcome: InstallOutcome = 'accepted',
  options: {
    promptImplementation?: () => Promise<void>;
    userChoice?: Promise<InstallChoice>;
  } = {}
): MockInstallPromptEvent {
  const event = new Event('beforeinstallprompt', {
    bubbles: true,
    cancelable: true
  }) as MockInstallPromptEvent;

  Object.defineProperty(event, 'prompt', {
    configurable: true,
    value: vi.fn().mockImplementation(options.promptImplementation ?? (() => Promise.resolve()))
  });

  Object.defineProperty(event, 'userChoice', {
    configurable: true,
    value: options.userChoice ?? Promise.resolve({ outcome, platform: 'web' })
  });

  return event;
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    setUserAgent('Mozilla/5.0');
    setNavigatorStandalone(undefined);
    installMatchMediaController(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts cleanly when matchMedia is unavailable', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined
    });

    render(<InstallPromptProbe />);

    expect(screen.getByTestId('ios')).toHaveTextContent('true');
    expect(screen.getByTestId('standalone')).toHaveTextContent('false');
    expect(screen.getByTestId('promptable')).toHaveTextContent('false');
  });

  it('starts with no deferred prompt and not-installed state', () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isIOS).toBe(false);
    expect(result.current.isStandalone).toBe(false);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('captures beforeinstallprompt and prevents the default install infobar', () => {
    const event = createMockInstallPromptEvent();
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(result.current.canPromptInstall).toBe(true);
  });

  it('leaves prompt state unchanged when promptInstall is called without a deferred event', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.canPromptInstall).toBe(false);
  });

  it('invokes prompt and clears the deferred event after an accepted install choice', async () => {
    const event = createMockInstallPromptEvent('accepted');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canPromptInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('clears the deferred event after a dismissed install choice', async () => {
    const event = createMockInstallPromptEvent('dismissed');
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canPromptInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('clears the deferred event when prompt execution rejects', async () => {
    const promptError = new Error('gesture lost');
    const event = createMockInstallPromptEvent('accepted', {
      promptImplementation: () => Promise.reject(promptError)
    });
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canPromptInstall).toBe(true);

    await act(async () => {
      await expect(result.current.promptInstall()).rejects.toThrow(promptError);
    });

    expect(result.current.canPromptInstall).toBe(false);
  });

  it('clears the deferred event when the userChoice promise rejects', async () => {
    const choiceError = new Error('choice failed');
    const deferredChoice = createDeferredPromise<InstallChoice>();
    const event = createMockInstallPromptEvent('accepted', {
      userChoice: deferredChoice.promise
    });
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canPromptInstall).toBe(true);

    await act(async () => {
      const promptInstallPromise = result.current.promptInstall();
      deferredChoice.reject(choiceError);
      await expect(promptInstallPromise).rejects.toThrow(choiceError);
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('tracks standalone mode changes from display-mode media queries', () => {
    const matchMediaController = installMatchMediaController(false);
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.isStandalone).toBe(false);

    act(() => {
      matchMediaController.setMatches(true);
    });

    expect(result.current.isStandalone).toBe(true);

    act(() => {
      matchMediaController.setMatches(false);
    });

    expect(result.current.isStandalone).toBe(false);
  });

  it('clears the deferred event when appinstalled transitions the app into standalone mode', () => {
    const matchMediaController = installMatchMediaController(false);
    const event = createMockInstallPromptEvent();
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canPromptInstall).toBe(true);
    expect(result.current.isStandalone).toBe(false);

    act(() => {
      matchMediaController.setMatches(true);
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isStandalone).toBe(true);
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('falls back to legacy media query listeners when addEventListener is unavailable', () => {
    const matchMediaController = installMatchMediaController(false, {
      supportsEventListener: false
    });
    const { result, unmount } = renderHook(() => useInstallPrompt());

    act(() => {
      matchMediaController.setMatches(true);
    });

    expect(result.current.isStandalone).toBe(true);
    expect(matchMediaController.addListenerSpy).toHaveBeenCalledTimes(1);

    unmount();

    expect(matchMediaController.removeListenerSpy).toHaveBeenCalledTimes(1);
  });

  it('removes beforeinstallprompt and appinstalled listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useInstallPrompt());

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function)
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });
});
