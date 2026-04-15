import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryGrid } from '../../src/features/history/HistoryGrid';
import { axe } from '../setup';
import { formatLongDate, getTrailingDateKeys } from '../../src/lib/date';
import {
  computeCheckInStreak,
  computeCompletionState,
  createEntryLookup,
  getUiStatus,
} from '../../src/lib/history';
import type { DailyEntry } from '../../src/types';

type HooksModule = typeof import('../../src/db/hooks');

type MediaQueryListener = (event: MediaQueryListEvent) => void;

const DESKTOP_HISTORY_QUERY = '(min-width: 768px)';

const { mockUseEntriesForDateRange } = vi.hoisted(() => ({
  mockUseEntriesForDateRange: vi.fn<HooksModule['useEntriesForDateRange']>(),
}));

vi.mock('../../src/db/hooks', () => ({
  useEntriesForDateRange: mockUseEntriesForDateRange,
}));

const completeDayEntries: DailyEntry[] = [
  {
    date: '2026-03-29',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-29T08:00:00.000Z',
  },
  {
    date: '2026-03-29',
    sectorId: 'household',
    status: 'degraded',
    updatedAt: '2026-03-29T08:01:00.000Z',
  },
  {
    date: '2026-03-29',
    sectorId: 'relationships',
    status: 'nominal',
    updatedAt: '2026-03-29T08:02:00.000Z',
  },
  {
    date: '2026-03-29',
    sectorId: 'body',
    status: 'nominal',
    updatedAt: '2026-03-29T08:03:00.000Z',
  },
  {
    date: '2026-03-29',
    sectorId: 'rest',
    status: 'degraded',
    updatedAt: '2026-03-29T08:04:00.000Z',
  },
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

  constructor(
    ...args: [IntersectionObserverCallback, IntersectionObserverInit?]
  ) {
    void args;
  }
}

function installMatchMediaController(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MediaQueryListener>();

  const mediaQueryList: MediaQueryList = {
    get matches() {
      return matches;
    },
    media: DESKTOP_HISTORY_QUERY,
    onchange: null,
    addEventListener: vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName !== 'change') {
          return;
        }

        if (typeof listener === 'function') {
          listeners.add(listener as MediaQueryListener);
        }
      },
    ),
    removeEventListener: vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName !== 'change') {
          return;
        }

        if (typeof listener === 'function') {
          listeners.delete(listener as MediaQueryListener);
        }
      },
    ),
    addListener: vi.fn((listener: MediaQueryListener) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: MediaQueryListener) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      ...mediaQueryList,
      media: query,
    })),
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = {
        matches,
        media: DESKTOP_HISTORY_QUERY,
      } as MediaQueryListEvent;

      listeners.forEach((listener) => listener(event));
      mediaQueryList.onchange?.(event);
    },
  };
}

function getSelectedGridCell(): HTMLElement {
  const selectedCells = screen
    .queryAllByRole('gridcell')
    .filter((cell) => cell.getAttribute('aria-selected') === 'true');

  expect(selectedCells).toHaveLength(1);
  return selectedCells[0] as HTMLElement;
}

