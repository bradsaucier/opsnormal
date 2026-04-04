import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { SectionCrashFallback } from './components/SectionCrashFallback';
import { TodayPanel } from './features/checkin/TodayPanel';
import { ExportPanel } from './features/export/ExportPanel';
import { HistoryGrid } from './features/history/HistoryGrid';
import { InstallBanner } from './features/install/InstallBanner';
import { usePwaUpdate } from './features/pwa/usePwaUpdate';
import { useStorageHealth } from './hooks/useStorageHealth';
import { formatDateKey, getTrailingDateKeys } from './lib/date';
import { formatStorageSummary } from './lib/storage';

function App() {
  const [todayKey, setTodayKey] = useState(() => formatDateKey());
  const [trailingDateKeys, setTrailingDateKeys] = useState(() => getTrailingDateKeys(30));
  const { storageHealth, refreshStorageHealth } = useStorageHealth();
  const {
    needRefresh,
    offlineReady,
    isApplyingUpdate,
    updateStalled,
    handleApplyUpdate,
    handleDismissBanner,
    handleReloadPage
  } = usePwaUpdate();

  const refreshCalendarWindow = useCallback((referenceDate: Date = new Date()) => {
    setTodayKey(formatDateKey(referenceDate));
    setTrailingDateKeys(getTrailingDateKeys(30, referenceDate));
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

  function reinforceLocalStorageDurability() {
    void refreshStorageHealth({ requestPersistence: true });
  }

  const historyKey = useMemo(() => trailingDateKeys.join('|'), [trailingDateKeys]);

  return (
    <div className="min-h-screen min-h-dvh bg-ops-base text-zinc-100">
      <main className="app-shell mx-auto flex w-full max-w-7xl flex-col gap-4">
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
                  {storageHealth ? formatStorageSummary(storageHealth) : 'Assessing local storage posture.'}
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
          onReload={handleApplyUpdate}
          onDismiss={handleDismissBanner}
          onReloadPage={handleReloadPage}
        />

        <TodayPanel
          todayKey={todayKey}
          onDateRollover={refreshCalendarWindow}
          onMeaningfulSave={reinforceLocalStorageDurability}
        />
        <ErrorBoundary
          resetKeys={[historyKey, todayKey]}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <SectionCrashFallback
              label="History Grid"
              error={error}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          <HistoryGrid key={historyKey} dateKeys={trailingDateKeys} todayKey={todayKey} />
        </ErrorBoundary>
        <ExportPanel storageHealth={storageHealth} />

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
