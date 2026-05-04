import { useEffect, useState } from 'react';

import { AlertSurface } from '../../components/AlertSurface';
import {
  clearInstallBannerDismissal,
  hasDismissedInstallBanner,
  recordInstallBannerDismissal,
} from './installBannerState';
import { useInstallPrompt } from './useInstallPrompt';

interface InstallBannerProps {
  compact?: boolean;
}

export function InstallBanner({ compact = false }: InstallBannerProps) {
  const { isIOS, isStandalone, canPromptInstall, promptInstall } =
    useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone) {
      clearInstallBannerDismissal();
    }
  }, [isStandalone]);

  if (isStandalone) {
    return null;
  }

  if (dismissed || hasDismissedInstallBanner()) {
    return null;
  }

  return (
    <AlertSurface
      tone="success"
      title="Install the app"
      description="Your data stays on this device. Installing improves offline reopen behavior and storage durability, especially in Safari on macOS and browser tabs on iPhone or iPad."
      intensity={compact ? 'compact' : 'standard'}
      bodyClassName="text-sm leading-6 text-ops-text-secondary"
      actions={
        <>
          {canPromptInstall ? (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="ops-action-button ops-action-button-sm ops-action-button-emerald"
            >
              Install now
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              recordInstallBannerDismissal();
              setDismissed(true);
            }}
            className="ops-action-button ops-action-button-sm ops-action-button-subtle"
          >
            Dismiss
          </button>
        </>
      }
    >
      {isIOS ? (
        <ol className="ml-5 list-decimal space-y-1">
          <li>Open this page in Safari.</li>
          <li>Press Share.</li>
          <li>Select Install or Add to Home Screen.</li>
        </ol>
      ) : null}
    </AlertSurface>
  );
}
