import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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
  default: 'text-ops-text-primary',
  accent: 'text-ops-accent-muted',
  attention:
    'bg-[var(--ops-status-degraded-bg)] text-[var(--ops-status-degraded-text)]',
  subtle: 'text-ops-text-secondary',
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
  isShimmering = false,
  tone = 'default',
}: {
  detail?: string;
  isShimmering?: boolean;
  label: string;
  tone?: TelemetryTone;
  value: string;
}) {
  return (
    <div
      className={[
        'ops-telemetry-chip flex min-h-[var(--ops-chip-min-h-lg)] flex-col justify-between px-3 py-3.5 text-left lg:px-4',
        isShimmering ? 'ops-telemetry-chip-shimmer' : '',
        toneClassNameByTone[tone],
      ].join(' ')}
    >
      <span className="ops-eyebrow flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-ops-text-muted">
        {tone === 'attention' ? (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--ops-status-degraded-border)]"
            aria-hidden="true"
          />
        ) : null}
        <span>{label}</span>
      </span>
      <span className="mt-2 text-2xl leading-none font-semibold tracking-[0.02em] [font-variant-numeric:tabular-nums] sm:text-3xl">
        {value}
      </span>
      {detail ? (
        <span className="mt-2 text-[10px] leading-4 tracking-[0.12em] text-ops-text-muted uppercase">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function TelemetryHorizon({ children }: { children: ReactNode }) {
  return (
    <div className="ops-flat-panel">
      <div className="border-b border-ops-border-soft px-3 py-2 lg:px-4">
        <p className="ops-eyebrow text-[10px] font-semibold text-ops-text-muted">
          Status horizon - 30-day local picture
        </p>
      </div>
      <div className="ops-telemetry-grid grid grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
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
  const previousStreakRef = useRef(streak);
  const [isStreakShimmering, setIsStreakShimmering] = useState(false);

  useEffect(() => {
    if (streak > previousStreakRef.current) {
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        previousStreakRef.current = streak;
        return undefined;
      }

      const showTimeoutId = window.setTimeout(() => {
        setIsStreakShimmering(true);
      }, 0);

      const hideTimeoutId = window.setTimeout(() => {
        setIsStreakShimmering(false);
      }, 850);

      previousStreakRef.current = streak;
      return () => {
        window.clearTimeout(showTimeoutId);
        window.clearTimeout(hideTimeoutId);
      };
    }

    previousStreakRef.current = streak;
    return undefined;
  }, [streak]);

  return (
    <TelemetryHorizon>
      <TelemetryChip
        label="Streak"
        value={`${streak}D`}
        tone="accent"
        isShimmering={isStreakShimmering}
      />
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
    </TelemetryHorizon>
  );
}

export function HeaderTelemetryFallback({
  lastBackupAt,
  storageHealth,
}: Pick<HeaderTelemetryProps, 'lastBackupAt' | 'storageHealth'>) {
  return (
    <TelemetryHorizon>
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
    </TelemetryHorizon>
  );
}
