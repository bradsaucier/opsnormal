import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { deleteOpsNormalDatabase, readCrashExportSnapshot } from '../lib/crashExport';
import { getErrorMessage } from '../lib/errors';
import {
  createCrashJsonExport,
  createCsvExport,
  downloadTextFile,
  recordExportCompleted
} from '../lib/export';
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
  skippedCount: number
): string {
  const recoveredMessage = formatEntryCount(recoveredCount);
  const diagnosticsSuffix = formatLabel === 'JSON' ? ' Crash diagnostics captured.' : '';

  if (skippedCount === 0) {
    return `${formatLabel} export complete. ${recoveredMessage}${diagnosticsSuffix}`;
  }

  return `${formatLabel} export complete. ${recoveredMessage} ${formatSkippedCount(skippedCount)}${diagnosticsSuffix}`;
}

export function AppCrashFallback({ error, onRetry }: AppCrashFallbackProps) {
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [hasExported, setHasExported] = useState(false);
  const [manualDeleteAcknowledged, setManualDeleteAcknowledged] = useState(false);
  const [clearConfirmState, setClearConfirmState] = useState<ClearConfirmState>('idle');
  const [message, setMessage] = useState(
    'The display crashed but your data may still be intact in local storage. Export it now before reloading.'
  );
  const clearActionRef = useRef<HTMLDivElement | null>(null);
  const primaryClearButtonRef = useRef<HTMLButtonElement | null>(null);
  const busyActionRef = useRef<BusyAction>(null);

  const faultMessage = useMemo(
    () => getErrorMessage(error, 'Unknown render failure.'),
    [error]
  );

  const recoveryControlsDisabled = busyAction !== null;
  const clearDataUnlocked = hasExported || manualDeleteAcknowledged;
  const clearDataButtonDisabled = recoveryControlsDisabled || !clearDataUnlocked;

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

      disarmClearData('Clear-data reset disarmed. Local data remains untouched.');
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!clearActionRef.current?.contains(target)) {
        disarmClearData(
          'Clear-data reset disarmed after focus moved off the destructive control group.'
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
        exportedAt
      );
      downloadTextFile('opsnormal-crash-export.json', payload, 'application/json');
      recordExportCompleted(exportedAt);
      setHasExported(true);
      setMessage(formatCrashExportMessage('JSON', snapshot.entries.length, snapshot.skippedCount));
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'JSON export failed. Try reloading first.'));
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
      downloadTextFile('opsnormal-crash-export.csv', payload, 'text/csv;charset=utf-8');
      recordExportCompleted(exportedAt);
      setHasExported(true);
      setMessage(formatCrashExportMessage('CSV', snapshot.entries.length, snapshot.skippedCount));
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'CSV export failed. Try reloading first.'));
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
        'Clear-data reset armed. Press the button again to delete all local OpsNormal data and reload, or press Escape to stand down.'
      );
      return;
    }

    try {
      setBusyAction('clear');
      setMessage('Deleting all local OpsNormal data now. The page will reload after the reset completes.');
      await deleteOpsNormalDatabase();
      reloadCurrentPage();
    } catch (error: unknown) {
      setClearConfirmState('idle');
      setMessage(
        getErrorMessage(
          error,
          'Local data reset failed. Close duplicate OpsNormal tabs, then retry or clear site data manually through the browser.'
        )
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f0d',
        color: '#e4e4e7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem'
      }}
    >
      <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#fca5a5'
          }}
        >
          Render fault
        </p>
        <h1
          style={{
            marginTop: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}
        >
          OpsNormal stopped rendering
        </h1>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.75',
            color: '#a1a1aa'
          }}
        >
          {message}
        </p>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(0,0,0,0.25)'
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#71717a'
            }}
          >
            Error detail
          </p>
          <p
            role="alert"
            style={{
              marginTop: '0.5rem',
              fontSize: '0.8125rem',
              fontFamily: 'monospace',
              color: '#fca5a5',
              wordBreak: 'break-word'
            }}
          >
            {faultMessage}
          </p>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => void handleJsonExport()}
            disabled={recoveryControlsDisabled}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#a7f3d0',
              backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(52,211,153,0.4)',
              borderRadius: '0.5rem',
              cursor: recoveryControlsDisabled ? 'wait' : 'pointer',
              opacity: recoveryControlsDisabled ? 0.7 : 1
            }}
          >
            {busyAction === 'json' ? 'Exporting JSON' : 'Export JSON'}
          </button>
          <button
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={recoveryControlsDisabled}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#e4e4e7',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.5rem',
              cursor: recoveryControlsDisabled ? 'wait' : 'pointer',
              opacity: recoveryControlsDisabled ? 0.7 : 1
            }}
          >
            {busyAction === 'csv' ? 'Exporting CSV' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={recoveryControlsDisabled}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#93c5fd',
              backgroundColor: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: '0.5rem',
              cursor: recoveryControlsDisabled ? 'wait' : 'pointer',
              opacity: recoveryControlsDisabled ? 0.7 : 1
            }}
          >
            Retry app
          </button>
          <button
            type="button"
            onClick={reloadCurrentPage}
            disabled={recoveryControlsDisabled}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#fdba74',
              backgroundColor: 'rgba(251,146,60,0.1)',
              border: '1px solid rgba(251,146,60,0.4)',
              borderRadius: '0.5rem',
              cursor: recoveryControlsDisabled ? 'wait' : 'pointer',
              opacity: recoveryControlsDisabled ? 0.7 : 1
            }}
          >
            Reload page
          </button>
        </div>

        <div
          ref={clearActionRef}
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid rgba(248,113,113,0.28)',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(127,29,29,0.18)'
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#fca5a5'
            }}
          >
            Destructive recovery
          </p>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: '#d4d4d8'
            }}
          >
            Use this only if export, retry, and reload still leave OpsNormal stuck in a repeat crash loop.
            This action permanently deletes all local data stored on this device for this app.
          </p>
          <label
            style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              fontSize: '0.8125rem',
              lineHeight: '1.5',
              color: '#e4e4e7'
            }}
          >
            <input
              type="checkbox"
              checked={manualDeleteAcknowledged}
              onChange={(event) => {
                setManualDeleteAcknowledged(event.currentTarget.checked);
              }}
              disabled={recoveryControlsDisabled || hasExported}
              aria-label="Acknowledge local data will be permanently deleted"
              style={{ marginTop: '0.2rem' }}
            />
            <span>
              I understand this will permanently delete local data and should only be used after I export a recovery file.
            </span>
          </label>
          <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              ref={primaryClearButtonRef}
              type="button"
              onClick={() => void handleClearDataAndReload()}
              disabled={clearDataButtonDisabled}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#fee2e2',
                backgroundColor:
                  clearConfirmState === 'armed' ? 'rgba(220,38,38,0.32)' : 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(248,113,113,0.45)',
                borderRadius: '0.5rem',
                cursor: clearDataButtonDisabled ? 'not-allowed' : recoveryControlsDisabled ? 'wait' : 'pointer',
                opacity: clearDataButtonDisabled ? 0.55 : 1
              }}
            >
              {busyAction === 'clear'
                ? 'Clearing local data'
                : clearConfirmState === 'armed'
                  ? 'Confirm delete all local data and reload'
                  : 'Clear local data and reload'}
            </button>
            {clearConfirmState === 'armed' ? (
              <button
                type="button"
                onClick={() => {
                  disarmClearData('Clear-data reset disarmed. Local data remains untouched.');
                }}
                disabled={recoveryControlsDisabled}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#e4e4e7',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.5rem',
                  cursor: recoveryControlsDisabled ? 'wait' : 'pointer',
                  opacity: recoveryControlsDisabled ? 0.7 : 1
                }}
              >
                Disarm clear-data reset
              </button>
            ) : null}
          </div>
          {!clearDataUnlocked ? (
            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                lineHeight: '1.5',
                color: '#fecaca'
              }}
            >
              Unlock requires either a successful export in this crash session or the explicit delete acknowledgment above.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
