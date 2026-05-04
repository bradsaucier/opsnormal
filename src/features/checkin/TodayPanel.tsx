import { useId, useMemo, useRef, useState } from 'react';

import { AlertSurface } from '../../components/AlertSurface';
import { DomainCard } from '../../components/DomainCard';
import { SectionCard } from '../../components/SectionCard';
import { SectorGlyphConstellation } from '../../components/SectorGlyphConstellation';
import { SectorGlyphMark } from '../../components/icons/SectorGlyphs';
import { useEntriesForDate } from '../../db/hooks';
import { setDailyStatus } from '../../db/appDb';
import { formatDateKey, formatLongDate } from '../../lib/date';
import {
  computeCompletionState,
  createEntryLookup,
  getUiStatus,
} from '../../lib/history';
import { getStatusLabel } from '../../lib/status';
import { SECTORS, type SectorId, type UiStatus } from '../../types';

interface TodayPanelProps {
  todayKey: string;
  onDateRollover?: () => void;
  onMeaningfulSave?: () => void;
  onAnnounce?: (message: string) => void;
}

interface DayCompletionRollupProps {
  isComplete: boolean;
  markedCount: number;
  statuses: UiStatus[];
  totalCount: number;
}

function getRollupPipClassName(status: UiStatus): string {
  if (status === 'nominal') {
    return 'border-[var(--ops-status-nominal-border)] bg-[var(--ops-status-nominal-bg)]';
  }

  if (status === 'degraded') {
    return 'border-[var(--ops-status-degraded-border)] bg-[var(--ops-status-degraded-bg)]';
  }

  return 'border-[var(--ops-status-unmarked-border)] bg-[var(--ops-status-unmarked-bg)]';
}

