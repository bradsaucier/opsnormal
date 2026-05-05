import { StatusBadge } from './StatusBadge';

export function StatusLegend() {
  return (
    <div className="ops-mono ops-flat-panel ops-tracking-grid grid gap-2 px-3 py-2 text-[11px] text-ops-text-muted uppercase">
      <p className="ops-eyebrow text-[10px] leading-none text-ops-text-muted">
        Legend
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="nominal" size="sm" />
          <span>Nominal</span>
        </div>
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="degraded" size="sm" />
          <span>Degraded</span>
        </div>
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="unmarked" size="sm" />
          <span>Unmarked</span>
        </div>
      </div>
    </div>
  );
}
