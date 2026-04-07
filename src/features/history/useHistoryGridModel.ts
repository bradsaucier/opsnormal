import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEntriesForDateRange } from '../../db/hooks';
import { formatLongDate } from '../../lib/date';
import { computeCheckInStreak, createEntryLookup, getUiStatus } from '../../lib/history';
import { getStatusLabel } from '../../lib/status';
import { SECTORS, type Sector, type UiStatus } from '../../types';
import {
  buildCellKey,
  clampIndex,
  DEFAULT_SECTOR_ID,
  DESKTOP_HISTORY_QUERY,
  HISTORY_GRID_IDS,
  type HistoryGridProps,
  type SelectedCell,
  WEEK_GROUP_SIZE,
  chunkDateKeys
} from './historyGridShared';
import { useViewportMatch } from './useViewportMatch';

interface HistoryGridDayStatus {
  sector: Sector;
  status: UiStatus;
}

export interface HistoryGridModel {
  dateKeys: string[];
  todayKey: string;
  isDesktopHistory: boolean;
  streak: number;
  entryLookup: ReturnType<typeof createEntryLookup>;
  weekGroups: string[][];
  visibleWeekIndex: number;
  visibleWeekStart: string;
  visibleWeekEnd: string;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  canViewPreviousWeek: boolean;
  canViewNextWeek: boolean;
  selectedCell: SelectedCell;
  selectedSector: Sector;
  selectedStatus: UiStatus;
  selectedStatusSummary: string;
  selectedDaySummary: string;
  selectedDayStatuses: HistoryGridDayStatus[];
  desktopScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  mobileScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  ids: typeof HISTORY_GRID_IDS;
  registerCellRef: (cellKey: string, element: HTMLElement | null) => void;
  registerWeekRef: (weekIndex: number, element: HTMLDivElement | null) => void;
  handleCellSelection: (nextSelection: SelectedCell) => void;
  handleCellFocus: (nextSelection: SelectedCell) => void;
  handleCellKeyDown: (event: KeyboardEvent<HTMLTableCellElement>, sectorIndex: number, dateIndex: number) => void;
  handleDaySelection: (dateKey: string) => void;
  handlePreviousWeek: () => void;
  handleNextWeek: () => void;
}

