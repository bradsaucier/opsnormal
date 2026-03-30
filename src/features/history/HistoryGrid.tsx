import { useMemo } from 'react';

import { SectionCard } from '../../components/SectionCard';
import { StatusLegend } from '../../components/StatusLegend';
import { useEntriesForDateRange } from '../../db/hooks';
import { formatDayLabel } from '../../lib/date';
import { computeCheckInStreak, createEntryLookup, getUiStatus } from '../../lib/history';
import { getStatusCellText, getStatusLabel } from '../../lib/status';
import { SECTORS } from '../../types';

interface HistoryGridProps {
  dateKeys: string[];
  todayKey: string;
}

function getCellClassName(status: ReturnType<typeof getUiStatus>) {
  if (status === 'nominal') {
    return 'border-sky-400/40 bg-sky-400/12 text-sky-200';
  }

  if (status === 'degraded') {
    return 'border-orange-400/45 bg-orange-400/12 text-orange-200';
  }

  return 'border-ops-border-soft bg-ops-base text-ops-text-muted';
}

export function HistoryGrid({ dateKeys, todayKey }: HistoryGridProps) {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;

  const entries = useEntriesForDateRange(startDate, endDate);
  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const streak = useMemo(() => computeCheckInStreak(entries, todayKey), [entries, todayKey]);
  const captionId = 'history-grid-caption';

  return (
    <SectionCard
      eyebrow="Rolling History"
      title="30-Day Readiness Grid"
      meta={
        <div className="space-y-1 text-right">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-ops-text-primary">
            {streak} day streak
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-ops-text-muted">
            Full daily check-ins
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="max-w-2xl text-sm leading-6 text-ops-text-secondary">
            This grid is the mirror. Patterns matter more than extra instrumentation.
          </p>
          <p className="text-xs tracking-[0.14em] text-ops-text-muted uppercase">
            Scroll on narrow screens for the full 30-day window.
          </p>
        </div>
        <StatusLegend />
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 z-40 h-full w-6 bg-gradient-to-l from-ops-surface-1 to-transparent"
        />
        <div
          className="history-scroll-shell overflow-x-auto rounded-xl border border-ops-border-struct bg-ops-base/80"
          role="region"
          aria-labelledby={captionId}
          tabIndex={0}
        >
          <table className="min-w-max w-full border-separate border-spacing-0 text-sm">
            <caption id={captionId} className="sr-only">
              Thirty-day readiness grid with one row per sector and one column per day. Cell labels use
              OK for nominal, DG for degraded, and UN for unmarked.
            </caption>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-ops-border-struct bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-secondary">
                  Sector
                </th>
                {dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    className={[
                      'sticky top-0 z-20 border-b border-ops-border-struct px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em]',
                      dateKey === todayKey
                        ? 'bg-emerald-300/10 text-ops-accent-muted'
                        : 'bg-ops-surface-1 text-ops-text-secondary'
                    ].join(' ')}
                    scope="col"
                  >
                    {formatDayLabel(dateKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTORS.map((sector) => (
                <tr key={sector.id} className="odd:bg-white/[0.04] even:bg-white/[0.02]">
                  <th
                    className="sticky left-0 z-20 border-b border-r border-ops-border-soft bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-primary"
                    scope="row"
                  >
                    {sector.label}
                  </th>
                  {dateKeys.map((dateKey) => {
                    const status = getUiStatus(entryLookup, dateKey, sector.id);

                    return (
                      <td
                        key={`${sector.id}:${dateKey}`}
                        className={[
                          'border-b border-ops-border-soft px-2 py-2',
                          dateKey === todayKey ? 'bg-emerald-300/[0.08]' : ''
                        ].join(' ')}
                      >
                        <div
                          title={`${sector.label} on ${dateKey}: ${getStatusLabel(status)}`}
                          aria-label={`${sector.label} on ${dateKey}: ${getStatusLabel(status)}`}
                          className={[
                            'mx-auto flex h-11 w-11 items-center justify-center rounded-md border text-[11px] font-semibold tracking-[0.08em]',
                            dateKey === todayKey ? 'ring-1 ring-inset ring-emerald-300/20' : '',
                            getCellClassName(status)
                          ].join(' ')}
                        >
                          {getStatusCellText(status)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}
