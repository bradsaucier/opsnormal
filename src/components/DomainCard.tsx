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

  const shellClassName = busy
    ? 'panel-shadow clip-notched bg-ops-border-strong p-px [--notch:12px]'
    : 'panel-shadow clip-notched bg-ops-border-strong p-px [--notch:12px] transition-colors hover:bg-emerald-200/18 focus-within:bg-emerald-200/22 focus-within:[--panel-ring:drop-shadow(0_0_0_2px_rgba(110,231,183,0.34))]';

  return (
    <div className={shellClassName}>
      <button
        type="button"
        onClick={() => void onCycle(sector.id)}
        disabled={busy}
        className="group clip-notched flex min-h-[11.5rem] w-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%),var(--color-ops-surface-1)] p-5 text-left transition hover:bg-ops-surface-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-ops-surface-1 [--notch:11px]"
        aria-label={`${sector.label}. Current state ${statusLabel}. Activate to change to ${nextStatusLabel}.`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-[0.24em] text-ops-text-muted uppercase">
              {sector.shortLabel}
            </span>
            <h3 className="mt-2 text-base font-semibold tracking-[0.04em] text-ops-text-primary uppercase">
              {sector.label}
            </h3>
            <p className="mt-3 text-sm leading-6 text-ops-text-secondary">{sector.description}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-ops-border-soft pt-4 text-xs tracking-[0.16em] text-ops-text-secondary uppercase">
          <span>{buttonText}</span>
          <span>{statusLabel}</span>
        </div>
      </button>
    </div>
  );
}
