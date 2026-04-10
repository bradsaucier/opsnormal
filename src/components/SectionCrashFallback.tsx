import { useEffect, useRef } from 'react';

import { getErrorMessage } from '../lib/errors';
import { reloadCurrentPage } from '../lib/runtime';

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
  onRetry
}: SectionCrashFallbackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
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
        {sectionName} offline
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        This section crashed, but the rest of OpsNormal is still online. Retry the section or reload the page. Local data on this device remains under the normal browser storage limits and risks.
      </p>
      <p className="mt-3 font-mono text-xs leading-5 text-orange-300/80 break-words">
        {getErrorMessage(error, 'Unknown render failure.')}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Retry section
        </button>
        <button
          type="button"
          onClick={reloadCurrentPage}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
        >
          Reload page
        </button>
      </div>
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
  );
}
