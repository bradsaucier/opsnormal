import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { ExportPanelCrashFallback } from './components/ExportPanelCrashFallback';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { SectionCrashFallback } from './components/SectionCrashFallback';
import { TodayPanel } from './features/checkin/TodayPanel';
import { BackupActionBanner } from './features/export/BackupActionBanner';
import { createBackupActionPrompt } from './features/export/backupActionPrompt';
import { ExportPanel } from './features/export/ExportPanel';
import { HistoryGrid } from './features/history/HistoryGrid';
import { InstallBanner } from './features/install/InstallBanner';
import { usePwaUpdate } from './features/pwa/usePwaUpdate';
import { useStorageHealth } from './hooks/useStorageHealth';
import { OPSNORMAL_DB_BLOCKED_EVENT_NAME, OPSNORMAL_DB_UNBLOCKED_EVENT_NAME } from './db/appDb';
import { formatDateKey, getTrailingDateKeys } from './lib/date';
import { clearLastExportCompletedAt, getLastExportCompletedAt, recordExportCompleted } from './lib/export';
import {
  clearStorageHealthForTesting,
  formatStorageSummary,
  setStorageHealthForTesting,
  type StorageHealth
} from './lib/storage';

declare global {
  interface Window {
    __opsNormalStorageTestApi__?: {
      setStorageHealth: (storageHealth: StorageHealth | null) => void;
      clearStorageHealth: () => void;
      setLastBackupAt: (lastBackupAt: string | null) => void;
      refreshStorageHealth: () => Promise<void>;
    };
  }
}