function DayCompletionRollup({
  isComplete,
  markedCount,
  statuses,
  totalCount,
}: DayCompletionRollupProps) {
  const remainingCount = Math.max(totalCount - markedCount, 0);

  return (
    <div className="panel-shadow mb-4 clip-notched ops-notch-panel-outer tactical-subpanel-strong ops-rollup-spine grid gap-4 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-[8rem]">
        <p className="ops-eyebrow-mixed">Daily roll-up</p>
        <p className="mt-2 text-3xl leading-none font-semibold tracking-[0.06em] text-ops-text-primary uppercase [font-variant-numeric:tabular-nums]">
          {markedCount}/{totalCount}
        </p>
      </div>
      <div className="text-sm leading-6 text-ops-text-secondary">
        {isComplete
          ? 'All five sectors are marked for today.'
          : `${remainingCount} sector${remainingCount === 1 ? '' : 's'} still open.`}
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <span
          className={[
            'ops-status-frame clip-notched ops-notch-chip inline-flex min-h-8 items-center border px-3 text-xs font-semibold tracking-[0.14em] uppercase',
            isComplete ? 'ops-complete-badge' : '',
            isComplete ? 'ops-status-nominal' : 'ops-status-unmarked',
          ].join(' ')}
        >
          {isComplete ? 'Complete' : 'Open'}
        </span>
        <div
          className="flex items-center gap-1.5"
          aria-label="Today sector status pips"
        >
          {SECTORS.map((sector, index) => (
            <span
              key={sector.id}
              className={[
                'clip-notched ops-notch-chip inline-flex h-4 w-7 items-center justify-center border',
                getRollupPipClassName(statuses[index] ?? 'unmarked'),
              ].join(' ')}
              title={sector.label}
            >
              <span className="sr-only">{sector.label}</span>
              <span className="text-[9px] leading-none text-ops-text-primary/80">
                <SectorGlyphMark sectorId={sector.id} />
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodayPanel({
  todayKey,
  onDateRollover,
  onMeaningfulSave,
  onAnnounce,
}: TodayPanelProps) {
  const entries = useEntriesForDate(todayKey);
  const directSelectHintId = useId();
  const [busySectorId, setBusySectorId] = useState<SectorId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackAnnouncement, setFallbackAnnouncement] = useState<string>('');
  const persistRequestedRef = useRef(false);

  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const hasEntriesForToday = entries.length > 0;
  const completion = useMemo(
    () => computeCompletionState(entries, todayKey),
    [entries, todayKey],
  );
  const todaySectorStatuses = useMemo(
    () =>
      SECTORS.map((sector) => getUiStatus(entryLookup, todayKey, sector.id)),
    [entryLookup, todayKey],
  );

  function announce(message: string) {
    onAnnounce?.(message);

    if (!onAnnounce) {
      setFallbackAnnouncement((currentMessage) => {
        if (currentMessage.trimEnd() !== message) {
          return message;
        }

        return currentMessage.endsWith(' ') ? message : `${message} `;
      });
    }
  }

  async function handleSelectStatus(sectorId: SectorId, nextStatus: UiStatus) {
    try {
      setErrorMessage(null);
      setBusySectorId(sectorId);

      const writeDateKey = formatDateKey();
      const savedStatus = await setDailyStatus(
        writeDateKey,
        sectorId,
        nextStatus,
      );

      if (writeDateKey !== todayKey) {
        onDateRollover?.();
      }

      const sector = SECTORS.find((candidate) => candidate.id === sectorId);
      const sectorLabel = sector?.label ?? sectorId;
      announce(`${sectorLabel} set to ${getStatusLabel(savedStatus)}.`);

      if (!persistRequestedRef.current) {
        persistRequestedRef.current = true;
        onMeaningfulSave?.();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Local save failed. Export your data, then reload the app.',
      );
    } finally {
      setBusySectorId(null);
    }
  }

  return (
    <SectionCard
      eyebrow="Daily Check-In"
      title="Today"
      emphasis="primary"
      meta={
        <div className="flex flex-col items-end gap-2 text-right">
          <div>{formatLongDate(todayKey)}</div>
          <span
            className={[
              'ops-status-frame clip-notched ops-notch-chip inline-flex min-h-7 items-center border px-2.5 text-xs font-semibold tracking-[0.14em] uppercase [font-variant-numeric:tabular-nums]',
              completion.isComplete
                ? 'ops-status-nominal'
                : 'ops-status-unmarked',
            ].join(' ')}
          >
            {completion.markedCount}/{completion.totalCount} sectors
          </span>
        </div>
      }
    >
      {!onAnnounce ? (
        <p
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {fallbackAnnouncement}
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mb-4">
          <AlertSurface
            tone="warning"
            title="Local save failed"
            description={errorMessage}
            as="div"
            role="alert"
            aria-atomic="true"
          />
        </div>
      ) : null}

      {!hasEntriesForToday ? (
        <div className="panel-shadow mb-4 clip-notched ops-notch-panel-outer tactical-subpanel-strong relative px-4 py-3">
          <SectorGlyphConstellation />
          <div className="relative z-10 max-w-2xl">
            <p className="ops-eyebrow-mixed">Awaiting first mark</p>
            <p className="mt-2 text-sm leading-6 text-ops-text-secondary">
              No sectors are marked for today. Set one state below and the daily
              roll-up will start tracking live progress.
            </p>
          </div>
        </div>
      ) : null}

      <div
        id={directSelectHintId}
        className="mb-4 clip-notched ops-notch-panel-outer tactical-subpanel px-4 py-3 text-sm leading-6 text-ops-text-secondary"
      >
        Choose a state directly. Arrow keys move inside the control group.
        Unmarked means no status recorded for the day. Nominal and degraded are
        deliberate check-ins, not automatic carry-forward.
      </div>

      <DayCompletionRollup
        isComplete={completion.isComplete}
        markedCount={completion.markedCount}
        statuses={todaySectorStatuses}
        totalCount={completion.totalCount}
      />

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 lg:gap-5 xl:grid-cols-5">
        {SECTORS.map((sector, index) => (
          <div key={sector.id}>
            <DomainCard
              sector={sector}
              sectorSigil={`S${index + 1}`}
              instructionId={directSelectHintId}
              status={getUiStatus(entryLookup, todayKey, sector.id)}
              busy={busySectorId === sector.id}
              onSelect={handleSelectStatus}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
