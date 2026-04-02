import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './appDb';

export function useEntriesForDate(date: string) {
  return useLiveQuery(
    () =>
      db.dailyEntries
        .where('[date+sectorId]')
        .between([date, Dexie.minKey], [date, Dexie.maxKey], true, true)
        .toArray(),
    [date],
    []
  );
}

export function useEntriesForDateRange(startDate: string, endDate: string) {
  return useLiveQuery(
    () =>
      db.dailyEntries
        .where('[date+sectorId]')
        .between([startDate, Dexie.minKey], [endDate, Dexie.maxKey], true, true)
        .toArray(),
    [startDate, endDate],
    []
  );
}
