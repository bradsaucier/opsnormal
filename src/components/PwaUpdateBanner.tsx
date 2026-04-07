interface PwaUpdateBannerProps {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  onReload: () => void;
  onDismiss: () => void;
  onReloadPage: () => void;
}

export function PwaUpdateBanner({
  needRefresh,
  offlineReady,
  isApplyingUpdate,
  updateStalled,
  onReload,
  onDismiss,
  onReloadPage
}: PwaUpdateBannerProps) {
  const isBannerActive = needRefresh || offlineReady;
  const showDismissButton = !needRefresh || !updateStalled;

  return (
    <section
      className={isBannerActive
        ? 'rounded-2xl border border-sky-400/20 bg-sky-400/8 p-4 text-sm leading-6 text-sky-100'
        : 'sr-only'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isBannerActive ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-[0.16em] text-sky-200 uppercase">
              {needRefresh ? 'Update Ready' : 'Offline Ready'}
            </h2>
            <p className="mt-2">
              {needRefresh
                ? 'A newer build is available. Apply the update to hand control to the waiting service worker.'
                : 'The service worker is active. OpsNormal can now reopen offline after first load.'}
            </p>
            {needRefresh && updateStalled ? (
              <p className="mt-2 text-sky-50">
                Update handoff did not complete. Another OpsNormal tab may still be holding the active worker. Close the other OpsNormal tabs, reload this tab, confirm the last visible check-in, then apply the update again.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {needRefresh ? (
              <button
                type="button"
                onClick={onReload}
                disabled={isApplyingUpdate}
                className="min-h-11 rounded-lg border border-sky-300/40 bg-sky-300/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-sky-100 uppercase transition hover:bg-sky-300/15 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                {isApplyingUpdate ? 'Applying' : 'Apply update'}
              </button>
            ) : null}
            {needRefresh && updateStalled ? (
              <button
                type="button"
                onClick={onReloadPage}
                className="min-h-11 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-rose-100 uppercase transition hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                Reload tab
              </button>
            ) : null}
            {showDismissButton ? (
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-zinc-200 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-200"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
