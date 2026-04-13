import { Fragment, useEffect, useRef, useState } from 'react';

import {
  exportEmergencyCsvBackup,
  exportEmergencyJsonBackup,
} from '../lib/emergencyExport';
import { getErrorMessage } from '../lib/errors';
import { reloadCurrentPage } from '../lib/runtime';

type BusyAction = 'json' | 'csv' | null;

interface ExportPanelCrashFallbackProps {
  error: Error;
  componentStack?: string;
  onRetry: () => void;
}

function formatEntryCount(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'} recovered.`;
}

function formatSkippedCount(count: number): string {
  return `${count} malformed ${count === 1 ? 'row' : 'rows'} skipped.`;
}

function formatEmergencyExportMessage(
  formatLabel: 'JSON' | 'CSV',
  recoveredCount: number,
  skippedCount: number,
): string {
  if (skippedCount === 0) {
    return `Emergency ${formatLabel} export complete. ${formatEntryCount(recoveredCount)}`;
  }

  return `Emergency ${formatLabel} export complete. ${formatEntryCount(recoveredCount)} ${formatSkippedCount(skippedCount)}`;
}

export function ExportPanelCrashFallback({
  error,
  componentStack,
  onRetry,
}: ExportPanelCrashFallbackProps) {
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState(
    'Backup and restore crashed. Use an emergency export before retrying if you need an external copy of local data.',
  );
  const [showManualInspectionGuidance, setShowManualInspectionGuidance] =
    useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  async function handleJsonExport() {
    try {
      setBusyAction('json');
      const result = await exportEmergencyJsonBackup();
      setShowManualInspectionGuidance(false);
      setMessage(
        formatEmergencyExportMessage(
          'JSON',
          result.recoveredCount,
          result.skippedCount,
        ),
      );
    } catch (exportError: unknown) {
      setShowManualInspectionGuidance(true);
      setMessage(
        getErrorMessage(
          exportError,
          'Emergency JSON export failed. Inspect browser DevTools, then Application, then IndexedDB for manual recovery.',
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCsvExport() {
    try {
      setBusyAction('csv');
      const result = await exportEmergencyCsvBackup();
      setShowManualInspectionGuidance(false);
      setMessage(
        formatEmergencyExportMessage(
          'CSV',
          result.recoveredCount,
          result.skippedCount,
        ),
      );
    } catch (exportError: unknown) {
      setShowManualInspectionGuidance(true);
      setMessage(
        getErrorMessage(
          exportError,
          'Emergency CSV export failed. Inspect browser DevTools, then Application, then IndexedDB for manual recovery.',
        ),
      );
    } finally {
      setBusyAction(null);
    }
  }

  const controlsDisabled = busyAction !== null;

  return (
    <Fragment>
      <div
        ref={containerRef}
        role="alert"
        aria-atomic="true"
        tabIndex={-1}
        className="rounded-2xl border border-orange-400/25 bg-orange-400/5 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
      >
        <p className="text-xs font-semibold tracking-[0.16em] text-orange-300/90 uppercase">
          Section fault
        </p>
        <h2 className="mt-2 text-sm font-semibold tracking-[0.06em] text-zinc-100 uppercase">
          Backup and Recovery offline
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          This panel crashed, but the rest of OpsNormal is still online.
          Emergency export stays available through the isolated crash-export
          recovery path.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-300">{message}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleJsonExport()}
            disabled={controlsDisabled}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-emerald-100 uppercase transition hover:bg-emerald-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'json' ? 'Exporting JSON' : 'Emergency JSON export'}
          </button>
          <button
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={controlsDisabled}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-emerald-100 uppercase transition hover:bg-emerald-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'csv' ? 'Exporting CSV' : 'Emergency CSV export'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={controlsDisabled}
            className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retry section
          </button>
          <button
            type="button"
            onClick={reloadCurrentPage}
            disabled={controlsDisabled}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reload page
          </button>
        </div>
        {showManualInspectionGuidance ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-300">
            If emergency export still fails, inspect browser DevTools, then
            Application, then IndexedDB, then the opsnormal database for manual
            recovery.
          </p>
        ) : null}
        <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
          <summary className="cursor-pointer font-semibold tracking-[0.08em] text-zinc-100 uppercase">
            Fault details
          </summary>
          <p className="mt-3 font-mono text-xs leading-5 text-zinc-300 break-words">
            {getErrorMessage(error, 'Unknown render failure.')}
          </p>
          {componentStack ? (
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-400">
              {componentStack.trim()}
            </pre>
          ) : null}
        </details>
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </div>
    </Fragment>
  );
}