function App() {
  const [todayKey, setTodayKey] = useState(() => formatDateKey());
  const [trailingDateKeys, setTrailingDateKeys] = useState(() => getTrailingDateKeys(30));
  const [announcement, setAnnouncement] = useState('');
  const [databaseBlockedMessage, setDatabaseBlockedMessage] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastExportCompletedAt());
  const {
    storageHealth,
    refreshStorageHealth,
    requestStorageProtection,
    isRequestingStorageProtection
  } = useStorageHealth();
  const {
    needRefresh,
    offlineReady,
    isApplyingUpdate,
    updateStalled,
    reloadRecoveryRequired,
    externalUpdateInProgress,
    externalUpdateStalled,
    handleApplyUpdate,
    handleDismissBanner,
    handleReloadPage
  } = usePwaUpdate();

  const refreshCalendarWindow = useCallback((referenceDate: Date = new Date()) => {
    setTodayKey(formatDateKey(referenceDate));
    setTrailingDateKeys(getTrailingDateKeys(30, referenceDate));
  }, []);

  useEffect(() => {
    function handleDatabaseBlocked(event: WindowEventMap[typeof OPSNORMAL_DB_BLOCKED_EVENT_NAME]) {
      setDatabaseBlockedMessage(event.detail.message);
    }

    function handleDatabaseUnblocked() {
      setDatabaseBlockedMessage(null);
    }

    window.addEventListener(OPSNORMAL_DB_BLOCKED_EVENT_NAME, handleDatabaseBlocked);
    window.addEventListener(OPSNORMAL_DB_UNBLOCKED_EVENT_NAME, handleDatabaseUnblocked);

    return () => {
      window.removeEventListener(OPSNORMAL_DB_BLOCKED_EVENT_NAME, handleDatabaseBlocked);
      window.removeEventListener(OPSNORMAL_DB_UNBLOCKED_EVENT_NAME, handleDatabaseUnblocked);
    };
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshCalendarWindow();
      }
    }

    function handleWindowFocus() {
      refreshCalendarWindow();
    }

    const intervalId = window.setInterval(() => {
      refreshCalendarWindow();
    }, 60 * 1000);

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshCalendarWindow]);

  const handleAnnouncement = useCallback((message: string) => {
    setAnnouncement((currentMessage) => {
      if (currentMessage.trimEnd() !== message) {
        return message;
      }

      return currentMessage.endsWith(' ') ? message : `${message} `;
    });
  }, []);

  const reinforceLocalStorageDurability = useCallback(() => {
    void refreshStorageHealth({ requestPersistence: true });
  }, [refreshStorageHealth]);

  const refreshStorageHealthAfterImport = useCallback(() => {
    void refreshStorageHealth({ requestPersistence: true });
  }, [refreshStorageHealth]);

  const historyKey = useMemo(() => trailingDateKeys.join('|'), [trailingDateKeys]);
  const backupActionPrompt = useMemo(
    () => createBackupActionPrompt(storageHealth, lastBackupAt),
    [lastBackupAt, storageHealth]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.MODE !== 'e2e') {
      return;
    }

    window.__opsNormalStorageTestApi__ = {
      setStorageHealth(nextStorageHealth) {
        setStorageHealthForTesting(nextStorageHealth);
      },
      clearStorageHealth() {
        clearStorageHealthForTesting();
      },
      setLastBackupAt(nextLastBackupAt) {
        if (nextLastBackupAt) {
          recordExportCompleted(nextLastBackupAt);
        } else {
          clearLastExportCompletedAt();
        }

        setLastBackupAt(nextLastBackupAt);
      },
      async refreshStorageHealth() {
        await refreshStorageHealth();
      }
    };

    return () => {
      clearStorageHealthForTesting();
      delete window.__opsNormalStorageTestApi__;
    };
  }, [refreshStorageHealth]);

  return (
    <div className="min-h-screen min-h-dvh bg-ops-base text-zinc-100">
      <a className="ops-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <main id="main-content" tabIndex={-1} className="app-shell mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="clip-notched ops-notch-shell-outer bg-ops-accent-border p-px">
          <header className="tactical-panel clip-notched ops-notch-shell-inner bg-[linear-gradient(180deg,rgba(110,231,183,0.10),rgba(255,255,255,0.02)),var(--color-ops-surface-1)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-emerald-300/90 uppercase">
                  Personal Readiness Tracker
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[0.12em] text-white uppercase sm:text-4xl">
                  OpsNormal
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
                  A local-only mirror for daily balance across work or school, household,
                  relationships, body, and rest. No account. No cloud sync. No analytics layer.
                </p>
              </div>
              <div className="clip-notched ops-notch-panel-outer bg-white/10 p-px text-right">
                <div className="clip-notched ops-notch-panel-inner bg-black/25 px-4 py-3">
                  <div className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Data posture</div>
                  <div className="mt-1 text-sm font-semibold tracking-[0.08em] text-zinc-100 uppercase">
                    Local only
                  </div>
                  <div className="mt-2 text-xs leading-5 text-zinc-400">
                    {storageHealth ? formatStorageSummary(storageHealth) : 'Assessing local storage posture. If Safari returns to a blank state after inactivity, restore from the latest JSON export immediately.'}
                  </div>
                </div>
              </div>
            </div>
          </header>
        </div>

        <InstallBanner />
        <PwaUpdateBanner
          needRefresh={needRefresh}
          offlineReady={offlineReady}
          isApplyingUpdate={isApplyingUpdate}
          updateStalled={updateStalled}
          reloadRecoveryRequired={reloadRecoveryRequired}
          externalUpdateInProgress={externalUpdateInProgress}
          externalUpdateStalled={externalUpdateStalled}
          onReload={handleApplyUpdate}
          onDismiss={handleDismissBanner}
          onReloadPage={handleReloadPage}
        />
        {databaseBlockedMessage ? (
          <div className="clip-notched ops-notch-shell-outer bg-amber-400/40 p-px">
            <section
              className="clip-notched ops-notch-shell-inner bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(255,255,255,0.02)),var(--color-ops-surface-1)] p-4"
              role="alert"
              aria-atomic="true"
              aria-labelledby="database-upgrade-blocked-title"
            >
              <p
                id="database-upgrade-blocked-title"
                className="text-xs font-semibold tracking-[0.18em] text-amber-200 uppercase"
              >
                Database Upgrade Blocked
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{databaseBlockedMessage}</p>
            </section>
          </div>
        ) : null}
        <BackupActionBanner prompt={backupActionPrompt} />

        <ErrorBoundary
          resetKeys={[todayKey]}
          fallbackRender={({ error, componentStack, resetErrorBoundary }) => (
            <SectionCrashFallback
              sectionName="Daily Check-In"
              error={error}
              componentStack={componentStack}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          <TodayPanel
            todayKey={todayKey}
            onDateRollover={refreshCalendarWindow}
            onMeaningfulSave={reinforceLocalStorageDurability}
            onAnnounce={handleAnnouncement}
          />
        </ErrorBoundary>
        <ErrorBoundary
          resetKeys={[historyKey, todayKey]}
          fallbackRender={({ error, componentStack, resetErrorBoundary }) => (
            <SectionCrashFallback
              sectionName="History Grid"
              error={error}
              componentStack={componentStack}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          <HistoryGrid key={historyKey} dateKeys={trailingDateKeys} todayKey={todayKey} />
        </ErrorBoundary>
        <div id="backup-and-recovery">
          <ErrorBoundary
            fallbackRender={({ error, componentStack, resetErrorBoundary }) => (
              <ExportPanelCrashFallback
                error={error}
                componentStack={componentStack}
                onRetry={resetErrorBoundary}
              />
            )}
          >
            <ExportPanel
              storageHealth={storageHealth}
              onBackupCompleted={setLastBackupAt}
              onRequestStorageProtection={requestStorageProtection}
              isRequestingStorageProtection={isRequestingStorageProtection}
              onImportCommitted={refreshStorageHealthAfterImport}
            />
          </ErrorBoundary>
        </div>

        <div className="clip-notched ops-notch-shell-outer bg-white/10 p-px">
          <footer className="clip-notched ops-notch-shell-inner bg-black/25 p-4 text-sm leading-6 text-zinc-400">
            <p className="font-semibold tracking-[0.14em] text-zinc-200 uppercase">Boundary</p>
            <p className="mt-2">
              OpsNormal is a personal status tracking tool. It is not a medical device and does not
              diagnose, treat, cure, or prevent any disease or condition. It does not provide medical
              or psychological advice.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
