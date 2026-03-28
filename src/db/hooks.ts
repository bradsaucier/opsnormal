import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './appDb';

export function useEntriesForDate(date: string) {
  return useLiveQuery(() => db.dailyEntries.where('date').equals(date).toArray(), [date], []);
}

export function useEntriesForDateRange(startDate: string, endDate: string) {
  return useLiveQuery(
    () => db.dailyEntries.where('date').between(startDate, endDate, true, true).toArray(),
    [startDate, endDate],
    []
  );
}
