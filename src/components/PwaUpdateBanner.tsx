import { useEffect, useState } from 'react';

import { derivePwaUpdateBannerViewModel } from '../features/pwa/pwaUpdateBannerModel';

import { AlertSurface } from './AlertSurface';
import { getAlertSurfaceActionToneClass } from './alertSurfaceTone';

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
  compact?: boolean;
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
  onReloadPage,
  compact = false,
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
    externalUpdateStalled,
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
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusAnnouncement}
      </div>
      <div className="sr-only" role="alert" aria-atomic="true">
        {recoveryAnnouncement}
      </div>
      <section
        data-testid="pwa-update-banner"
        className={viewModel.isBannerActive ? '' : 'sr-only'}
      >
        {viewModel.isBannerActive ? (
          <AlertSurface
            as="div"
            tone="info"
            title={viewModel.heading}
            description={viewModel.primaryMessage}
            intensity={compact ? 'compact' : 'standard'}
            bodyClassName="text-[var(--ops-text-on-sky)]"
            actions={
              <>
                {viewModel.showApplyButton ? (
                  <button
                    type="button"
                    onClick={onReload}
                    disabled={isApplyingUpdate}
                    className={getAlertSurfaceActionToneClass('info')}
                  >
                    {viewModel.applyButtonLabel}
                  </button>
                ) : null}
                {viewModel.showReloadButton ? (
                  <button
                    type="button"
                    onClick={onReloadPage}
                    className={getAlertSurfaceActionToneClass('danger')}
                  >
                    Reload tab
                  </button>
                ) : null}
                {viewModel.showDismissButton ? (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="ops-action-button ops-action-button-sm ops-action-button-subtle"
                  >
                    Dismiss
                  </button>
                ) : null}
              </>
            }
          >
            {viewModel.recoveryMessage ? (
              <p>{viewModel.recoveryMessage}</p>
            ) : null}
          </AlertSurface>
        ) : null}
      </section>
    </>
  );
}
