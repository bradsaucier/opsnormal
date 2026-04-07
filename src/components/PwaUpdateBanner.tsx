import { useEffect, useMemo, useState } from 'react';

interface PwaUpdateBannerProps {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  reloadRecoveryRequired: boolean;
  onReload: () => void;
  onDismiss: () => void;
  onReloadPage: () => void;
}

const RECOVERY_ANNOUNCEMENT =
  'Update loop intercepted. Close other OpsNormal tabs, then reload this tab to complete recovery.';

export function PwaUpdateBanner({
  needRefresh,
  offlineReady,
  isApplyingUpdate,
  updateStalled,
  reloadRecoveryRequired,
  onReload,
  onDismiss,
  onReloadPage
}: PwaUpdateBannerProps) {
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [recoveryAnnouncement, setRecoveryAnnouncement] = useState('');
  const isRecoveryActive = reloadRecoveryRequired;
  const isBannerActive = isRecoveryActive || needRefresh || offlineReady;
  const showDismissButton = !isRecoveryActive && (!needRefresh || !updateStalled);

  function getHeading(): string {
    if (isRecoveryActive) {
      return 'Update Recovery Required';
    }

    return needRefresh ? 'Update Ready' : 'Offline Ready';
  }

  function getPrimaryMessage(): string {
    if (isRecoveryActive) {
      return RECOVERY_ANNOUNCEMENT;
    }

    if (needRefresh) {
      return 'A newer build is available. Apply the update to hand control to the waiting service worker.';
    }

    return 'The service worker is active. OpsNormal can now reopen offline after first load.';
  }

  function getRecoveryMessage(): string | null {
    if (isRecoveryActive) {
      return 'If this happened during local testing, disable Chrome DevTools Update on reload before another handoff drill.';
    }

    if (needRefresh && updateStalled) {
      return 'Update handoff did not complete. Another OpsNormal tab may still be holding the active worker. Close the other OpsNormal tabs, then reload this tab and apply the update again.';
    }

    return null;
  }

  const heading = getHeading();
  const primaryMessage = getPrimaryMessage();
  const recoveryMessage = getRecoveryMessage();
  const composedStatusAnnouncement = useMemo(() => {
    if (!isBannerActive || isRecoveryActive) {
      return '';
    }

    return [heading, primaryMessage, recoveryMessage].filter(Boolean).join(' ');
  }, [heading, isBannerActive, isRecoveryActive, primaryMessage, recoveryMessage]);

  useEffect(() => {
    const clearTimeoutId = window.setTimeout(() => {
      setStatusAnnouncement('');
    }, 0);

    if (!composedStatusAnnouncement) {
      return () => {
        window.clearTimeout(clearTimeoutId);
      };
    }

    // One-frame post-mount mutation improves live-region detection after reload.
    // Broader assistive-technology coverage may justify a longer delay in the future.
    const announceTimeoutId = window.setTimeout(() => {
      setStatusAnnouncement(composedStatusAnnouncement);
    }, 16);

    return () => {
      window.clearTimeout(clearTimeoutId);
      window.clearTimeout(announceTimeoutId);
    };
  }, [composedStatusAnnouncement]);

  useEffect(() => {
    const clearTimeoutId = window.setTimeout(() => {
      setRecoveryAnnouncement('');
    }, 0);

    if (!isRecoveryActive) {
      return () => {
        window.clearTimeout(clearTimeoutId);
      };
    }

    // One-frame post-mount mutation improves live-region detection after reload.
    // Broader assistive-technology coverage may justify a longer delay in the future.
    const announceTimeoutId = window.setTimeout(() => {
      setRecoveryAnnouncement(RECOVERY_ANNOUNCEMENT);
    }, 16);

    return () => {
      window.clearTimeout(clearTimeoutId);
      window.clearTimeout(announceTimeoutId);
    };
  }, [isRecoveryActive]);

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
        className={isBannerActive
          ? 'rounded-2xl border border-sky-400/20 bg-sky-400/8 p-4 text-sm leading-6 text-sky-100'
          : 'sr-only'}
      >
        {isBannerActive ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.16em] text-sky-200 uppercase">
                {heading}
              </h2>
              <p className="mt-2">{primaryMessage}</p>
              {recoveryMessage ? <p className="mt-2 text-sky-50">{recoveryMessage}</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {needRefresh && !isRecoveryActive ? (
                <button
                  type="button"
                  onClick={onReload}
                  disabled={isApplyingUpdate}
                  className="min-h-11 rounded-lg border border-sky-300/40 bg-sky-300/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-sky-100 uppercase transition hover:bg-sky-300/15 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  {isApplyingUpdate ? 'Applying' : 'Apply update'}
                </button>
              ) : null}
              {isRecoveryActive || (needRefresh && updateStalled) ? (
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
    </>
  );
}
