import { useState } from 'react';

import { useInstallPrompt } from './useInstallPrompt';

export function InstallBanner() {
  const { isIOS, isStandalone, canPromptInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isStandalone) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-sm leading-6 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.16em] text-emerald-200 uppercase">
            Install Recommended
          </h2>
          <p className="mt-2 max-w-3xl">
            Install OpsNormal to Home Screen for better offline behavior and more durable local
            storage. This matters most on iPhone and iPad.
          </p>

          {isIOS ? (
            <ol className="mt-3 ml-5 list-decimal space-y-1 text-emerald-50/90">
              <li>Open this page in Safari.</li>
              <li>Press Share.</li>
              <li>Select Add to Home Screen.</li>
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
              Install Now
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
    </section>
  );
}
