import { StatusBadge } from './StatusBadge';

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs tracking-[0.16em] text-zinc-400 uppercase">
      <div className="flex items-center gap-2">
        <StatusBadge status="nominal" compact />
        <span>Nominal</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status="degraded" compact />
        <span>Degraded</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status="unmarked" compact />
        <span>Unmarked</span>
      </div>
    </div>
  );
}
