import { StatusBadge } from './StatusBadge';

export function StatusLegend() {
  return (
    <div className="clip-notched ops-notch-chip tactical-chip-panel flex flex-wrap items-center gap-3 px-3 py-2 text-xs tracking-[0.16em] text-zinc-400 uppercase">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <StatusBadge status="nominal" compact />
        <span>Nominal</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <StatusBadge status="degraded" compact />
        <span>Degraded</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <StatusBadge status="unmarked" compact />
        <span>Unmarked</span>
      </div>
    </div>
  );
}
