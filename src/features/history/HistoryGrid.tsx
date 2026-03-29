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

export function HistoryGrid({ dateKeys, todayKey }: HistoryGridProps) {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;

  const entries = useEntriesForDateRange(startDate, endDate);
  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const streak = useMemo(() => computeCheckInStreak(entries, todayKey), [entries, todayKey]);

  return (
    <SectionCard
      eyebrow="Rolling History"
      title="30-Day Readiness Grid"
      meta={
        <div className="space-y-1 text-right">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
            {streak} day streak
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Full daily check-ins
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-zinc-300">
          This grid is the mirror. Patterns matter more than extra instrumentation.
        </p>
        <StatusLegend />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-max w-full border-collapse text-sm">
          <caption className="sr-only">
            Thirty-day readiness grid with one row per sector and one column per day. Cell labels use
            OK for nominal, DG for degraded, and UN for unmarked.
          </caption>
          <thead className="bg-white/5">
            <tr>
              <th className="sticky left-0 z-10 border-b border-white/10 bg-zinc-950 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Sector
              </th>
              {dateKeys.map((dateKey) => (
                <th
                  key={dateKey}
                  className={[
                    'border-b border-white/10 px-1 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em]',
                    dateKey === todayKey ? 'bg-emerald-500/[0.06] text-emerald-300' : 'text-zinc-400'
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
              <tr key={sector.id} className="odd:bg-white/[0.04]">
                <th
                  className="sticky left-0 z-10 border-b border-r border-white/10 bg-zinc-950 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300"
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
                        'border-b border-white/5 px-1 py-2',
                        dateKey === todayKey ? 'bg-emerald-500/[0.06]' : ''
                      ].join(' ')}
                    >
                      <div
                        title={`${sector.label} on ${dateKey}: ${getStatusLabel(status)}`}
                        aria-label={`${sector.label} on ${dateKey}: ${getStatusLabel(status)}`}
                        className={[
                          'mx-auto flex h-10 w-10 items-center justify-center rounded-md border text-xs font-bold tracking-[0.08em]',
                          status === 'nominal'
                            ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                            : '',
                          status === 'degraded'
                            ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                            : '',
                          status === 'unmarked'
                            ? 'border-zinc-700 bg-transparent text-zinc-300'
                            : ''
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
    </SectionCard>
  );
}
