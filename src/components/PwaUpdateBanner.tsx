interface PwaUpdateBannerProps {
  needRefresh: boolean;
  offlineReady: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

export function PwaUpdateBanner({
  needRefresh,
  offlineReady,
  onReload,
  onDismiss
}: PwaUpdateBannerProps) {
  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-sky-400/20 bg-sky-400/8 p-4 text-sm leading-6 text-sky-100"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.16em] text-sky-200 uppercase">
            {needRefresh ? 'Update Ready' : 'Offline Ready'}
          </h2>
          <p className="mt-2">
            {needRefresh
              ? 'A newer build is available. Reload to update the cached app shell.'
              : 'The service worker is active. OpsNormal can now reopen offline after first load.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {needRefresh ? (
            <button
              type="button"
              onClick={onReload}
              className="min-h-11 rounded-lg border border-sky-300/40 bg-sky-300/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-sky-100 uppercase transition hover:bg-sky-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Reload
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-zinc-200 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-200"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
