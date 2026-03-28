import { useEffect, useMemo, useRef, useState } from 'react';

import { DomainCard } from '../../components/DomainCard';
import { SectionCard } from '../../components/SectionCard';
import { useEntriesForDate } from '../../db/hooks';
import { cycleDailyStatus } from '../../db/appDb';
import { formatLongDate } from '../../lib/date';
import { computeCompletionState, createEntryLookup, getUiStatus } from '../../lib/history';
import { getStatusLabel } from '../../lib/status';
import { SECTORS, type SectorId } from '../../types';

interface TodayPanelProps {
  todayKey: string;
  onMeaningfulSave?: () => void;
}

export function TodayPanel({ todayKey, onMeaningfulSave }: TodayPanelProps) {
  const entries = useEntriesForDate(todayKey);
  const [busySectorId, setBusySectorId] = useState<SectorId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const persistRequestedRef = useRef(false);

  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const completion = useMemo(() => computeCompletionState(entries, todayKey), [entries, todayKey]);

  useEffect(() => {
    if (!announcement) {
      return;
    }

    const timerId = window.setTimeout(() => setAnnouncement(''), 1500);
    return () => window.clearTimeout(timerId);
  }, [announcement]);

  async function handleCycle(sectorId: SectorId) {
    try {
      setErrorMessage(null);
      setBusySectorId(sectorId);
      const nextStatus = await cycleDailyStatus(todayKey, sectorId);
      const sector = SECTORS.find((candidate) => candidate.id === sectorId);
      const sectorLabel = sector?.label ?? sectorId;
      setAnnouncement(`${sectorLabel} set to ${getStatusLabel(nextStatus)}.`);

      if (!persistRequestedRef.current) {
        persistRequestedRef.current = true;
        onMeaningfulSave?.();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Local save failed. Export your data, then reload the app.'
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
      <p className="sr-only" aria-live="polite" aria-atomic="true" role="status">
        {announcement}
      </p>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTORS.map((sector) => (
          <DomainCard
            key={sector.id}
            sector={sector}
            status={getUiStatus(entryLookup, todayKey, sector.id)}
            busy={busySectorId === sector.id}
            onCycle={handleCycle}
          />
        ))}
      </div>
    </SectionCard>
  );
}
