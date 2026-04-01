import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/hooks', () => ({
  useEntriesForDateRange: vi.fn()
}));

import { HistoryGrid } from '../../src/features/history/HistoryGrid';
import { useEntriesForDateRange } from '../../src/db/hooks';
import type { DailyEntry } from '../../src/types';

const useEntriesForDateRangeMock = vi.mocked(useEntriesForDateRange);

const entries: DailyEntry[] = [
  {
    date: '2026-03-31',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-31T12:00:00.000Z'
  },
  {
    date: '2026-03-31',
    sectorId: 'body',
    status: 'degraded',
    updatedAt: '2026-03-31T12:00:00.000Z'
  },
  {
    date: '2026-04-01',
    sectorId: 'work-school',
    status: 'degraded',
    updatedAt: '2026-04-01T12:00:00.000Z'
  }
];

function buildDateKeys() {
  return [
    '2026-03-25',
    '2026-03-26',
    '2026-03-27',
    '2026-03-28',
    '2026-03-29',
    '2026-03-30',
    '2026-03-31',
    '2026-04-01',
    '2026-04-02',
    '2026-04-03'
  ];
}

describe('HistoryGrid', () => {
  beforeEach(() => {
    useEntriesForDateRangeMock.mockReturnValue(entries);
  });

  it('surfaces the selected cell detail brief', () => {
    render(
      <HistoryGrid dateKeys={['2026-03-31', '2026-04-01']} todayKey="2026-04-01" />
    );

    expect(screen.getByText('Selected cell')).toBeInTheDocument();
    expect(screen.getByText(/work or school on wed, apr 1, 2026 is degraded/i)).toBeInTheDocument();
  });

  it('updates the detail brief when a different cell is selected', async () => {
    render(
      <HistoryGrid dateKeys={['2026-03-31', '2026-04-01']} todayKey="2026-04-01" />
    );

    await userEvent.click(
      screen.getByRole('gridcell', {
        name: /body on tue, mar 31, 2026: degraded/i
      })
    );

    expect(screen.getByText(/body on tue, mar 31, 2026 is degraded/i)).toBeInTheDocument();
  });

  it('exposes the matrix as an ARIA grid with selected coordinates', () => {
    render(
      <HistoryGrid dateKeys={['2026-03-31', '2026-04-01']} todayKey="2026-04-01" />
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', {
        name: /work or school on wed, apr 1, 2026: degraded/i
      })
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('gridcell', {
        name: /work or school on tue, mar 31, 2026: nominal/i
      })
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('moves selection and physical focus with arrow-key navigation', async () => {
    render(
      <HistoryGrid dateKeys={['2026-03-31', '2026-04-01']} todayKey="2026-04-01" />
    );

    const selectedCell = screen.getByRole('gridcell', {
      name: /work or school on wed, apr 1, 2026: degraded/i
    });

    selectedCell.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(
      screen.getByRole('gridcell', {
        name: /household on wed, apr 1, 2026: unmarked/i
      })
    ).toHaveFocus();
  });

  it('clamps PageDown at the final date boundary', async () => {
    render(
      <HistoryGrid dateKeys={buildDateKeys()} todayKey="2026-03-31" />
    );

    const startCell = screen.getByRole('gridcell', {
      name: /work or school on tue, mar 31, 2026: nominal/i
    });

    startCell.focus();
    await userEvent.keyboard('{PageDown}');
    await userEvent.keyboard('{PageDown}');

    expect(
      screen.getByRole('gridcell', {
        name: /work or school on fri, apr 3, 2026: unmarked/i
      })
    ).toHaveFocus();
  });

  it('clamps PageUp at the first date boundary', async () => {
    render(
      <HistoryGrid dateKeys={buildDateKeys()} todayKey="2026-04-03" />
    );

    const startCell = screen.getByRole('gridcell', {
      name: /work or school on fri, apr 3, 2026: unmarked/i
    });

    startCell.focus();
    await userEvent.keyboard('{PageUp}');
    await userEvent.keyboard('{PageUp}');

    expect(
      screen.getByRole('gridcell', {
        name: /work or school on wed, mar 25, 2026: unmarked/i
      })
    ).toHaveFocus();
  });

  it('snaps to the row boundaries with Home and End', async () => {
    render(
      <HistoryGrid dateKeys={buildDateKeys()} todayKey="2026-03-31" />
    );

    const startCell = screen.getByRole('gridcell', {
      name: /work or school on tue, mar 31, 2026: nominal/i
    });

    startCell.focus();
    await userEvent.keyboard('{Home}');

    const firstCell = screen.getByRole('gridcell', {
      name: /work or school on wed, mar 25, 2026: unmarked/i
    });

    expect(firstCell).toHaveFocus();

    await userEvent.keyboard('{End}');

    expect(
      screen.getByRole('gridcell', {
        name: /work or school on fri, apr 3, 2026: unmarked/i
      })
    ).toHaveFocus();
  });
});
