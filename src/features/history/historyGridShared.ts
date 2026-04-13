import { SECTORS, type SectorId, type UiStatus } from '../../types';

export interface HistoryGridProps {
  dateKeys: string[];
  todayKey: string;
}

export interface SelectedCell {
  dateKey: string;
  sectorId: SectorId;
}

export const DEFAULT_SECTOR_ID = SECTORS[0].id;
export const WEEK_GROUP_SIZE = 7;
export const DESKTOP_HISTORY_QUERY = '(min-width: 768px)';
export const getServerSnapshot = () => false;

export const HISTORY_GRID_IDS = {
  captionId: 'history-grid-caption',
  instructionsId: 'history-grid-instructions',
  statusSummaryId: 'history-grid-status-summary',
  mobileRegionId: 'history-mobile-region',
} as const;

export function getCellClassName(status: UiStatus) {
  if (status === 'nominal') {
    return 'ops-grid-nominal';
  }

  if (status === 'degraded') {
    return 'ops-grid-degraded';
  }

  return 'ops-grid-unmarked';
}

export function clampIndex(index: number, upperBound: number) {
  if (index < 0) {
    return 0;
  }

  if (index > upperBound) {
    return upperBound;
  }

  return index;
}

export function chunkDateKeys(dateKeys: string[], chunkSize: number) {
  const groups: string[][] = [];

  for (let index = 0; index < dateKeys.length; index += chunkSize) {
    groups.push(dateKeys.slice(index, index + chunkSize));
  }

  return groups;
}

export function buildCellKey(sectorId: SectorId, dateKey: string) {
  return `${sectorId}:${dateKey}`;
}
