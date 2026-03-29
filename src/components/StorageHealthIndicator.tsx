import { formatStorageSummary, type StorageHealth } from '../lib/storage';

interface StorageHealthIndicatorProps {
  storageHealth: StorageHealth | null;
}

export function StorageHealthIndicator({ storageHealth }: StorageHealthIndicatorProps) {
  const toneClasses =
    storageHealth?.status === 'warning'
      ? 'border-orange-400/35 bg-orange-400/10 text-orange-100'
      : storageHealth?.status === 'monitor'
        ? 'border-amber-400/25 bg-amber-400/8 text-amber-50'
        : 'border-white/10 bg-black/25 text-zinc-300';

  return (
    <div
      className={`rounded-xl border p-4 ${toneClasses}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-xs font-semibold tracking-[0.16em] uppercase text-zinc-400">
        Storage durability
      </p>
      <p className="mt-2 text-sm leading-6">{storageHealth?.message ?? 'Assessing local storage posture.'}</p>
      <p className="mt-2 text-xs tracking-[0.14em] uppercase text-zinc-500">
        {storageHealth ? formatStorageSummary(storageHealth) : 'Telemetry pending'}
      </p>
    </div>
  );
}
