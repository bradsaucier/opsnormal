import { Fragment, useEffect, useRef, useState } from 'react';

import {
  exportEmergencyCsvBackup,
  exportEmergencyJsonBackup,
} from '../lib/emergencyExport';
import { getErrorMessage } from '../lib/errors';
import { reloadCurrentPage } from '../lib/runtime';
import { NotchedFrame } from './NotchedFrame';

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
      <NotchedFrame
        emphasis="support"
        innerClassName="tactical-subpanel-strong ops-section-spine-fault p-5"
      >
        <div
          ref={containerRef}
          role="alert"
          aria-atomic="true"
          tabIndex={-1}
          className="ops-focus-ring-inset"
        >
          <p className="ops-eyebrow text-xs font-semibold text-[var(--ops-status-degraded-text)]">
            Section fault
          </p>
          <h2 className="ops-tracking-title mt-2 text-sm font-semibold text-ops-text-primary uppercase">
            Backup and Recovery offline
          </h2>
          <p className="mt-2 text-sm leading-6 text-ops-text-secondary">
            This panel crashed, but the rest of OpsNormal is still online.
            Emergency export stays available through the isolated crash-export
            recovery path.
          </p>
          <p className="mt-3 text-sm leading-6 text-ops-text-secondary">
            {message}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleJsonExport()}
              disabled={controlsDisabled}
              className="ops-action-button ops-action-button-emerald-solid"
            >
              {busyAction === 'json'
                ? 'Exporting JSON'
                : 'Emergency JSON export'}
            </button>
            <button
              type="button"
              onClick={() => void handleCsvExport()}
              disabled={controlsDisabled}
              className="ops-action-button ops-action-button-emerald"
            >
              {busyAction === 'csv' ? 'Exporting CSV' : 'Emergency CSV export'}
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={controlsDisabled}
              className="ops-action-button ops-action-button-amber"
            >
              Retry section
            </button>
            <button
              type="button"
              onClick={reloadCurrentPage}
              disabled={controlsDisabled}
              className="ops-action-button ops-action-button-subtle"
            >
              Reload page
            </button>
          </div>
          {showManualInspectionGuidance ? (
            <p className="clip-notched ops-notch-chip tactical-chip-panel mt-4 px-4 py-3 text-sm leading-6 text-ops-text-secondary">
              If emergency export still fails, inspect browser DevTools, then
              Application, then IndexedDB, then the opsnormal database for
              manual recovery.
            </p>
          ) : null}
          <details className="clip-notched ops-notch-chip tactical-chip-panel mt-4 p-3 text-sm text-ops-text-secondary">
            <summary className="ops-details-summary ops-tracking-section flex cursor-pointer items-center justify-between gap-3 font-semibold text-ops-text-primary uppercase">
              <span>Fault details</span>
              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3 text-[var(--ops-status-degraded-text)]"
                fill="none"
                stroke="currentColor"
                strokeLinecap="square"
                strokeLinejoin="miter"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 2 L8 6 L4 10" />
              </svg>
            </summary>
            <p className="mt-3 font-mono text-xs leading-5 text-ops-text-secondary break-words">
              {getErrorMessage(error, 'Unknown render failure.')}
            </p>
            {componentStack ? (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-ops-text-muted">
                {componentStack.trim()}
              </pre>
            ) : null}
          </details>
        </div>
      </NotchedFrame>
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
