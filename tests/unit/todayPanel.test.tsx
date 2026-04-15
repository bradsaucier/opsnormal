import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodayPanel } from '../../src/features/checkin/TodayPanel';
import { axe } from '../setup';
import type { DailyEntry } from '../../src/types';

type UseEntriesForDate =
  (typeof import('../../src/db/hooks'))['useEntriesForDate'];
type SetDailyStatus = (typeof import('../../src/db/appDb'))['setDailyStatus'];

const { mockUseEntriesForDate, mockSetDailyStatus } = vi.hoisted(() => ({
  mockUseEntriesForDate: vi.fn<UseEntriesForDate>(),
  mockSetDailyStatus: vi.fn<SetDailyStatus>(),
}));

vi.mock('../../src/db/hooks', () => ({
  useEntriesForDate: mockUseEntriesForDate,
}));

vi.mock('../../src/db/appDb', () => ({
  setDailyStatus: mockSetDailyStatus,
}));

describe('TodayPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseEntriesForDate.mockReturnValue([]);
    mockSetDailyStatus.mockResolvedValue('nominal');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockUseEntriesForDate.mockReset();
    mockSetDailyStatus.mockReset();
  });

  it('has no accessibility violations in the direct-select check-in surface', async () => {
    vi.useRealTimers();
    const { container } = render(<TodayPanel todayKey="2026-03-27" />);

    expect((await axe(container)).violations).toEqual([]);

    vi.useFakeTimers();
  });

  it('renders direct-select radio controls for each sector', () => {
    render(<TodayPanel todayKey="2026-03-27" />);

    const instructionStrip = screen.getByText(
      /Choose a state directly\. Arrow keys move inside the control group\. Unmarked means no status recorded for the day\./i,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(15);
    expect(instructionStrip).toBeInTheDocument();
    expect(screen.getByText('S1 - WORK')).toBeInTheDocument();
    expect(screen.getByText('S5 - REST')).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /work or school status/i }),
    ).toBeInTheDocument();

    const instructionId = instructionStrip.getAttribute('id');
    expect(instructionId).toBeTruthy();

    for (const group of screen.getAllByRole('radiogroup')) {
      expect(group).toHaveAttribute('aria-describedby', instructionId);
    }
  });

  it('keeps the fallback live-region announcement mounted after a save', async () => {
    render(<TodayPanel todayKey="2026-03-27" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /body nominal/i }));
      await vi.runAllTimersAsync();
    });

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent(/body set to nominal/i);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
    });

    expect(liveRegion).toHaveTextContent(/body set to nominal/i);
  });

  it('maintains roving tabindex when arrow keys move between direct-select states', async () => {
    let entries: DailyEntry[] = [];
    let resolveWrite: ((status: 'nominal') => void) | null = null;

    mockUseEntriesForDate.mockImplementation(() => entries);
    mockSetDailyStatus.mockImplementation((dateKey, sectorId) => {
      entries = [
        {
          date: dateKey,
          sectorId,
          status: 'nominal',
          updatedAt: '2026-03-27T12:00:00.000Z',
        },
      ];

      return new Promise((resolve) => {
        resolveWrite = resolve;
      });
    });

    render(<TodayPanel todayKey="2026-03-27" />);

    const workUnmarked = screen.getByRole('radio', {
      name: /work or school unmarked/i,
    });
    expect(workUnmarked).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByRole('radio', { name: /work or school nominal/i }),
    ).toHaveAttribute('tabindex', '-1');

    act(() => {
      fireEvent.keyDown(workUnmarked, { key: 'ArrowRight' });
    });

    const workNominal = screen.getByRole('radio', {
      name: /work or school nominal/i,
    });
    expect(workNominal).toHaveFocus();
    expect(workNominal).toHaveAttribute('aria-checked', 'true');
    expect(workNominal).toHaveAttribute('aria-disabled', 'true');
    expect(workNominal).not.toBeDisabled();
    expect(workNominal).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByRole('radio', { name: /work or school unmarked/i }),
    ).toHaveAttribute('tabindex', '-1');

    await act(async () => {
      resolveWrite?.('nominal');
      await Promise.resolve();
    });
  });

  it('derives the write-time date key when the local day has rolled over', async () => {
    vi.setSystemTime(new Date('2026-03-27T23:59:30'));

    const onDateRollover = vi.fn();

    render(
      <TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />,
    );

    vi.setSystemTime(new Date('2026-03-28T00:00:05'));

    await act(async () => {
      fireEvent.click(
        screen.getByRole('radio', { name: /work or school nominal/i }),
      );
      await vi.runAllTimersAsync();
    });

    expect(mockSetDailyStatus).toHaveBeenCalledWith(
      '2026-03-28',
      'work-school',
      'nominal',
    );
    expect(onDateRollover).toHaveBeenCalledTimes(1);
  });

  it('keeps same-day writes anchored to the rendered today key', async () => {
    vi.setSystemTime(new Date('2026-03-27T18:15:00'));

    const onDateRollover = vi.fn();

    render(
      <TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /body nominal/i }));
      await vi.runAllTimersAsync();
    });

    expect(mockSetDailyStatus).toHaveBeenCalledWith(
      '2026-03-27',
      'body',
      'nominal',
    );
    expect(onDateRollover).not.toHaveBeenCalled();
  });

  it('surfaces the error and clears the busy state if the rollover write fails', async () => {
    vi.setSystemTime(new Date('2026-03-27T23:59:30'));

    const onDateRollover = vi.fn();

    mockSetDailyStatus.mockRejectedValue(new Error('Storage quota exceeded'));

    render(
      <TodayPanel todayKey="2026-03-27" onDateRollover={onDateRollover} />,
    );

    vi.setSystemTime(new Date('2026-03-28T00:00:05'));
    const bodyNominalRadio = screen.getByRole('radio', {
      name: /body nominal/i,
    });

    await act(async () => {
      fireEvent.click(bodyNominalRadio);
      await vi.runAllTimersAsync();
    });

    expect(mockSetDailyStatus).toHaveBeenCalledWith(
      '2026-03-28',
      'body',
      'nominal',
    );
    expect(onDateRollover).not.toHaveBeenCalled();
    expect(screen.getByText('Storage quota exceeded')).toBeInTheDocument();
    expect(bodyNominalRadio).not.toBeDisabled();
  });
});
