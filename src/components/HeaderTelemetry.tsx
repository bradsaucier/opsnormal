import { useMemo } from 'react';

import { useEntriesForDateRange } from '../db/hooks';
import { computeCheckInStreak, computeCompletionState } from '../lib/history';
import type { StorageHealth } from '../lib/storage';

interface HeaderTelemetryProps {
  dateKeys: string[];
  lastBackupAt: string | null;
  storageHealth: StorageHealth | null;
  todayKey: string;
}

type TelemetryTone = 'default' | 'accent' | 'attention' | 'subtle';

const toneClassNameByTone: Record<TelemetryTone, string> = {
  default: 'border-ops-border-soft text-ops-text-primary',
  accent: 'border-ops-accent/40 text-ops-accent-muted',
  attention: 'border-amber-300/44 bg-amber-300/[0.08] text-amber-100',
  subtle: 'border-ops-border-soft text-ops-text-secondary',
};

function formatLastBackupAge(lastBackupAt: string | null) {
  if (!lastBackupAt) {
    return 'Never';
  }

  const lastBackupTime = Date.parse(lastBackupAt);

  if (Number.isNaN(lastBackupTime)) {
    return 'Unknown';
  }

  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - lastBackupTime) / (24 * 60 * 60 * 1000)),
  );

  if (elapsedDays === 0) {
    return 'Today';
  }

  return `${elapsedDays}D ago`;
}

function TelemetryChip({
  label,
  value,
  detail,
  tone = 'default',
}: {
  detail?: string;
  label: string;
  tone?: TelemetryTone;
  value: string;
}) {
  return (
    <div
      className={[
        'ops-telemetry-chip clip-notched ops-notch-chip tactical-chip-panel flex min-h-[4rem] flex-col justify-between border px-3 py-3 text-left',
        toneClassNameByTone[tone],
      ].join(' ')}
    >
      <span className="text-[10px] font-semibold tracking-[0.14em] text-ops-text-muted uppercase">
        {label}
      </span>
      <span className="mt-1.5 text-lg leading-none font-semibold tracking-[0.06em] uppercase [font-variant-numeric:tabular-nums] sm:text-xl">
        {value}
      </span>
      {detail ? (
        <span className="mt-1.5 text-[10px] leading-4 tracking-[0.1em] text-ops-text-muted uppercase">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

export function HeaderTelemetry({
  dateKeys,
  lastBackupAt,
  storageHealth,
  todayKey,
}: HeaderTelemetryProps) {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;
  const entries = useEntriesForDateRange(startDate, endDate);
  const completion = useMemo(
    () => computeCompletionState(entries, todayKey),
    [entries, todayKey],
  );
  const streak = useMemo(
    () => computeCheckInStreak(entries, todayKey),
    [entries, todayKey],
  );
  const lastBackupLabel = formatLastBackupAge(lastBackupAt);

  return (
    <div className="grid w-full grid-cols-2 gap-2 lg:min-w-[20rem] lg:max-w-sm">
      <TelemetryChip label="Streak" value={`${streak}D`} tone="accent" />
      <TelemetryChip
        label="Today"
        value={`${completion.markedCount}/${completion.totalCount}`}
        detail={completion.isComplete ? 'Complete' : 'Open'}
      />
      <TelemetryChip
        label="Data posture"
        value="Local only"
        detail={storageHealth ? 'Storage checked' : 'Assessing'}
        tone="accent"
      />
      <TelemetryChip
        label="Last backup"
        value={lastBackupLabel}
        tone={lastBackupAt ? 'subtle' : 'attention'}
      />
    </div>
  );
}

export function HeaderTelemetryFallback({
  lastBackupAt,
  storageHealth,
}: Pick<HeaderTelemetryProps, 'lastBackupAt' | 'storageHealth'>) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 lg:min-w-[20rem] lg:max-w-sm">
      <TelemetryChip label="Streak" value="0D" tone="accent" />
      <TelemetryChip label="Today" value="0/5" detail="Assessing" />
      <TelemetryChip
        label="Data posture"
        value="Local only"
        detail={storageHealth ? 'Storage checked' : 'Assessing'}
        tone="accent"
      />
      <TelemetryChip
        label="Last backup"
        value={formatLastBackupAge(lastBackupAt)}
        tone={lastBackupAt ? 'subtle' : 'attention'}
      />
    </div>
  );
}
