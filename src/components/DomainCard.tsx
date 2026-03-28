import type { Sector, UiStatus } from '../types';
import { getNextStatus, getStatusLabel } from '../lib/status';
import { StatusBadge } from './StatusBadge';

interface DomainCardProps {
  sector: Sector;
  status: UiStatus;
  busy?: boolean;
  onCycle: (sectorId: Sector['id']) => Promise<void>;
}

export function DomainCard({ sector, status, busy = false, onCycle }: DomainCardProps) {
  const buttonText = busy ? 'SAVING' : 'CYCLE';
  const statusLabel = getStatusLabel(status);
  const nextStatusLabel = getStatusLabel(getNextStatus(status));

  return (
    <button
      type="button"
      onClick={() => void onCycle(sector.id)}
      disabled={busy}
      className="group flex min-h-28 w-full flex-col justify-between rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-left transition hover:border-emerald-400/40 hover:bg-zinc-900/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-70"
      aria-label={`${sector.label}. Current state ${statusLabel}. Activate to change to ${nextStatusLabel}.`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-[0.24em] text-zinc-500 uppercase">
            {sector.shortLabel}
          </span>
          <h3 className="mt-2 text-base font-semibold tracking-[0.06em] text-white uppercase">
            {sector.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{sector.description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs tracking-[0.16em] text-zinc-400 uppercase">
        <span>{buttonText}</span>
        <span>{statusLabel}</span>
      </div>
    </button>
  );
}
