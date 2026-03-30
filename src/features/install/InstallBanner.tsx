import { useState } from 'react';

import { useInstallPrompt } from './useInstallPrompt';

export function InstallBanner() {
  const { isIOS, isStandalone, canPromptInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isStandalone) {
    return null;
  }

  return (
    <div className="panel-shadow">
      <section className="clip-notched bg-ops-accent-border p-px [--notch:12px]">
        <div className="clip-notched bg-[linear-gradient(180deg,rgba(110,231,183,0.08),rgba(255,255,255,0.02)),var(--color-ops-surface-1)] p-4 [--notch:11px] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.16em] text-ops-accent-muted uppercase">
                Install the app
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ops-text-secondary">
                Your data stays on this device. Installing improves offline reopen behavior and local
                storage durability, especially on iPhone and iPad.
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
                  className="min-h-11 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-emerald-100 uppercase transition hover:bg-emerald-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                >
                  Install now
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-zinc-200 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-200"
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
