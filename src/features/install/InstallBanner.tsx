import { useEffect, useState } from 'react';

import {
  clearInstallBannerDismissal,
  hasDismissedInstallBanner,
  recordInstallBannerDismissal,
} from './installBannerState';
import { useInstallPrompt } from './useInstallPrompt';

const actionButtonClasses =
  'ops-action-button clip-notched ops-notch-chip px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase';

export function InstallBanner() {
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
    <div className="panel-shadow">
      <section className="clip-notched bg-ops-accent-border p-px [--notch:12px]">
        <div className="clip-notched bg-[linear-gradient(180deg,rgba(110,231,183,0.08),rgba(255,255,255,0.02)),var(--color-ops-surface-raised)] p-4 [--notch:11px] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.16em] text-ops-accent-muted uppercase">
                Install the app
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ops-text-secondary">
                Your data stays on this device. Installing improves offline
                reopen behavior and storage durability, especially in Safari on
                macOS and browser tabs on iPhone or iPad.
              </p>

              {isIOS ? (
                <ol className="mt-3 ml-5 list-decimal space-y-1 text-sm leading-6 text-ops-text-secondary">
                  <li>Open this page in Safari.</li>
                  <li>Press Share.</li>
                  <li>Select Install or Add to Home Screen.</li>
                </ol>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              {canPromptInstall ? (
                <button
                  type="button"
                  onClick={() => void promptInstall()}
                  className={`${actionButtonClasses} ops-action-button-success`}
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
                className={`${actionButtonClasses} ops-action-button-subtle`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
