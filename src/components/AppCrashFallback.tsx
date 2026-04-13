import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteOpsNormalDatabase,
  readCrashExportSnapshot,
} from '../lib/crashExport';
import { getErrorMessage } from '../lib/errors';
import { downloadTextFile } from '../lib/fileDownload';
import { recordExportCompleted } from '../lib/exportPersistence';
import {
  createCrashJsonExport,
  createCsvExport,
} from '../lib/exportSerialization';
import { reloadCurrentPage } from '../lib/runtime';
import type { CrashExportSnapshot } from '../lib/crashExport';

interface AppCrashFallbackProps {
  error: Error;
  onRetry: () => void;
}

type BusyAction = 'json' | 'csv' | 'clear' | null;
type ClearConfirmState = 'idle' | 'armed';

function formatEntryCount(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'} recovered.`;
}

function formatSkippedCount(count: number): string {
  return `${count} malformed ${count === 1 ? 'row' : 'rows'} skipped.`;
}

function formatCrashExportMessage(
  formatLabel: 'JSON' | 'CSV',
  recoveredCount: number,
  skippedCount: number,
): string {
  const recoveredMessage = formatEntryCount(recoveredCount);
  const diagnosticsSuffix =
    formatLabel === 'JSON' ? ' Crash diagnostics captured.' : '';

  if (skippedCount === 0) {
    return `${formatLabel} export complete. ${recoveredMessage}${diagnosticsSuffix}`;
  }

  return `${formatLabel} export complete. ${recoveredMessage} ${formatSkippedCount(skippedCount)}${diagnosticsSuffix}`;
}

