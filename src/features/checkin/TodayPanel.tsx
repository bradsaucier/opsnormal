import { useId, useMemo, useRef, useState } from 'react';

import { AlertSurface } from '../../components/AlertSurface';
import { DomainCard } from '../../components/DomainCard';
import { SectionCard } from '../../components/SectionCard';
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

interface DayCompletionTileProps {
  isComplete: boolean;
  markedCount: number;
  totalCount: number;
}

function DayCompletionTile({
  isComplete,
  markedCount,
  totalCount,
}: DayCompletionTileProps) {
  const remainingCount = Math.max(totalCount - markedCount, 0);

  return (
    <div className="panel-shadow clip-notched ops-notch-panel-outer bg-ops-border-strong p-px">
      <div
        className={[
          'clip-notched ops-notch-panel-inner tactical-subpanel-strong flex min-h-[14rem] flex-col justify-between p-5',
          isComplete ? 'ops-sector-spine-nominal' : 'ops-sector-spine-unmarked',
        ].join(' ')}
      >
        <div>
          <p className="ops-eyebrow text-xs font-semibold tracking-[0.22em] text-ops-text-muted uppercase">
            Daily roll-up
          </p>
          <p className="mt-3 text-4xl leading-none font-semibold tracking-[0.06em] text-ops-text-primary uppercase [font-variant-numeric:tabular-nums]">
            {markedCount}/{totalCount}
          </p>
          <p className="mt-3 text-sm leading-6 text-ops-text-secondary">
            {isComplete
              ? 'All sectors are marked for today.'
              : `${remainingCount} sector${remainingCount === 1 ? '' : 's'} still open.`}
          </p>
        </div>
        <div className="mt-5 border-t border-ops-border-soft pt-3">
          <span
            className={[
              'ops-status-frame clip-notched ops-notch-chip inline-flex min-h-8 items-center border px-3 text-xs font-semibold tracking-[0.14em] uppercase',
              isComplete ? 'ops-status-nominal' : 'ops-status-unmarked',
            ].join(' ')}
          >
            {isComplete ? 'Complete' : 'Open'}
          </span>
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
  const completion = useMemo(
    () => computeCompletionState(entries, todayKey),
    [entries, todayKey],
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

      <div className="mb-4 clip-notched ops-notch-panel-outer bg-ops-panel-border p-px">
        <div
          id={directSelectHintId}
          className="clip-notched ops-notch-panel-inner tactical-subpanel px-4 py-3 text-sm leading-6 text-ops-text-secondary"
        >
          Choose a state directly. Arrow keys move inside the control group.
          Unmarked means no status recorded for the day. Nominal and degraded
          are deliberate check-ins, not automatic carry-forward.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-6">
        {SECTORS.map((sector, index) => (
          <div key={sector.id} className="xl:col-span-2">
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
        <div className="xl:col-span-2">
          <DayCompletionTile
            isComplete={completion.isComplete}
            markedCount={completion.markedCount}
            totalCount={completion.totalCount}
          />
        </div>
      </div>
    </SectionCard>
  );
}
