import { useEffect, useMemo, useState } from 'react';

import { isIOSDevice, isStandaloneDisplayMode } from '../../lib/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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
      setStandalone(isStandaloneDisplayMode());
    }

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleDisplayModeChange);
    mediaQuery?.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleDisplayModeChange);
      mediaQuery?.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const canPromptInstall = useMemo(() => Boolean(deferredPrompt), [deferredPrompt]);

  async function promptInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return {
    isIOS: isIOSDevice(),
    isStandalone: standalone,
    canPromptInstall,
    promptInstall
  };
}