describe('history helpers and grid behavior', () => {
  beforeEach(() => {
    mockUseEntriesForDateRange.mockReturnValue([]);
    installMatchMediaController(false);

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
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
    const partialCompletion = computeCompletionState(
      completeDayEntries.slice(0, 3),
      '2026-03-29',
    );

    expect(completion).toEqual({
      markedCount: 5,
      totalCount: 5,
      isComplete: true,
    });
    expect(partialCompletion).toEqual({
      markedCount: 3,
      totalCount: 5,
      isComplete: false,
    });
  });

  it('returns a zero streak when today is incomplete', () => {
    expect(
      computeCheckInStreak(completeDayEntries.slice(0, 4), '2026-03-29'),
    ).toBe(0);
  });

  it('counts consecutive complete days and breaks on the first incomplete day', () => {
    const entries: DailyEntry[] = [
      ...completeDayEntries,
      ...completeDayEntries.map((entry) => ({
        ...entry,
        date: '2026-03-28',
        updatedAt: '2026-03-28T08:00:00.000Z',
      })),
      ...completeDayEntries.slice(0, 4).map((entry) => ({
        ...entry,
        date: '2026-03-27',
        updatedAt: '2026-03-27T08:00:00.000Z',
      })),
    ];

    expect(computeCheckInStreak(entries, '2026-03-29')).toBe(2);
  });

  it('keeps the daily brief aligned to the visible week when explicit controls are used', async () => {
    const user = userEvent.setup({ delay: null });
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));

    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />);

    const carousel = screen.getByRole('region');
    const previousWeekButton = screen.getByRole('button', {
      name: /previous week/i,
    });
    const nextWeekButton = screen.getByRole('button', { name: /next week/i });
    const weekStatus = screen.getByTestId('mobile-history-week-status');
    const dailyBriefHeading = screen.getByRole('heading', {
      level: 3,
      name: /sat, mar 28, 2026/i,
    });

    expect(carousel).toHaveAccessibleName('Weekly readiness history.');
    expect(carousel).not.toHaveAttribute('aria-roledescription');
    expect(
      screen.getByRole('navigation', { name: /week navigation/i }),
    ).toBeVisible();
    const weekGroups = screen.getAllByRole('group');
    expect(weekGroups).toHaveLength(5);
    weekGroups.forEach((weekGroup) => {
      expect(weekGroup).not.toHaveAttribute('aria-roledescription', 'slide');
    });
    expect(nextWeekButton).toBeDisabled();
    expect(previousWeekButton).toBeEnabled();
    expect(weekStatus).toHaveTextContent('Week 5 of 5');

    await user.click(previousWeekButton);

    expect(weekStatus).toHaveTextContent('Week 4 of 5');
    expect(dailyBriefHeading).not.toHaveTextContent('Sat, Mar 28, 2026');
    expect(nextWeekButton).toBeEnabled();

    await user.click(nextWeekButton);

    expect(weekStatus).toHaveTextContent('Week 5 of 5');
    expect(
      screen.getByRole('heading', { level: 3, name: /sat, mar 28, 2026/i }),
    ).toBeVisible();
  });

  it('echoes selected readiness state on the desktop selected-cell brief', async () => {
    const user = userEvent.setup({ delay: null });
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 29));

    installMatchMediaController(true);
    mockUseEntriesForDateRange.mockReturnValue(completeDayEntries);

    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-29" />);

    const selectedCellSurface = screen
      .getByText('Selected cell')
      .closest('.tactical-subpanel-strong') as HTMLElement;

    expect(selectedCellSurface).toHaveClass('ops-sector-spine-nominal');

    const initialSelectedCell = getSelectedGridCell();
    act(() => {
      initialSelectedCell.focus();
    });

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(selectedCellSurface).toHaveClass('ops-sector-spine-degraded');
    });
  });

  it('applies the state spine to the mobile daily brief surface', () => {
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 29));

    mockUseEntriesForDateRange.mockReturnValue(completeDayEntries);
    installMatchMediaController(false);

    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-29" />);

    const mobileDailyBriefSurface = screen
      .getByText('Daily brief')
      .closest('.tactical-subpanel-strong') as HTMLElement;

    expect(mobileDailyBriefSurface).toHaveClass('ops-sector-spine-nominal');
  });

  it('has no accessibility violations in the mobile history view', async () => {
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));

    const { container } = render(
      <HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });

  it('has no accessibility violations in the desktop history view', async () => {
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));
    installMatchMediaController(true);

    const { container } = render(
      <HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps a single tabbable desktop gridcell and updates the selected-cell brief during keyboard traversal', async () => {
    const user = userEvent.setup({ delay: null });
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));
    const matchMediaController = installMatchMediaController(true);
    const firstDateLabel = formatLongDate(dateKeys[0] ?? '2026-02-27');
    const oneWeekBackDateLabel = formatLongDate(
      dateKeys[dateKeys.length - 8] ?? '2026-03-21',
    );
    const todayLabel = formatLongDate('2026-03-28');

    void matchMediaController;
    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />);

    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-colcount', '31');
    expect(grid).toHaveAttribute('aria-rowcount', '6');
    expect(
      screen.queryByRole('button', { name: /previous week/i }),
    ).not.toBeInTheDocument();

    const initialSelectedCell = getSelectedGridCell();
    expect(initialSelectedCell).toHaveAttribute(
      'aria-label',
      `Work or School on ${todayLabel}: UNMARKED.`,
    );
    expect(initialSelectedCell).toHaveAttribute('tabindex', '0');
    expect(
      screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);

    act(() => {
      initialSelectedCell.focus();
    });
    expect(initialSelectedCell).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      const selectedCell = getSelectedGridCell();
      expect(selectedCell).toHaveAttribute(
        'aria-label',
        `Household on ${todayLabel}: UNMARKED.`,
      );
      expect(selectedCell).toHaveFocus();
    });
    expect(
      screen.getByText(`Household on ${todayLabel} is UNMARKED.`),
    ).toBeVisible();

    await user.keyboard('{PageUp}');
    await waitFor(() => {
      expect(getSelectedGridCell()).toHaveAttribute(
        'aria-label',
        `Household on ${oneWeekBackDateLabel}: UNMARKED.`,
      );
    });
    expect(
      screen.getByText(`Household on ${oneWeekBackDateLabel} is UNMARKED.`),
    ).toBeVisible();

    await user.keyboard('{Home}');
    await waitFor(() => {
      expect(getSelectedGridCell()).toHaveAttribute(
        'aria-label',
        `Household on ${firstDateLabel}: UNMARKED.`,
      );
    });

    await user.keyboard('{Control>}{End}{/Control}');
    await waitFor(() => {
      const selectedCell = getSelectedGridCell();
      expect(selectedCell).toHaveAttribute(
        'aria-label',
        `Rest on ${todayLabel}: UNMARKED.`,
      );
      expect(selectedCell).toHaveAttribute('tabindex', '0');
    });
    expect(
      screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    expect(
      screen.getByText(`Rest on ${todayLabel} is UNMARKED.`),
    ).toBeVisible();
  }, 15000);

  it('holds selection at the desktop grid boundary when traversal would move past the first cell', async () => {
    const user = userEvent.setup({ delay: null });
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));
    const firstDateLabel = formatLongDate(dateKeys[0] ?? '2026-02-27');

    installMatchMediaController(true);
    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />);

    const initialSelectedCell = getSelectedGridCell();

    act(() => {
      initialSelectedCell.focus();
    });

    await user.keyboard('{Control>}{Home}{/Control}');
    await waitFor(() => {
      const selectedCell = getSelectedGridCell();
      expect(selectedCell).toHaveAttribute(
        'aria-label',
        `Work or School on ${firstDateLabel}: UNMARKED.`,
      );
      expect(selectedCell).toHaveFocus();
    });

    await user.keyboard('{ArrowUp}');
    await waitFor(() => {
      const selectedCell = getSelectedGridCell();
      expect(selectedCell).toHaveAttribute(
        'aria-label',
        `Work or School on ${firstDateLabel}: UNMARKED.`,
      );
      expect(selectedCell).toHaveFocus();
      expect(selectedCell).toHaveAttribute('tabindex', '0');
    });
    expect(
      screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('tabindex') === '0'),
    ).toHaveLength(1);
    expect(
      screen.getByText(`Work or School on ${firstDateLabel} is UNMARKED.`),
    ).toBeVisible();
  });

  it('switches between mobile and desktop history render paths when the viewport query changes', async () => {
    const dateKeys = getTrailingDateKeys(30, new Date(2026, 2, 28));
    const matchMediaController = installMatchMediaController(false);

    render(<HistoryGrid dateKeys={dateKeys} todayKey="2026-03-28" />);

    expect(
      screen.getByRole('button', { name: /previous week/i }),
    ).toBeVisible();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    act(() => {
      matchMediaController.setMatches(true);
    });

    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeVisible();
    });
    expect(
      screen.queryByRole('button', { name: /previous week/i }),
    ).not.toBeInTheDocument();

    act(() => {
      matchMediaController.setMatches(false);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /previous week/i }),
      ).toBeVisible();
    });
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
