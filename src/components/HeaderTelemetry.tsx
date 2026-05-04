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
        'ops-telemetry-chip flex min-h-[var(--ops-chip-min-h-lg)] flex-col justify-between px-3 py-3 text-left lg:px-4',
        isShimmering ? 'ops-telemetry-chip-shimmer' : '',
        toneClassNameByTone[tone],
      ].join(' ')}
    >
      <span className="ops-eyebrow text-[10px] font-semibold text-ops-text-muted">
        {label}
      </span>
      <span className="mt-2 text-2xl leading-none font-semibold tracking-[0.04em] uppercase [font-variant-numeric:tabular-nums] sm:text-3xl">
        {value}
      </span>
      {detail ? (
        <span className="mt-2 text-[10px] leading-4 tracking-[0.10em] text-ops-text-muted uppercase">
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function TelemetryHorizon({ children }: { children: ReactNode }) {
  return (
    <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
      <div className="clip-notched ops-notch-panel-inner tactical-subpanel bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(110,231,183,0.035)_32%,rgba(255,255,255,0)_54%),var(--color-ops-surface-overlay)]">
        <div className="grid lg:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="border-b border-ops-border-soft px-3 py-3 lg:border-r lg:border-b-0 lg:px-4">
            <p className="ops-eyebrow-strong ops-mono text-xs font-semibold text-ops-accent-muted">
              Status horizon
            </p>
            <p className="mt-1 text-[10px] leading-4 tracking-[0.12em] text-ops-text-muted uppercase">
              30-day local picture
            </p>
          </div>
          <div className="ops-telemetry-grid grid grid-cols-2 lg:grid-cols-4">
            {children}
          </div>
        </div>
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
