import { StatusBadge } from './StatusBadge';

export function StatusLegend() {
  return (
    <div className="ops-mono clip-notched ops-notch-chip tactical-chip-panel grid gap-2 px-3 py-2 text-[11px] tracking-[0.12em] text-ops-text-muted uppercase">
      <p className="ops-eyebrow text-[10px] leading-none text-ops-text-muted">
        Legend
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="nominal" compact />
          <span>Nominal</span>
        </div>
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="degraded" compact />
          <span>Degraded</span>
        </div>
        <div className="grid justify-items-start gap-1 whitespace-nowrap">
          <StatusBadge status="unmarked" compact />
          <span>Unmarked</span>
        </div>
      </div>
    </div>
  );
}