export function useHistoryGridModel({ dateKeys, todayKey }: HistoryGridProps): HistoryGridModel {
  const startDate = dateKeys[0] ?? todayKey;
  const endDate = dateKeys[dateKeys.length - 1] ?? todayKey;
  const isDesktopHistory = useViewportMatch(DESKTOP_HISTORY_QUERY);

  const entries = useEntriesForDateRange(startDate, endDate);
  const entryLookup = useMemo(() => createEntryLookup(entries), [entries]);
  const streak = useMemo(() => computeCheckInStreak(entries, todayKey), [entries, todayKey]);
  const weekGroups = useMemo(() => chunkDateKeys(dateKeys, WEEK_GROUP_SIZE), [dateKeys]);
  const lastWeekIndex = Math.max(weekGroups.length - 1, 0);
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const weekRefs = useRef(new Map<number, HTMLDivElement>());
  const initialSelectedDateKey = dateKeys.includes(todayKey)
    ? todayKey
    : (dateKeys[dateKeys.length - 1] ?? todayKey);
  const initialSelectedWeekIndex = clampIndex(
    weekGroups.findIndex((weekGroup) => weekGroup.includes(initialSelectedDateKey)),
    lastWeekIndex
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(initialSelectedWeekIndex);
  const [selectedCellState, setSelectedCellState] = useState<SelectedCell>(() => ({
    dateKey: initialSelectedDateKey,
    sectorId: DEFAULT_SECTOR_ID
  }));

  const selectedCell = useMemo<SelectedCell>(() => {
    const fallbackDateKey = dateKeys.includes(todayKey)
      ? todayKey
      : (dateKeys[dateKeys.length - 1] ?? todayKey);
    const selectedDateKey = dateKeys.includes(selectedCellState.dateKey)
      ? selectedCellState.dateKey
      : fallbackDateKey;
    const selectedSectorId = SECTORS.some((sector) => sector.id === selectedCellState.sectorId)
      ? selectedCellState.sectorId
      : DEFAULT_SECTOR_ID;

    return {
      dateKey: selectedDateKey,
      sectorId: selectedSectorId
    };
  }, [dateKeys, selectedCellState.dateKey, selectedCellState.sectorId, todayKey]);

  const visibleWeek = useMemo(
    () => weekGroups[visibleWeekIndex] ?? weekGroups[lastWeekIndex] ?? [],
    [lastWeekIndex, visibleWeekIndex, weekGroups]
  );
  const visibleWeekStart = visibleWeek[0] ?? selectedCell.dateKey;
  const visibleWeekEnd = visibleWeek[visibleWeek.length - 1] ?? selectedCell.dateKey;
  const canViewPreviousWeek = visibleWeekIndex > 0;
  const canViewNextWeek = visibleWeekIndex < lastWeekIndex;

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
    }

    updateScrollAffordance();
    scrollNode.addEventListener('scroll', updateScrollAffordance, { passive: true });
    window.addEventListener('resize', updateScrollAffordance);

    return () => {
      scrollNode.removeEventListener('scroll', updateScrollAffordance);
      window.removeEventListener('resize', updateScrollAffordance);
    };
  }, [isDesktopHistory]);

  const hasAlignedInitialMobileWeekRef = useRef(false);

  useEffect(() => {
    if (isDesktopHistory) {
      hasAlignedInitialMobileWeekRef.current = false;
      return;
    }

    if (hasAlignedInitialMobileWeekRef.current) {
      return;
    }

    hasAlignedInitialMobileWeekRef.current = true;
    const weekNode = weekRefs.current.get(initialSelectedWeekIndex);
    weekNode?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [initialSelectedWeekIndex, isDesktopHistory]);

  useEffect(() => {
    if (isDesktopHistory || !mobileScrollRef.current || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entriesForWeek) => {
        const dominantEntry = entriesForWeek
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!dominantEntry) {
          return;
        }

        const nextWeekIndexValue = dominantEntry.target.getAttribute('data-week-index');

        if (!nextWeekIndexValue) {
          return;
        }

        const nextWeekIndex = Number.parseInt(nextWeekIndexValue, 10);

        if (Number.isNaN(nextWeekIndex)) {
          return;
        }

        setVisibleWeekIndex((currentIndex) => (currentIndex === nextWeekIndex ? currentIndex : nextWeekIndex));

        setSelectedCellState((currentSelection) => {
          const nextWeek = weekGroups[nextWeekIndex] ?? [];

          if (nextWeek.length === 0 || nextWeek.includes(currentSelection.dateKey)) {
            return currentSelection;
          }

          return {
            ...currentSelection,
            dateKey: nextWeek[nextWeek.length - 1] ?? currentSelection.dateKey
          };
        });
      },
      {
        root: mobileScrollRef.current,
        threshold: [0.5, 0.75]
      }
    );

    const weekNodes = Array.from(weekRefs.current.values());
    weekNodes.forEach((weekNode) => observer.observe(weekNode));

    return () => {
      observer.disconnect();
    };
  }, [isDesktopHistory, weekGroups]);

  const selectedSector = useMemo(
    () => SECTORS.find((sector) => sector.id === selectedCell.sectorId) ?? SECTORS[0],
    [selectedCell.sectorId]
  );
  const selectedStatus = useMemo(
    () => getUiStatus(entryLookup, selectedCell.dateKey, selectedCell.sectorId),
    [entryLookup, selectedCell.dateKey, selectedCell.sectorId]
  );
  const selectedStatusSummary = `${selectedSector.label} on ${formatLongDate(selectedCell.dateKey)} is ${getStatusLabel(selectedStatus)}.`;
  const selectedDaySummary = `Daily brief for ${formatLongDate(selectedCell.dateKey)}.`;
  const selectedDayStatuses = useMemo(
    () =>
      SECTORS.map((sector) => ({
        sector,
        status: getUiStatus(entryLookup, selectedCell.dateKey, sector.id)
      })),
    [entryLookup, selectedCell.dateKey]
  );

  const registerCellRef = useCallback((cellKey: string, element: HTMLElement | null) => {
    if (!element) {
      cellRefs.current.delete(cellKey);
      return;
    }

    cellRefs.current.set(cellKey, element);
  }, []);

  const registerWeekRef = useCallback((weekIndex: number, element: HTMLDivElement | null) => {
    if (!element) {
      weekRefs.current.delete(weekIndex);
      return;
    }

    weekRefs.current.set(weekIndex, element);
  }, []);

  const focusSelectedCell = useCallback((nextSelection: SelectedCell) => {
    const nextCell = cellRefs.current.get(buildCellKey(nextSelection.sectorId, nextSelection.dateKey));
    nextCell?.focus();
    nextCell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, []);

  const handleCellFocus = useCallback((nextSelection: SelectedCell) => {
    setSelectedCellState(nextSelection);
  }, []);

  const handleDaySelection = useCallback((dateKey: string) => {
    setSelectedCellState((currentSelection) => ({
      ...currentSelection,
      dateKey
    }));
  }, []);

  const scrollToWeek = useCallback(
    (weekIndex: number) => {
      const targetWeekIndex = clampIndex(weekIndex, lastWeekIndex);
      const targetWeek = weekGroups[targetWeekIndex] ?? [];
      const targetDateKey = targetWeek[targetWeek.length - 1] ?? selectedCell.dateKey;

      setVisibleWeekIndex(targetWeekIndex);
      setSelectedCellState((currentSelection) => ({
        ...currentSelection,
        dateKey: targetDateKey
      }));

      const weekNode = weekRefs.current.get(targetWeekIndex);
      weekNode?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    },
    [lastWeekIndex, selectedCell.dateKey, weekGroups]
  );

  const handlePreviousWeek = useCallback(() => {
    if (!canViewPreviousWeek) {
      return;
    }

    scrollToWeek(visibleWeekIndex - 1);
  }, [canViewPreviousWeek, scrollToWeek, visibleWeekIndex]);

  const handleNextWeek = useCallback(() => {
    if (!canViewNextWeek) {
      return;
    }

    scrollToWeek(visibleWeekIndex + 1);
  }, [canViewNextWeek, scrollToWeek, visibleWeekIndex]);

  const handleCellKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableCellElement>, sectorIndex: number, dateIndex: number) => {
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
      setSelectedCellState(nextSelection);
      focusSelectedCell(nextSelection);
    },
    [dateKeys, focusSelectedCell, selectedCell.dateKey, selectedCell.sectorId]
  );

  const handleCellSelection = useCallback(
    (nextSelection: SelectedCell) => {
      setSelectedCellState(nextSelection);
      focusSelectedCell(nextSelection);
    },
    [focusSelectedCell]
  );

  return {
    dateKeys,
    todayKey,
    isDesktopHistory,
    streak,
    entryLookup,
    weekGroups,
    visibleWeekIndex,
    visibleWeekStart,
    visibleWeekEnd,
    canScrollLeft,
    canScrollRight,
    canViewPreviousWeek,
    canViewNextWeek,
    selectedCell,
    selectedSector,
    selectedStatus,
    selectedStatusSummary,
    selectedDaySummary,
    selectedDayStatuses,
    desktopScrollRef,
    mobileScrollRef,
    ids: HISTORY_GRID_IDS,
    registerCellRef,
    registerWeekRef,
    handleCellSelection,
    handleCellFocus,
    handleCellKeyDown,
    handleDaySelection,
    handlePreviousWeek,
    handleNextWeek
  };
}
