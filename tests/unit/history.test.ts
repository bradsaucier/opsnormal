import { describe, expect, it } from 'vitest';

import {
  computeCheckInStreak,
  computeCompletionState,
  createEntryLookup,
  getUiStatus
} from '../../src/lib/history';
import type { DailyEntry } from '../../src/types';

const completeDayEntries: DailyEntry[] = [
  {
    date: '2026-03-29',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-29T08:00:00.000Z'
  },
  {
    date: '2026-03-29',
    sectorId: 'household',
    status: 'degraded',
    updatedAt: '2026-03-29T08:01:00.000Z'
  },
  {
    date: '2026-03-29',
    sectorId: 'relationships',
    status: 'nominal',
    updatedAt: '2026-03-29T08:02:00.000Z'
  },
  {
    date: '2026-03-29',
    sectorId: 'body',
    status: 'nominal',
    updatedAt: '2026-03-29T08:03:00.000Z'
  },
  {
    date: '2026-03-29',
    sectorId: 'rest',
    status: 'degraded',
    updatedAt: '2026-03-29T08:04:00.000Z'
  }
];

describe('history helpers', () => {
  it('creates an entry lookup keyed by date and sector', () => {
    const lookup = createEntryLookup(completeDayEntries);

    expect(lookup.get('2026-03-29:body')).toBe('nominal');
    expect(lookup.get('2026-03-29:rest')).toBe('degraded');
  });

  it('returns unmarked when an entry is missing from the lookup', () => {
    const lookup = createEntryLookup(completeDayEntries);

    expect(getUiStatus(lookup, '2026-03-29', 'household')).toBe('degraded');
    expect(getUiStatus(lookup, '2026-03-29', 'work-school')).toBe('nominal');
    expect(getUiStatus(lookup, '2026-03-28', 'body')).toBe('unmarked');
  });

  it('computes completion state for a date', () => {
    const completion = computeCompletionState(completeDayEntries, '2026-03-29');
    const partialCompletion = computeCompletionState(completeDayEntries.slice(0, 3), '2026-03-29');

    expect(completion).toEqual({
      markedCount: 5,
      totalCount: 5,
      isComplete: true
    });
    expect(partialCompletion).toEqual({
      markedCount: 3,
      totalCount: 5,
      isComplete: false
    });
  });

  it('returns a zero streak when today is incomplete', () => {
    expect(computeCheckInStreak(completeDayEntries.slice(0, 4), '2026-03-29')).toBe(0);
  });

  it('counts consecutive complete days and breaks on the first incomplete day', () => {
    const entries: DailyEntry[] = [
      ...completeDayEntries,
      ...completeDayEntries.map((entry) => ({
        ...entry,
        date: '2026-03-28',
        updatedAt: '2026-03-28T08:00:00.000Z'
      })),
      ...completeDayEntries.slice(0, 4).map((entry) => ({
        ...entry,
        date: '2026-03-27',
        updatedAt: '2026-03-27T08:00:00.000Z'
      }))
    ];

    expect(computeCheckInStreak(entries, '2026-03-29')).toBe(2);
  });
});
