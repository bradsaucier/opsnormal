interface SectionCrashFallbackProps {
  label: string;
  error: Error;
  onRetry: () => void;
}

export function SectionCrashFallback({ label, error, onRetry }: SectionCrashFallbackProps) {
  return (
    <div className="rounded-2xl border border-orange-400/25 bg-orange-400/5 p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-orange-300/90 uppercase">
        Section fault
      </p>
      <p className="mt-2 text-sm font-semibold tracking-[0.06em] text-zinc-100 uppercase">
        {label} failed to render
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        This section crashed but the rest of the app is still running. Your data is safe.
      </p>
      <p className="mt-2 font-mono text-xs leading-5 text-orange-300/80 break-words">
        {error.message}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={reloadCurrentPage}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function reloadCurrentPage() {
  window.location.reload();
}
