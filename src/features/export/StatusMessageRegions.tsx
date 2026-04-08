import type { StatusMessage } from './workflowTypes';

interface StatusMessageRegionsProps {
  statusMessage: StatusMessage;
}

export function StatusMessageRegions({ statusMessage }: StatusMessageRegionsProps) {
  const passiveStatusText =
    statusMessage.tone === 'info' || statusMessage.tone === 'success' ? statusMessage.text : '';
  const alertStatusText =
    statusMessage.tone === 'warning' || statusMessage.tone === 'error' ? statusMessage.text : '';

  const passiveStatusClasses =
    statusMessage.tone === 'success'
      ? 'rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100'
      : 'rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300';
  const alertStatusClasses =
    statusMessage.tone === 'error'
      ? 'rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm leading-6 text-red-100'
      : 'rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100';

  return (
    <div className="space-y-3">
      <div role="status" aria-atomic="true">
        {passiveStatusText ? <div className={passiveStatusClasses}>{passiveStatusText}</div> : null}
      </div>
      <div role="alert" aria-atomic="true">
        {alertStatusText ? <div className={alertStatusClasses}>{alertStatusText}</div> : null}
      </div>
    </div>
  );
}