export function AppCrashFallback({ error, onRetry }: AppCrashFallbackProps) {
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [hasExported, setHasExported] = useState(false);
  const [manualDeleteAcknowledged, setManualDeleteAcknowledged] =
    useState(false);
  const [clearConfirmState, setClearConfirmState] =
    useState<ClearConfirmState>('idle');
  const [message, setMessage] = useState(
    'The display crashed but your data may still be intact in local storage. Export it now before reloading.',
  );
  const clearActionRef = useRef<HTMLDivElement | null>(null);
  const primaryClearButtonRef = useRef<HTMLButtonElement | null>(null);
  const busyActionRef = useRef<BusyAction>(null);

  const faultMessage = useMemo(
    () => getErrorMessage(error, 'Unknown render failure.'),
    [error],
  );

  const recoveryControlsDisabled = busyAction !== null;
  const clearDataUnlocked = hasExported || manualDeleteAcknowledged;
  const clearDataButtonDisabled =
    recoveryControlsDisabled || !clearDataUnlocked;

  const disarmClearData = useCallback((nextMessage: string) => {
    if (busyActionRef.current !== null) {
      return;
    }

    setClearConfirmState('idle');
    setMessage(nextMessage);
    requestAnimationFrame(() => {
      primaryClearButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    busyActionRef.current = busyAction;
  }, [busyAction]);

  useEffect(() => {
    if (clearConfirmState !== 'armed' || busyAction !== null) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      disarmClearData(
        'Clear-data reset disarmed. Local data remains untouched.',
      );
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!clearActionRef.current?.contains(target)) {
        disarmClearData(
          'Clear-data reset disarmed after focus moved off the destructive control group.',
        );
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [busyAction, clearConfirmState, disarmClearData]);

  async function handleJsonExport() {
    try {
      setBusyAction('json');
      const snapshot: CrashExportSnapshot = await readCrashExportSnapshot();
      const exportedAt = new Date().toISOString();
      const payload: string = await createCrashJsonExport(
        snapshot.entries,
        snapshot.storageDiagnostics,
        exportedAt,
      );
      downloadTextFile(
        'opsnormal-crash-export.json',
        payload,
        'application/json',
      );
      recordExportCompleted(exportedAt);
      setHasExported(true);
      setMessage(
        formatCrashExportMessage(
          'JSON',
          snapshot.entries.length,
          snapshot.skippedCount,
        ),
      );
    } catch (error: unknown) {
      setMessage(
        getErrorMessage(error, 'JSON export failed. Try reloading first.'),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCsvExport() {
    try {
      setBusyAction('csv');
      const snapshot: CrashExportSnapshot = await readCrashExportSnapshot();
      const payload: string = createCsvExport(snapshot.entries);
      const exportedAt = new Date().toISOString();
      downloadTextFile(
        'opsnormal-crash-export.csv',
        payload,
        'text/csv;charset=utf-8',
      );
      recordExportCompleted(exportedAt);
      setHasExported(true);
      setMessage(
        formatCrashExportMessage(
          'CSV',
          snapshot.entries.length,
          snapshot.skippedCount,
        ),
      );
    } catch (error: unknown) {
      setMessage(
        getErrorMessage(error, 'CSV export failed. Try reloading first.'),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleClearDataAndReload() {
    if (!clearDataUnlocked) {
      return;
    }

    if (clearConfirmState !== 'armed') {
      setClearConfirmState('armed');
      setMessage(
        'Clear-data reset armed. Press the button again to delete all local OpsNormal data and reload, or press Escape to stand down.',
      );
      return;
    }

    try {
      setBusyAction('clear');
      setMessage(
        'Deleting all local OpsNormal data now. The page will reload after the reset completes.',
      );
      await deleteOpsNormalDatabase();
      reloadCurrentPage();
    } catch (error: unknown) {
      setClearConfirmState('idle');
      setMessage(
        getErrorMessage(
          error,
          'Local data reset failed. Close duplicate OpsNormal tabs, then retry or clear site data manually through the browser.',
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="ops-crash-fallback-shell" data-testid="app-crash-fallback">
      <div className="ops-crash-fallback-container">
        <p className="ops-crash-fallback-eyebrow">Render fault</p>
        <h1 className="ops-crash-fallback-title">
          OpsNormal stopped rendering
        </h1>
        <p
          className="ops-crash-fallback-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </p>

        <div className="ops-crash-fallback-detail-card">
          <p className="ops-crash-fallback-detail-label">Error detail</p>
          <p className="ops-crash-fallback-detail" role="alert">
            {faultMessage}
          </p>
        </div>

        <div className="ops-crash-fallback-actions">
          <button
            className="ops-crash-fallback-button ops-crash-fallback-button-primary"
            type="button"
            onClick={() => void handleJsonExport()}
            disabled={recoveryControlsDisabled}
          >
            {busyAction === 'json' ? 'Exporting JSON' : 'Export JSON'}
          </button>
          <button
            className="ops-crash-fallback-button ops-crash-fallback-button-muted"
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={recoveryControlsDisabled}
          >
            {busyAction === 'csv' ? 'Exporting CSV' : 'Export CSV'}
          </button>
          <button
            className="ops-crash-fallback-button ops-crash-fallback-button-retry"
            type="button"
            onClick={onRetry}
            disabled={recoveryControlsDisabled}
          >
            Retry app
          </button>
          <button
            className="ops-crash-fallback-button ops-crash-fallback-button-reload"
            type="button"
            onClick={reloadCurrentPage}
            disabled={recoveryControlsDisabled}
          >
            Reload page
          </button>
        </div>

        <div ref={clearActionRef} className="ops-crash-fallback-danger-zone">
          <p className="ops-crash-fallback-danger-label">
            Destructive recovery
          </p>
          <p className="ops-crash-fallback-danger-copy">
            Use this only if export, retry, and reload still leave OpsNormal
            stuck in a repeat crash loop. This action permanently deletes all
            local data stored on this device for this app.
          </p>
          <label className="ops-crash-fallback-checkbox-row">
            <input
              className="ops-crash-fallback-checkbox"
              type="checkbox"
              checked={manualDeleteAcknowledged}
              onChange={(event) => {
                setManualDeleteAcknowledged(event.currentTarget.checked);
              }}
              disabled={recoveryControlsDisabled || hasExported}
            />
            <span>
              I understand this will permanently delete local data and should
              only be used after I export a recovery file.
            </span>
          </label>
          <div className="ops-crash-fallback-actions">
            <button
              ref={primaryClearButtonRef}
              className={`ops-crash-fallback-button ops-crash-fallback-button-danger${clearConfirmState === 'armed' ? ' is-armed' : ''}`}
              type="button"
              onClick={() => void handleClearDataAndReload()}
              disabled={clearDataButtonDisabled}
            >
              {busyAction === 'clear'
                ? 'Clearing local data'
                : clearConfirmState === 'armed'
                  ? 'Confirm delete all local data and reload'
                  : 'Clear local data and reload'}
            </button>
            {clearConfirmState === 'armed' ? (
              <button
                className="ops-crash-fallback-button ops-crash-fallback-button-muted"
                type="button"
                onClick={() => {
                  disarmClearData(
                    'Clear-data reset disarmed. Local data remains untouched.',
                  );
                }}
                disabled={recoveryControlsDisabled}
              >
                Disarm clear-data reset
              </button>
            ) : null}
          </div>
          {!clearDataUnlocked ? (
            <p className="ops-crash-fallback-danger-note">
              Unlock requires either a successful export in this crash session
              or the explicit delete acknowledgment above.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
