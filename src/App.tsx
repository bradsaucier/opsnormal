import { useEffect, useMemo, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { SectionCrashFallback } from './components/SectionCrashFallback';
import { TodayPanel } from './features/checkin/TodayPanel';
import { ExportPanel } from './features/export/ExportPanel';
import { HistoryGrid } from './features/history/HistoryGrid';
import { InstallBanner } from './features/install/InstallBanner';
import { useStorageHealth } from './hooks/useStorageHealth';
import { formatStorageSummary } from './lib/storage';
import { formatDateKey, getTrailingDateKeys } from './lib/date';

function App() {
  const [todayKey, setTodayKey] = useState(() => formatDateKey());
  const [trailingDateKeys, setTrailingDateKeys] = useState(() => getTrailingDateKeys(30));
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const { storageHealth, refreshStorageHealth } = useStorageHealth();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      window.setInterval(() => {
        if (registration.installing) {
          return;
        }

        if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
          return;
        }

        void registration.update();
      }, 60 * 60 * 1000);
    }
  });

  useEffect(() => {
    function refreshCalendarWindow() {
      setTodayKey(formatDateKey());
      setTrailingDateKeys(getTrailingDateKeys(30));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshCalendarWindow();
      }
    }

    const intervalId = window.setInterval(refreshCalendarWindow, 60 * 1000);
    window.addEventListener('focus', refreshCalendarWindow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshCalendarWindow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  function reinforceLocalStorageDurability() {
    void refreshStorageHealth({ requestPersistence: true });
  }

  const historyKey = useMemo(() => trailingDateKeys.join('|'), [trailingDateKeys]);

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.02))] p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]">
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
            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
              <div className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Data posture</div>
              <div className="mt-1 text-sm font-semibold tracking-[0.08em] text-zinc-100 uppercase">
                Local only
              </div>
              <div className="mt-2 text-xs leading-5 text-zinc-400">
                {storageHealth ? formatStorageSummary(storageHealth) : 'Assessing local storage posture.'}
              </div>
            </div>
          </div>
        </header>

        <InstallBanner />
        <PwaUpdateBanner
          needRefresh={needRefresh}
          offlineReady={offlineReady && !offlineBannerDismissed}
          onReload={() => void updateServiceWorker(true)}
          onDismiss={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
            setOfflineBannerDismissed(true);
          }}
        />

        <TodayPanel todayKey={todayKey} onMeaningfulSave={reinforceLocalStorageDurability} />
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

        <footer className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-400">
          <p className="font-semibold tracking-[0.14em] text-zinc-200 uppercase">Boundary</p>
          <p className="mt-2">
            OpsNormal is a personal status tracking tool. It is not a medical device and does not
            diagnose, treat, cure, or prevent any disease or condition. It does not provide medical
            or psychological advice.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
