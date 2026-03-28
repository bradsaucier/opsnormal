import type { DailyEntry, SectorId, UiStatus } from '../types';
import { SECTORS } from '../types';
import { formatDateKey, parseDateKey } from './date';

export function createEntryLookup(entries: DailyEntry[]): Map<string, DailyEntry['status']> {
  return new Map(entries.map((entry) => [`${entry.date}:${entry.sectorId}`, entry.status]));
}

export function getUiStatus(
  entryLookup: Map<string, DailyEntry['status']>,
  date: string,
  sectorId: SectorId
): UiStatus {
  return entryLookup.get(`${date}:${sectorId}`) ?? 'unmarked';
}

export function countMarkedForDate(entries: DailyEntry[], date: string): number {
  return entries.filter((entry) => entry.date === date).length;
}

export function computeCompletionState(entries: DailyEntry[], date: string): {
  markedCount: number;
  totalCount: number;
  isComplete: boolean;
} {
  const markedCount = countMarkedForDate(entries, date);
  const totalCount = SECTORS.length;

  return {
    markedCount,
    totalCount,
    isComplete: markedCount === totalCount
  };
}

export function computeCheckInStreak(entries: DailyEntry[], todayKey: string): number {
  const groupedByDate = new Map<string, Set<SectorId>>();

  for (const entry of entries) {
    const sectors = groupedByDate.get(entry.date) ?? new Set<SectorId>();
    sectors.add(entry.sectorId);
    groupedByDate.set(entry.date, sectors);
  }

  let streak = 0;
  const cursor = parseDateKey(todayKey);

  while (streak < 3650) {
    const dateKey = formatDateKey(cursor);
    const sectors = groupedByDate.get(dateKey);

    if (!sectors || sectors.size !== SECTORS.length) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
