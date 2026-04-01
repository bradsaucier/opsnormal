import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { StatusLegend } from '../../components/StatusLegend';
import { useEntriesForDateRange } from '../../db/hooks';
import { formatDayLabel, formatLongDate } from '../../lib/date';
import { computeCheckInStreak, createEntryLookup, getUiStatus } from '../../lib/history';
import { getStatusCellText, getStatusLabel } from '../../lib/status';
import { SECTORS, type SectorId } from '../../types';

interface HistoryGridProps {
  dateKeys: string[];
  todayKey: string;
}

interface SelectedCell {
  dateKey: string;
  sectorId: SectorId;
}

const DEFAULT_SECTOR_ID = SECTORS[0].id;

function getCellClassName(status: ReturnType<typeof getUiStatus>) {
  if (status === 'nominal') {
    return 'border-sky-300/65 bg-sky-400/18 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
  }

  if (status === 'degraded') {
    return 'border-orange-300/65 bg-orange-400/18 text-orange-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
  }

  return 'border-ops-border-struct bg-ops-surface-3 text-ops-text-secondary';
}

function clampIndex(index: number, upperBound: number) {
  if (index < 0) {
    return 0;
  }

  if (index > upperBound) {
    return upperBound;
  }

  return index;
}

export function HistoryGrid({ dateKeys, todayKey }: HistoryGridProps) {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;

  const entries = useEntriesForDateRange(startDate, endDate);
  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const streak = useMemo(() => computeCheckInStreak(entries, todayKey), [entries, todayKey]);
  const captionId = 'history-grid-caption';
  const instructionsId = 'history-grid-instructions';
  const statusSummaryId = 'history-grid-status-summary';
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(() => ({
    dateKey: todayKey,
    sectorId: DEFAULT_SECTOR_ID
  }));

  useEffect(() => {
    const fallbackDateKey = dateKeys.includes(todayKey) ? todayKey : (dateKeys[dateKeys.length - 1] ?? todayKey);
    const selectedDateKey = dateKeys.includes(selectedCell.dateKey) ? selectedCell.dateKey : fallbackDateKey;
    const selectedSectorId = SECTORS.some((sector) => sector.id === selectedCell.sectorId)
      ? selectedCell.sectorId
      : DEFAULT_SECTOR_ID;

    if (
      selectedDateKey !== selectedCell.dateKey ||
      selectedSectorId !== selectedCell.sectorId
    ) {
      setSelectedCell({
        dateKey: selectedDateKey,
        sectorId: selectedSectorId
      });
    }
  }, [dateKeys, selectedCell.dateKey, selectedCell.sectorId, todayKey]);

  useEffect(() => {
    const scrollNode = scrollRef.current;

    if (!scrollNode) {
      return;
    }

    function updateScrollAffordance() {
      const remainingScroll = scrollNode.scrollWidth - scrollNode.clientWidth - scrollNode.scrollLeft;
      setCanScrollLeft(scrollNode.scrollLeft > 2);
      setCanScrollRight(remainingScroll > 2);
    }

    updateScrollAffordance();
    scrollNode.addEventListener('scroll', updateScrollAffordance, { passive: true });
    window.addEventListener('resize', updateScrollAffordance);

    return () => {
      scrollNode.removeEventListener('scroll', updateScrollAffordance);
      window.removeEventListener('resize', updateScrollAffordance);
    };
  }, [dateKeys]);

  const selectedSector = SECTORS.find((sector) => sector.id === selectedCell.sectorId) ?? SECTORS[0];
  const selectedStatus = getUiStatus(entryLookup, selectedCell.dateKey, selectedCell.sectorId);
  const selectedStatusLabel = getStatusLabel(selectedStatus);
  const selectedStatusSummary = `${selectedSector.label} on ${formatLongDate(selectedCell.dateKey)} is ${selectedStatusLabel}.`;

  function buildCellKey(sectorId: SectorId, dateKey: string) {
    return `${sectorId}:${dateKey}`;
  }

  function registerCellRef(cellKey: string, element: HTMLTableCellElement | null) {
    if (!element) {
      cellRefs.current.delete(cellKey);
      return;
    }

    cellRefs.current.set(cellKey, element);
  }

  function focusSelectedCell(nextSelection: SelectedCell) {
    const nextCell = cellRefs.current.get(buildCellKey(nextSelection.sectorId, nextSelection.dateKey));
    nextCell?.focus();
  }

  // The grid uses a roving tabindex so only the active coordinate is tabbable.
  // Arrow, Home, End, and Page keys move focus inside the matrix without adding extra tab stops.
  function handleCellKeyDown(
    event: KeyboardEvent<HTMLTableCellElement>,
    sectorIndex: number,
    dateIndex: number
  ) {
    let nextSelection: SelectedCell | null = null;

    switch (event.key) {
      case 'ArrowRight':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex + 1, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      case 'ArrowLeft':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex - 1, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      case 'ArrowDown':
        nextSelection = {
          sectorId: SECTORS[clampIndex(sectorIndex + 1, SECTORS.length - 1)]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[dateIndex] ?? selectedCell.dateKey
        };
        break;
      case 'ArrowUp':
        nextSelection = {
          sectorId: SECTORS[clampIndex(sectorIndex - 1, SECTORS.length - 1)]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[dateIndex] ?? selectedCell.dateKey
        };
        break;
      case 'Home':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[0] ?? selectedCell.dateKey
        };
        break;
      case 'End':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[dateKeys.length - 1] ?? selectedCell.dateKey
        };
        break;
      case 'PageUp':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex - 7, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      case 'PageDown':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex + 7, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      default:
        break;
    }

    if (!nextSelection) {
      return;
    }

    event.preventDefault();
    setSelectedCell(nextSelection);
    focusSelectedCell(nextSelection);
  }

  function handleCellSelection(nextSelection: SelectedCell) {
    setSelectedCell(nextSelection);
    focusSelectedCell(nextSelection);
  }

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
            Scroll on narrow screens for the full 30-day window. Select a cell for the detail brief.
          </p>
        </div>
        <StatusLegend />
      </div>

      <p id={instructionsId} className="sr-only">
        After focusing a history cell, use the arrow keys to move one cell at a time. Home and End move to the first or last day in the row. Page Up and Page Down move seven days at a time.
      </p>

      <div className="relative">
        {canScrollLeft ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-40 h-full w-6 bg-gradient-to-r from-ops-surface-1 to-transparent"
          />
        ) : null}
        {canScrollRight ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 z-40 h-full w-6 bg-gradient-to-l from-ops-surface-1 to-transparent"
          />
        ) : null}
        <div
          ref={scrollRef}
          className="history-scroll-shell overflow-x-auto rounded-xl border border-ops-border-struct bg-ops-base/80"
          role="region"
          aria-labelledby={captionId}
        >
          <table
            className="min-w-max w-full border-separate border-spacing-0 text-sm"
            role="grid"
            aria-readonly="true"
            aria-describedby={`${instructionsId} ${statusSummaryId}`}
          >
            <caption id={captionId} className="sr-only">
              Thirty-day readiness grid with one row per sector and one column per day. Cell labels use OK for nominal, DG for degraded, and UN for unmarked.
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th
                  role="columnheader"
                  className="sticky left-0 top-0 z-30 border-b border-r border-ops-border-struct bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-secondary shadow-[6px_0_12px_rgba(10,15,13,0.32)]"
                  scope="col"
                >
                  Sector
                </th>
                {dateKeys.map((dateKey) => {
                  const isToday = dateKey === todayKey;
                  const isSelectedColumn = dateKey === selectedCell.dateKey;

                  return (
                    <th
                      key={dateKey}
                      role="columnheader"
                      className={[
                        'sticky top-0 z-20 border-b border-ops-border-struct px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em]',
                        isToday
                          ? 'bg-emerald-300/12 text-ops-accent-muted'
                          : isSelectedColumn
                            ? 'bg-ops-surface-2 text-ops-text-primary'
                            : 'bg-ops-surface-1 text-ops-text-secondary'
                      ].join(' ')}
                      scope="col"
                      aria-current={isToday ? 'date' : undefined}
                    >
                      {formatDayLabel(dateKey)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {SECTORS.map((sector, sectorIndex) => {
                const isSelectedRow = sector.id === selectedCell.sectorId;

                return (
                  <tr
                    key={sector.id}
                    role="row"
                    className={isSelectedRow ? 'bg-white/[0.06]' : 'odd:bg-white/[0.04] even:bg-white/[0.02]'}
                  >
                    <th
                      role="rowheader"
                      className={[
                        'sticky left-0 z-20 border-b border-r border-ops-border-soft bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] shadow-[6px_0_12px_rgba(10,15,13,0.32)]',
                        isSelectedRow ? 'text-ops-accent-muted' : 'text-ops-text-primary'
                      ].join(' ')}
                      scope="row"
                    >
                      {sector.label}
                    </th>
                    {dateKeys.map((dateKey, dateIndex) => {
                      const status = getUiStatus(entryLookup, dateKey, sector.id);
                      const isToday = dateKey === todayKey;
                      const isSelected = dateKey === selectedCell.dateKey && sector.id === selectedCell.sectorId;
                      const cellLabel = `${sector.label} on ${formatLongDate(dateKey)}: ${getStatusLabel(status)}.`;

                      return (
                        <td
                          key={`${sector.id}:${dateKey}`}
                          ref={(element) => registerCellRef(buildCellKey(sector.id, dateKey), element)}
                          role="gridcell"
                          aria-label={cellLabel}
                          aria-describedby={statusSummaryId}
                          aria-selected={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          onClick={() => handleCellSelection({ dateKey, sectorId: sector.id })}
                          onFocus={() => setSelectedCell({ dateKey, sectorId: sector.id })}
                          onKeyDown={(event) => handleCellKeyDown(event, sectorIndex, dateIndex)}
                          className={[
                            'group cursor-pointer border-b border-ops-border-soft px-2 py-2 align-middle outline-none',
                            isToday ? 'bg-emerald-300/[0.08]' : dateKey === selectedCell.dateKey ? 'bg-white/[0.03]' : ''
                          ].join(' ')}
                        >
                          <div
                            title={cellLabel}
                            className={[
                              'mx-auto flex h-11 w-11 items-center justify-center rounded-md border text-[12px] leading-none font-semibold tracking-[0.32px] transition [font-variant-numeric:tabular-nums]',
                              isSelected
                                ? 'ring-2 ring-inset ring-ops-accent ring-offset-1 ring-offset-ops-surface-1'
                                : 'group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-ops-accent group-focus-visible:ring-offset-1 group-focus-visible:ring-offset-ops-surface-1',
                              isToday && !isSelected ? 'ring-1 ring-inset ring-emerald-300/25' : '',
                              getCellClassName(status)
                            ].join(' ')}
                          >
                            {getStatusCellText(status)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-xl border border-ops-border-struct bg-ops-surface-2/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-muted">
                Selected cell
              </p>
              <h3 className="mt-2 text-base font-semibold uppercase tracking-[0.06em] text-ops-text-primary">
                {selectedSector.label}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ops-text-secondary">
                {formatLongDate(selectedCell.dateKey)}
              </p>
              <p id={statusSummaryId} className="mt-2 text-sm leading-6 text-ops-text-secondary">
                {selectedStatusSummary}
              </p>
            </div>
            <StatusBadge status={selectedStatus} />
          </div>
        </div>

        <div className="rounded-xl border border-ops-border-soft bg-black/20 px-4 py-3 text-sm leading-6 text-ops-text-secondary">
          {selectedCell.dateKey === todayKey
            ? 'Today is live. Use the Today panel to update the current status picture.'
            : 'History is read-only. Use the Today panel to set the current day and let the grid reflect the pattern.'}
        </div>
      </div>
    </SectionCard>
  );
}
