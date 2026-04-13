import { useEffect, useState } from 'react';

import { derivePwaUpdateBannerViewModel } from '../features/pwa/pwaUpdateBannerModel';

import { NotchedFrame } from './NotchedFrame';

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

const actionButtonClasses =
  'ops-action-button clip-notched ops-notch-chip px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase';

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
      <section data-testid="pwa-update-banner" className={viewModel.isBannerActive ? '' : 'sr-only'}>
        {viewModel.isBannerActive ? (
          <NotchedFrame
            outerClassName="bg-[linear-gradient(180deg,rgba(125,211,252,0.34),rgba(255,255,255,0.04))]"
            innerClassName="bg-[linear-gradient(180deg,rgba(56,189,248,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)] p-4 text-sm leading-6 text-sky-100 sm:p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-[0.16em] text-sky-200 uppercase">
                  {viewModel.heading}
                </h2>
                <p className="mt-2">{viewModel.primaryMessage}</p>
                {viewModel.recoveryMessage ? (
                  <p className="mt-2 text-sky-50">{viewModel.recoveryMessage}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {viewModel.showApplyButton ? (
                  <button
                    type="button"
                    onClick={onReload}
                    disabled={isApplyingUpdate}
                    className={`${actionButtonClasses} ops-action-button-info`}
                  >
                    {viewModel.applyButtonLabel}
                  </button>
                ) : null}
                {viewModel.showReloadButton ? (
                  <button
                    type="button"
                    onClick={onReloadPage}
                    className={`${actionButtonClasses} ops-action-button-danger`}
                  >
                    Reload tab
                  </button>
                ) : null}
                {viewModel.showDismissButton ? (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className={`${actionButtonClasses} ops-action-button-subtle`}
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            </div>
          </NotchedFrame>
        ) : null}
      </section>
    </>
  );
}
