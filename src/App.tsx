import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertSurface } from './components/AlertSurface';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExportPanelCrashFallback } from './components/ExportPanelCrashFallback';
import { FooterProvenance } from './components/FooterProvenance';
import {
  HeaderTelemetry,
  HeaderTelemetryFallback,
} from './components/HeaderTelemetry';
import { NotchedFrame } from './components/NotchedFrame';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { SectionCrashFallback } from './components/SectionCrashFallback';
import { SectorGlyphMark } from './components/icons/SectorGlyphs';
import { TodayPanel } from './features/checkin/TodayPanel';
import { BackupActionBanner } from './features/export/BackupActionBanner';
import { createBackupActionPrompt } from './features/export/backupActionPrompt';
import { ExportPanel } from './features/export/ExportPanel';
import { HistoryGrid } from './features/history/HistoryGrid';
import { InstallBanner } from './features/install/InstallBanner';
import { usePwaUpdate } from './features/pwa/usePwaUpdate';
import { useStorageHealth } from './hooks/useStorageHealth';
import {
  OPSNORMAL_DB_BLOCKED_EVENT_NAME,
  OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
} from './db/appDb';
import { formatDateKey, getTrailingDateKeys } from './lib/date';
import {
  clearLastExportCompletedAt,
  getLastExportCompletedAt,
  recordExportCompleted,
} from './lib/export';
import {
  clearStorageHealthForTesting,
  setStorageHealthForTesting,
  type StorageHealth,
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

// Architecture: ADR-0011, ADR-0015, ADR-0016, and ADR-0017 keep failure containment
// sectional and preserve critical recovery surfaces at the app boundary.
function App() {
  const [todayKey, setTodayKey] = useState(() => formatDateKey());
  const [trailingDateKeys, setTrailingDateKeys] = useState(() =>
    getTrailingDateKeys(30),
  );
  const [announcement, setAnnouncement] = useState('');
  const [databaseBlockedMessage, setDatabaseBlockedMessage] = useState<
    string | null
  >(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() =>
    getLastExportCompletedAt(),
  );
  const {
    storageHealth,
    refreshStorageHealth,
    requestStorageProtection,
    isRequestingStorageProtection,
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
    handleReloadPage,
  } = usePwaUpdate();

  const refreshCalendarWindow = useCallback(
    (referenceDate: Date = new Date()) => {
      setTodayKey(formatDateKey(referenceDate));
      setTrailingDateKeys(getTrailingDateKeys(30, referenceDate));
    },
    [],
  );

  useEffect(() => {
    function handleDatabaseBlocked(
      event: WindowEventMap[typeof OPSNORMAL_DB_BLOCKED_EVENT_NAME],
    ) {
      setDatabaseBlockedMessage(event.detail.message);
    }

    function handleDatabaseUnblocked() {
      setDatabaseBlockedMessage(null);
    }

    window.addEventListener(
      OPSNORMAL_DB_BLOCKED_EVENT_NAME,
      handleDatabaseBlocked,
    );
    window.addEventListener(
      OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
      handleDatabaseUnblocked,
    );

    return () => {
      window.removeEventListener(
        OPSNORMAL_DB_BLOCKED_EVENT_NAME,
        handleDatabaseBlocked,
      );
      window.removeEventListener(
        OPSNORMAL_DB_UNBLOCKED_EVENT_NAME,
        handleDatabaseUnblocked,
      );
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

  const historyKey = useMemo(
    () => trailingDateKeys.join('|'),
    [trailingDateKeys],
  );
  const backupActionPrompt = useMemo(
    () => createBackupActionPrompt(storageHealth, lastBackupAt),
    [lastBackupAt, storageHealth],
  );
  const hasPriorityAlert = Boolean(
    databaseBlockedMessage || backupActionPrompt,
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
      },
    };

    return () => {
      clearStorageHealthForTesting();
      delete window.__opsNormalStorageTestApi__;
    };
  }, [refreshStorageHealth]);

  return (
    <div className="min-h-screen min-h-dvh bg-ops-base text-ops-text-primary">
      <a className="ops-skip-link" href="#main-content">
        Skip to main content
      </a>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="app-shell mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8"
      >
        <NotchedFrame
          emphasis="primary"
          notch="shell"
          innerClassName="tactical-panel bg-[linear-gradient(180deg,rgba(110,231,183,0.10),rgba(255,255,255,0.02)),var(--color-ops-surface-1)] p-5 sm:p-6 lg:p-7"
        >
          <header>
            <div className="grid gap-5 lg:gap-6">
              <div className="flex max-w-4xl gap-4">
                <div
                  className="hidden w-3 shrink-0 flex-col items-center self-stretch sm:flex"
                  aria-hidden="true"
                >
                  <span className="h-14 w-0.5 bg-ops-accent/60" />
                  <span className="mt-2 h-full w-px flex-1 bg-ops-border-struct" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="clip-notched ops-notch-chip tactical-chip-panel inline-flex h-8 w-8 items-center justify-center border border-ops-accent/30 text-ops-accent-muted"
                      aria-hidden="true"
                    >
                      <SectorGlyphMark sectorId="work-school" />
                    </span>
                    <p className="ops-eyebrow-strong ops-mono text-xs font-semibold text-ops-accent/70">
                      Personal Readiness Tracker
                    </p>
                  </div>
                  <h1 className="ops-tracking-display mt-3 text-4xl font-semibold text-ops-text-primary uppercase sm:text-5xl">
                    OpsNormal
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-ops-text-secondary sm:text-base">
                    A local-only mirror for daily balance across work or school,
                    household, relationships, body, and rest. No account. No
                    cloud sync. No analytics layer.
                  </p>
                </div>
              </div>
              <ErrorBoundary
                fallbackRender={() => (
                  <HeaderTelemetryFallback
                    lastBackupAt={lastBackupAt}
                    storageHealth={storageHealth}
                  />
                )}
              >
                <HeaderTelemetry
                  dateKeys={trailingDateKeys}
                  lastBackupAt={lastBackupAt}
                  storageHealth={storageHealth}
                  todayKey={todayKey}
                />
              </ErrorBoundary>
            </div>
          </header>
        </NotchedFrame>

        <InstallBanner compact={hasPriorityAlert} />
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
          compact={hasPriorityAlert}
        />
        {databaseBlockedMessage ? (
          <AlertSurface
            tone="attention"
            title="Database Upgrade Blocked"
            description={databaseBlockedMessage}
            role="alert"
            aria-atomic="true"
            titleId="database-upgrade-blocked-title"
          />
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
          <HistoryGrid
            key={historyKey}
            dateKeys={trailingDateKeys}
            todayKey={todayKey}
          />
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

        <NotchedFrame
          emphasis="quiet"
          notch="shell"
          innerClassName="tactical-subpanel px-4 py-4 text-sm leading-6 text-ops-text-secondary"
        >
          <footer>
            <div className="border-t border-ops-border-soft pt-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
                <div className="lg:max-w-2xl">
                  <p className="ops-eyebrow font-semibold text-ops-text-primary">
                    Boundary
                  </p>
                  <p className="mt-2">
                    OpsNormal is a personal status tracking tool. It is not a
                    medical device and does not diagnose, treat, cure, or
                    prevent any disease or condition. It does not provide
                    medical or psychological advice.
                  </p>
                </div>
                <FooterProvenance />
              </div>
            </div>
          </footer>
        </NotchedFrame>
      </main>
    </div>
  );
}

export default App;
