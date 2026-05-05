import { useEffect, useRef } from 'react';

import { getErrorMessage } from '../lib/errors';
import { reloadCurrentPage } from '../lib/runtime';
import { NotchedFrame } from './NotchedFrame';

interface SectionCrashFallbackProps {
  sectionName: string;
  error: Error;
  componentStack?: string;
  onRetry: () => void;
}

export function SectionCrashFallback({
  sectionName,
  error,
  componentStack,
  onRetry,
}: SectionCrashFallbackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
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
          {sectionName} offline
        </h2>
        <p className="mt-2 text-sm leading-6 text-ops-text-secondary">
          This section crashed, but the rest of OpsNormal is still online. Retry
          the section or reload the page. Local data on this device remains
          under the normal browser storage limits and risks.
        </p>
        <p className="mt-3 font-mono text-xs leading-5 text-[var(--ops-status-degraded-text)] break-words">
          {getErrorMessage(error, 'Unknown render failure.')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="ops-action-button ops-action-button-amber"
          >
            Retry section
          </button>
          <button
            type="button"
            onClick={reloadCurrentPage}
            className="ops-action-button ops-action-button-subtle"
          >
            Reload page
          </button>
        </div>
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
  );
}
