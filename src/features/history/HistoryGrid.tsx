import { type KeyboardEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

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
const WEEK_GROUP_SIZE = 7;
const DESKTOP_HISTORY_QUERY = '(min-width: 768px)';

function getCellClassName(status: ReturnType<typeof getUiStatus>) {
  if (status === 'nominal') {
    return 'ops-grid-nominal';
  }

  if (status === 'degraded') {
    return 'ops-grid-degraded';
  }

  return 'ops-grid-unmarked';
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

function chunkDateKeys(dateKeys: string[], chunkSize: number) {
  const groups: string[][] = [];

  for (let index = 0; index < dateKeys.length; index += chunkSize) {
    groups.push(dateKeys.slice(index, index + chunkSize));
  }

  return groups;
}

function useViewportMatch(query: string) {
  const subscribe = (callback: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => {
      callback();
    };

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }

    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  };

  const getSnapshot = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function HistoryGrid({ dateKeys, todayKey }: HistoryGridProps) {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;
  const isDesktopHistory = useViewportMatch(DESKTOP_HISTORY_QUERY);

  const entries = useEntriesForDateRange(startDate, endDate);
  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const streak = useMemo(() => computeCheckInStreak(entries, todayKey), [entries, todayKey]);
  const weekGroups = useMemo(() => chunkDateKeys(dateKeys, WEEK_GROUP_SIZE), [dateKeys]);
  const captionId = 'history-grid-caption';
  const instructionsId = 'history-grid-instructions';
  const statusSummaryId = 'history-grid-status-summary';
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const weekRefs = useRef(new Map<number, HTMLDivElement>());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(() => ({
    dateKey: todayKey,
    sectorId: DEFAULT_SECTOR_ID
  }));

  const selectedWeekIndex = useMemo(() => {
    const index = weekGroups.findIndex((weekGroup) => weekGroup.includes(selectedCell.dateKey));
    return index >= 0 ? index : 0;
  }, [selectedCell.dateKey, weekGroups]);

  useEffect(() => {
    const fallbackDateKey = dateKeys.includes(todayKey)
      ? todayKey
      : (dateKeys[dateKeys.length - 1] ?? todayKey);
    const selectedDateKey = dateKeys.includes(selectedCell.dateKey)
      ? selectedCell.dateKey
      : fallbackDateKey;
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
    const scrollNode = isDesktopHistory ? desktopScrollRef.current : mobileScrollRef.current;

    if (!scrollNode) {
      return;
    }

    function updateScrollAffordance() {
      const node = isDesktopHistory ? desktopScrollRef.current : mobileScrollRef.current;

      if (!node) {
        return;
      }

      const remainingScroll = node.scrollWidth - node.clientWidth - node.scrollLeft;
      setCanScrollLeft(node.scrollLeft > 2);
      setCanScrollRight(remainingScroll > 2);

      if (!isDesktopHistory) {
        const nearestWeek = Array.from(weekRefs.current.entries()).reduce(
          (closest, [weekIndex, element]) => {
            const offset = Math.abs(element.offsetLeft - node.scrollLeft);

            if (offset < closest.offset) {
              return { weekIndex, offset };
            }

            return closest;
          },
          { weekIndex: selectedWeekIndex, offset: Number.POSITIVE_INFINITY }
        );

        setVisibleWeekIndex(nearestWeek.weekIndex);
      }
    }

    updateScrollAffordance();
    scrollNode.addEventListener('scroll', updateScrollAffordance, { passive: true });
    window.addEventListener('resize', updateScrollAffordance);

    return () => {
      scrollNode.removeEventListener('scroll', updateScrollAffordance);
      window.removeEventListener('resize', updateScrollAffordance);
    };
  }, [dateKeys, isDesktopHistory, selectedWeekIndex]);

  useEffect(() => {
    setVisibleWeekIndex(selectedWeekIndex);

    if (isDesktopHistory) {
      return;
    }

    const weekNode = weekRefs.current.get(selectedWeekIndex);
    weekNode?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [isDesktopHistory, selectedWeekIndex]);

  const selectedSector = SECTORS.find((sector) => sector.id === selectedCell.sectorId) ?? SECTORS[0];
  const selectedStatus = getUiStatus(entryLookup, selectedCell.dateKey, selectedCell.sectorId);
  const selectedStatusLabel = getStatusLabel(selectedStatus);
  const selectedStatusSummary = `${selectedSector.label} on ${formatLongDate(selectedCell.dateKey)} is ${selectedStatusLabel}.`;
  const selectedDaySummary = `Daily brief for ${formatLongDate(selectedCell.dateKey)}.`;
  const selectedDayStatuses = useMemo(
    () =>
      SECTORS.map((sector) => ({
        sector,
        status: getUiStatus(entryLookup, selectedCell.dateKey, sector.id)
      })),
    [entryLookup, selectedCell.dateKey]
  );

  function buildCellKey(sectorId: SectorId, dateKey: string) {
    return `${sectorId}:${dateKey}`;
  }

  function registerCellRef(cellKey: string, element: HTMLElement | null) {
    if (!element) {
      cellRefs.current.delete(cellKey);
      return;
    }

    cellRefs.current.set(cellKey, element);
  }

  function registerWeekRef(weekIndex: number, element: HTMLDivElement | null) {
    if (!element) {
      weekRefs.current.delete(weekIndex);
      return;
    }

    weekRefs.current.set(weekIndex, element);
  }

  function focusSelectedCell(nextSelection: SelectedCell) {
    const nextCell = cellRefs.current.get(buildCellKey(nextSelection.sectorId, nextSelection.dateKey));
    nextCell?.focus();
    nextCell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function handleDaySelection(dateKey: string) {
    setSelectedCell((currentSelection) => ({
      ...currentSelection,
      dateKey
    }));
  }

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
        nextSelection = event.ctrlKey || event.metaKey
          ? {
              sectorId: SECTORS[0]?.id ?? selectedCell.sectorId,
              dateKey: dateKeys[0] ?? selectedCell.dateKey
            }
          : {
              sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
              dateKey: dateKeys[0] ?? selectedCell.dateKey
            };
        break;
      case 'End':
        nextSelection = event.ctrlKey || event.metaKey
          ? {
              sectorId: SECTORS[SECTORS.length - 1]?.id ?? selectedCell.sectorId,
              dateKey: dateKeys[dateKeys.length - 1] ?? selectedCell.dateKey
            }
          : {
              sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
              dateKey: dateKeys[dateKeys.length - 1] ?? selectedCell.dateKey
            };
        break;
      case 'PageUp':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex - WEEK_GROUP_SIZE, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      case 'PageDown':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[clampIndex(dateIndex + WEEK_GROUP_SIZE, dateKeys.length - 1)] ?? selectedCell.dateKey
        };
        break;
      case 'Enter':
      case ' ':
        nextSelection = {
          sectorId: SECTORS[sectorIndex]?.id ?? selectedCell.sectorId,
          dateKey: dateKeys[dateIndex] ?? selectedCell.dateKey
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

  function renderDesktopGrid() {
    return (
      <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="max-w-2xl text-sm leading-6 text-ops-text-secondary">
              This grid is the mirror. Patterns matter more than extra instrumentation.
            </p>
            <p className="text-xs tracking-[0.14em] text-ops-text-muted uppercase">
              Desktop holds the full 30-day picture. Tab exits the grid. Select a cell for the detail brief.
            </p>
          </div>
          <StatusLegend />
        </div>

        <p id={instructionsId} className="sr-only">
          After focusing a history cell, use the arrow keys to move one cell at a time. Home and End move to the first or last day in the current row. Control plus Home jumps to the first cell in the grid. Control plus End jumps to the last cell in the grid. Page Up and Page Down move seven days at a time. Tab exits the grid.
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
          <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
            <div
              ref={desktopScrollRef}
              className="history-scroll-shell clip-notched ops-notch-panel-inner overflow-x-auto bg-ops-base/80"
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
                                  'ops-notch-chip clip-notched mx-auto flex h-11 w-11 items-center justify-center border text-[12px] leading-none font-semibold tracking-[0.32px] transition [font-variant-numeric:tabular-nums]',
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
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
            <div className="clip-notched ops-notch-panel-inner bg-ops-surface-2/70 p-4">
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
          </div>

          <div className="clip-notched ops-notch-panel-outer bg-ops-border-soft p-px">
            <div className="clip-notched ops-notch-panel-inner bg-black/20 px-4 py-3 text-sm leading-6 text-ops-text-secondary">
              {selectedCell.dateKey === todayKey
                ? 'Today is live. Use the Today panel to update the current status picture.'
                : 'History is read-only. Use the Today panel to set the current day and let the grid reflect the pattern.'}
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderMobileGrid() {
    return (
      <>
        <div className="mb-4 flex flex-col gap-3">
          <div className="space-y-1">
            <p className="max-w-2xl text-sm leading-6 text-ops-text-secondary">
              Mobile holds the history picture one week at a time. Swipe by week. Tap a day column for the daily brief.
            </p>
            <p className="text-xs tracking-[0.14em] text-ops-text-muted uppercase">
              Week groups snap into place. The next week stays partially visible so the scroll path is obvious.
            </p>
          </div>
          <StatusLegend />
        </div>

        <p id={captionId} className="sr-only">
          Week-paginated readiness history for the trailing 30-day window.
        </p>
        <p id={instructionsId} className="sr-only">
          Swipe left or right to move by week. Activate a day header to open the daily brief for that date. The daily brief lists all five sector states for the selected day.
        </p>

        <div className="relative">
          {canScrollLeft ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-30 h-full w-6 bg-gradient-to-r from-ops-surface-1 to-transparent"
            />
          ) : null}
          {canScrollRight ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 z-30 h-full w-10 bg-gradient-to-l from-ops-surface-1 to-transparent"
            />
          ) : null}

          <div
            ref={mobileScrollRef}
            className="history-scroll-shell history-scroll-shell-mobile flex gap-3 overflow-x-auto pr-10"
            role="region"
            aria-labelledby={captionId}
            aria-describedby={`${instructionsId} ${statusSummaryId}`}
            tabIndex={0}
          >
            {weekGroups.map((weekGroup, weekIndex) => {
              const weekStart = weekGroup[0] ?? selectedCell.dateKey;
              const weekEnd = weekGroup[weekGroup.length - 1] ?? selectedCell.dateKey;

              return (
                <div
                  key={weekStart}
                  ref={(element) => registerWeekRef(weekIndex, element)}
                  className="history-week-card clip-notched ops-notch-panel-outer w-[calc(100%-2.75rem)] min-w-[17.5rem] max-w-[24rem] shrink-0 bg-ops-border-struct p-px"
                >
                  <div className="clip-notched ops-notch-panel-inner bg-ops-base/80 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-muted">
                          Week {weekIndex + 1}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ops-text-secondary">
                          {formatDayLabel(weekStart)} to {formatDayLabel(weekEnd)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] uppercase tracking-[0.14em] text-ops-text-muted">
                        {visibleWeekIndex === weekIndex ? 'On deck' : 'Stand by'}
                      </div>
                    </div>

                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `minmax(4.5rem, auto) repeat(${weekGroup.length}, minmax(0, 1fr))` }}
                    >
                      <div className="sticky left-0 z-10 bg-ops-surface-2 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ops-text-secondary">
                        Sector
                      </div>
                      {weekGroup.map((dateKey) => {
                        const isToday = dateKey === todayKey;
                        const isSelectedDay = dateKey === selectedCell.dateKey;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => handleDaySelection(dateKey)}
                            aria-label={`Open daily brief for ${formatLongDate(dateKey)}`}
                            aria-controls="mobile-history-daily-brief"
                            aria-pressed={isSelectedDay}
                            aria-current={isToday ? 'date' : undefined}
                            className={[
                              'ops-notch-chip clip-notched min-h-11 border px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] transition',
                              isSelectedDay
                                ? 'border-ops-accent bg-emerald-300/12 text-ops-accent-muted'
                                : 'border-ops-border-soft bg-ops-surface-2 text-ops-text-secondary',
                              isToday && !isSelectedDay ? 'ring-1 ring-inset ring-emerald-300/25' : ''
                            ].join(' ')}
                          >
                            <span className="block text-[10px] text-ops-text-muted">{formatLongDate(dateKey).split(',')[0]}</span>
                            <span className="mt-1 block">{formatDayLabel(dateKey)}</span>
                          </button>
                        );
                      })}

                      {SECTORS.map((sector) => {
                        return [
                          <div
                            key={`${sector.id}:label`}
                            className="sticky left-0 z-10 flex min-h-11 items-center bg-ops-surface-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ops-text-primary"
                          >
                            {sector.shortLabel}
                          </div>,
                          ...weekGroup.map((dateKey) => {
                            const status = getUiStatus(entryLookup, dateKey, sector.id);
                            const isSelectedDay = dateKey === selectedCell.dateKey;
                            const cellLabel = `${sector.label} on ${formatLongDate(dateKey)}: ${getStatusLabel(status)}.`;

                            return (
                              <div
                                key={`${sector.id}:${dateKey}`}
                                className={[
                                  'ops-notch-chip clip-notched flex min-h-11 items-center justify-center border px-1 py-1 text-[11px] font-semibold tracking-[0.24px] [font-variant-numeric:tabular-nums]',
                                  isSelectedDay ? 'ring-1 ring-inset ring-ops-accent/60' : '',
                                  getCellClassName(status)
                                ].join(' ')}
                                title={cellLabel}
                                aria-hidden="true"
                              >
                                {getStatusCellText(status)}
                              </div>
                            );
                          })
                        ];
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
            {weekGroups.map((weekGroup, weekIndex) => (
              <span
                key={weekGroup[0] ?? `week-${weekIndex}`}
                className={[
                  'h-2 w-2 rounded-full border',
                  visibleWeekIndex === weekIndex
                    ? 'border-ops-accent bg-ops-accent'
                    : 'border-ops-border-struct bg-transparent'
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        <div
          id="mobile-history-daily-brief"
          className="mt-4 clip-notched ops-notch-panel-outer bg-ops-border-struct p-px"
          aria-live="polite"
        >
          <div className="clip-notched ops-notch-panel-inner bg-ops-surface-2/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-muted">
                  Daily brief
                </p>
                <h3 className="mt-2 text-base font-semibold uppercase tracking-[0.06em] text-ops-text-primary">
                  {formatLongDate(selectedCell.dateKey)}
                </h3>
                <p id={statusSummaryId} className="mt-2 text-sm leading-6 text-ops-text-secondary">
                  {selectedDaySummary}
                </p>
              </div>
              <div className="clip-notched ops-notch-chip border border-ops-border-soft bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-ops-text-secondary">
                {visibleWeekIndex + 1} of {weekGroups.length} week groups
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {selectedDayStatuses.map(({ sector, status }) => (
                <div
                  key={sector.id}
                  className="clip-notched ops-notch-chip flex items-center justify-between gap-3 border border-ops-border-soft bg-black/20 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-ops-text-primary">
                      {sector.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ops-text-secondary">
                      {sector.description}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
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
      {isDesktopHistory ? renderDesktopGrid() : renderMobileGrid()}
    </SectionCard>
  );
}
