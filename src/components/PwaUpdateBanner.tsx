import { useEffect, useState } from 'react';

import { derivePwaUpdateBannerViewModel } from '../features/pwa/pwaUpdateBannerModel';

interface PwaUpdateBannerProps {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  reloadRecoveryRequired: boolean;
  externalUpdateInProgress: boolean;
  externalUpdateStalled: boolean;
  onReload: () => void;
  onDismiss: () => void;
  onReloadPage: () => void;
}

export function PwaUpdateBanner({
  needRefresh,
  offlineReady,
  isApplyingUpdate,
  updateStalled,
  reloadRecoveryRequired,
  externalUpdateInProgress,
  externalUpdateStalled,
  onReload,
  onDismiss,
  onReloadPage
}: PwaUpdateBannerProps) {
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState('');
  const viewModel = derivePwaUpdateBannerViewModel({
    needRefresh,
    offlineReady,
    isApplyingUpdate,
    updateStalled,
    reloadRecoveryRequired,
    externalUpdateInProgress,
    externalUpdateStalled
  });

  useEffect(() => {
    const clearTimeoutId = window.setTimeout(() => {
      setStatusAnnouncement('');
    }, 0);

    if (!viewModel.statusAnnouncement) {
      return () => {
        window.clearTimeout(clearTimeoutId);
      };
    }

    const announceTimeoutId = window.setTimeout(() => {
      setStatusAnnouncement(viewModel.statusAnnouncement);
    }, 50);

    return () => {
      window.clearTimeout(clearTimeoutId);
      window.clearTimeout(announceTimeoutId);
    };
  }, [viewModel.statusAnnouncement]);

  useEffect(() => {
    const clearTimeoutId = window.setTimeout(() => {
      setRecoveryAnnouncement('');
    }, 0);

    if (!viewModel.recoveryAnnouncement) {
      return () => {
        window.clearTimeout(clearTimeoutId);
      };
    }

    const announceTimeoutId = window.setTimeout(() => {
      setRecoveryAnnouncement(viewModel.recoveryAnnouncement);
    }, 50);

    return () => {
      window.clearTimeout(clearTimeoutId);
      window.clearTimeout(announceTimeoutId);
    };
  }, [viewModel.recoveryAnnouncement]);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </div>
      <div className="sr-only" role="alert" aria-atomic="true">
        {recoveryAnnouncement}
      </div>
      <section
        data-testid="pwa-update-banner"
        className={viewModel.isBannerActive
          ? 'rounded-2xl border border-sky-400/20 bg-sky-400/8 p-4 text-sm leading-6 text-sky-100'
          : 'sr-only'}
      >
        {viewModel.isBannerActive ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.16em] text-sky-200 uppercase">
                {viewModel.heading}
              </h2>
              <p className="mt-2">{viewModel.primaryMessage}</p>
              {viewModel.recoveryMessage ? <p className="mt-2 text-sky-50">{viewModel.recoveryMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {viewModel.showApplyButton ? (
                <button
                  type="button"
                  onClick={onReload}
                  disabled={isApplyingUpdate}
                  className="min-h-11 rounded-lg border border-sky-300/40 bg-sky-300/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-sky-100 uppercase transition hover:bg-sky-300/15 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  {viewModel.applyButtonLabel}
                </button>
              ) : null}
              {viewModel.showReloadButton ? (
                <button
                  type="button"
                  onClick={onReloadPage}
                  className="min-h-11 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-rose-100 uppercase transition hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                >
                  Reload tab
                </button>
              ) : null}
              {viewModel.showDismissButton ? (
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
    </>
  );
}
