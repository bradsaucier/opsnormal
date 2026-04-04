import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryGrid } from '../../src/features/history/HistoryGrid';
import { getTrailingDateKeys } from '../../src/lib/date';
import {
  computeCheckInStreak,
  computeCompletionState,
  createEntryLookup,
  getUiStatus
} from '../../src/lib/history';
import type { DailyEntry } from '../../src/types';

type HooksModule = typeof import('../../src/db/hooks');

const { mockUseEntriesForDateRange } = vi.hoisted(() => ({
  mockUseEntriesForDateRange: vi.fn<HooksModule['useEntriesForDateRange']>()
}));

vi.mock('../../src/db/hooks', () => ({
  useEntriesForDateRange: mockUseEntriesForDateRange
}));

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

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0.5, 0.75];

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  constructor(...args: [IntersectionObserverCallback, IntersectionObserverInit?]) {
    void args;
  }
}

describe('history helpers and grid behavior', () => {
  beforeEach(() => {
    mockUseEntriesForDateRange.mockReturnValue([]);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(min-width: 768px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockUseEntriesForDateRange.mockReset();
  });

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

  it('keeps the daily brief aligned to the visible week when explicit controls are used', async () => {
    const user = userEvent.setup();
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));

    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />);

    const carousel = screen.getByRole('region');
    const previousWeekButton = screen.getByRole('button', { name: /previous week/i });
    const nextWeekButton = screen.getByRole('button', { name: /next week/i });
    const weekStatus = screen.getByTestId('mobile-history-week-status');
    const dailyBriefHeading = screen.getByRole('heading', { level: 3, name: /sat, mar 28, 2026/i });

    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getAllByRole('group', { name: /week \d of 5/i })).toHaveLength(5);
    expect(nextWeekButton).toBeDisabled();
    expect(previousWeekButton).toBeEnabled();
    expect(weekStatus).toHaveTextContent('Week 5 of 5');

    await user.click(previousWeekButton);

    expect(weekStatus).toHaveTextContent('Week 4 of 5');
    expect(dailyBriefHeading).not.toHaveTextContent('Sat, Mar 28, 2026');
    expect(nextWeekButton).toBeEnabled();

    await user.click(nextWeekButton);

    expect(weekStatus).toHaveTextContent('Week 5 of 5');
    expect(screen.getByRole('heading', { level: 3, name: /sat, mar 28, 2026/i })).toBeVisible();
  });
});
