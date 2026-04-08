import { useEffect, useMemo, useState } from 'react';

import { isIOSDevice, isStandaloneDisplayMode } from '../../lib/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function subscribeToDisplayModeChanges(
  mediaQuery: MediaQueryList | null,
  listener: () => void
): () => void {
  if (!mediaQuery) {
    return () => undefined;
  }

  if (
    typeof mediaQuery.addEventListener === 'function' &&
    typeof mediaQuery.removeEventListener === 'function'
  ) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }

  if (
    typeof mediaQuery.addListener === 'function' &&
    typeof mediaQuery.removeListener === 'function'
  ) {
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }

  return () => undefined;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(isStandaloneDisplayMode());

  useEffect(() => {
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    function handlePrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleDisplayModeChange() {
      const nextStandalone = isStandaloneDisplayMode();
      setStandalone(nextStandalone);

      if (nextStandalone) {
        setDeferredPrompt(null);
      }
    }

    const unsubscribeDisplayModeChanges = subscribeToDisplayModeChanges(
      mediaQuery,
      handleDisplayModeChange
    );

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleDisplayModeChange);
      unsubscribeDisplayModeChanges();
    };
  }, []);

  const canPromptInstall = useMemo(() => Boolean(deferredPrompt), [deferredPrompt]);

  async function promptInstall() {
    const promptEvent = deferredPrompt;

    if (!promptEvent) {
      return;
    }

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      setDeferredPrompt((current) => (current === promptEvent ? null : current));
    }
  }

  return {
    isIOS: isIOSDevice(),
    isStandalone: standalone,
    canPromptInstall,
    promptInstall
  };
}
