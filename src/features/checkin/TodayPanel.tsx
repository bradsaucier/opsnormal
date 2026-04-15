import { useId, useMemo, useRef, useState } from 'react';

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
      meta={
        <div className="space-y-1 text-right">
          <div>{formatLongDate(todayKey)}</div>
          <div className="text-xs tracking-[0.16em] text-zinc-500 uppercase">
            {completion.markedCount}/{completion.totalCount} sectors checked
          </div>
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
        <div className="mb-4 clip-notched ops-notch-panel-outer bg-orange-500/30 p-px">
          <div className="clip-notched ops-notch-panel-inner bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
            {errorMessage}
          </div>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTORS.map((sector, index) => (
          <DomainCard
            key={sector.id}
            sector={sector}
            sectorSigil={`S${index + 1}`}
            instructionId={directSelectHintId}
            status={getUiStatus(entryLookup, todayKey, sector.id)}
            busy={busySectorId === sector.id}
            onSelect={handleSelectStatus}
          />
        ))}
      </div>
    </SectionCard>
  );
}
