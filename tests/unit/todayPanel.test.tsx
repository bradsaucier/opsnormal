import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodayPanel } from '../../src/features/checkin/TodayPanel';

type UseEntriesForDate = typeof import('../../src/db/hooks')['useEntriesForDate'];
type CycleDailyStatus = typeof import('../../src/db/appDb')['cycleDailyStatus'];

const { mockUseEntriesForDate, mockCycleDailyStatus } = vi.hoisted(() => ({
  mockUseEntriesForDate: vi.fn<UseEntriesForDate>(),
  mockCycleDailyStatus: vi.fn<CycleDailyStatus>()
}));

vi.mock('../../src/db/hooks', () => ({
  useEntriesForDate: mockUseEntriesForDate
}));

vi.mock('../../src/db/appDb', () => ({
  cycleDailyStatus: mockCycleDailyStatus
}));

describe('TodayPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseEntriesForDate.mockReturnValue([]);
    mockCycleDailyStatus.mockResolvedValue('nominal');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockUseEntriesForDate.mockReset();
    mockCycleDailyStatus.mockReset();
  });

  it('derives the write-time date key when the local day has rolled over', async () => {
    vi.setSystemTime(new Date('2026-03-27T23:59:30'));

    const onDateRollover = vi.fn();

    render(<TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />);

    vi.setSystemTime(new Date('2026-03-28T00:00:05'));
    fireEvent.click(screen.getByRole('button', { name: /work or school/i }));

    await vi.runAllTimersAsync();

    expect(mockCycleDailyStatus).toHaveBeenCalledWith('2026-03-28', 'work-school');
    expect(onDateRollover).toHaveBeenCalledTimes(1);
  });

  it('keeps same-day writes anchored to the rendered today key', async () => {
    vi.setSystemTime(new Date('2026-03-27T18:15:00'));

    const onDateRollover = vi.fn();

    render(<TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />);

    fireEvent.click(screen.getByRole('button', { name: /body/i }));

    await vi.runAllTimersAsync();

    expect(mockCycleDailyStatus).toHaveBeenCalledWith('2026-03-27', 'body');
    expect(onDateRollover).not.toHaveBeenCalled();
  });

  it('surfaces the error and clears the busy state if the rollover write fails', async () => {
    vi.setSystemTime(new Date('2026-03-27T23:59:30'));

    const onDateRollover = vi.fn();

    mockCycleDailyStatus.mockRejectedValue(new Error('Storage quota exceeded'));

    render(<TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />);

    vi.setSystemTime(new Date('2026-03-28T00:00:05'));
    const bodyButton = screen.getByRole('button', { name: /body/i });
    fireEvent.click(bodyButton);

    await vi.runAllTimersAsync();

    expect(mockCycleDailyStatus).toHaveBeenCalledWith('2026-03-28', 'body');
    expect(onDateRollover).not.toHaveBeenCalled();
    expect(screen.getByText('Storage quota exceeded')).toBeInTheDocument();
    expect(bodyButton).not.toBeDisabled();
  });
});
