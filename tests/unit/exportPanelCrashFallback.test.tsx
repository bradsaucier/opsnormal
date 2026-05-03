import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportPanelCrashFallback } from '../../src/components/ExportPanelCrashFallback';
import { axe } from '../setup';

const mocks = vi.hoisted(() => ({
  exportEmergencyJsonBackup: vi.fn(),
  exportEmergencyCsvBackup: vi.fn(),
  reloadCurrentPage: vi.fn(),
}));

vi.mock('../../src/lib/emergencyExport', () => ({
  exportEmergencyJsonBackup: mocks.exportEmergencyJsonBackup,
  exportEmergencyCsvBackup: mocks.exportEmergencyCsvBackup,
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage,
  };
});

describe('ExportPanelCrashFallback', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps emergency export actions available with accessible fallback semantics', async () => {
    mocks.exportEmergencyJsonBackup.mockResolvedValue({
      recoveredCount: 2,
      skippedCount: 0,
      exportedAt: '2026-04-10T00:00:00.000Z',
    });

    const { container } = render(
      <ExportPanelCrashFallback
        error={new Error('Export crash')}
        componentStack={'at ExportPanel'}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveFocus();

    await user.click(
      screen.getByRole('button', { name: /emergency json export/i }),
    );

    expect(mocks.exportEmergencyJsonBackup).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByText(
        'Emergency JSON export complete. 2 entries recovered.',
      ),
    ).toHaveLength(2);

    const alert = screen.getByRole('alert');
    const status = screen.getByRole('status');

    expect(status).toHaveTextContent(
      'Emergency JSON export complete. 2 entries recovered.',
    );
    expect(alert).not.toContainElement(status);
    expect(container.querySelector('.clip-notched')).toBeInTheDocument();
    expect(
      container.querySelector('.ops-section-spine-fault'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /emergency json export/i }),
    ).toHaveClass('ops-action-button-emerald-solid');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('disables recovery controls while an emergency export is running', async () => {
    let resolveExport:
      | ((value: {
          recoveredCount: number;
          skippedCount: number;
          exportedAt: string;
        }) => void)
      | undefined;
    mocks.exportEmergencyCsvBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );

    render(
      <ExportPanelCrashFallback
        error={new Error('Export crash')}
        onRetry={vi.fn()}
      />,
    );

    const jsonButton = screen.getByRole('button', {
      name: /emergency json export/i,
    });
    const csvButton = screen.getByRole('button', {
      name: /emergency csv export/i,
    });
    const retryButton = screen.getByRole('button', { name: /retry section/i });
    const reloadButton = screen.getByRole('button', { name: /reload page/i });

    await user.click(csvButton);

    await waitFor(() => {
      expect(jsonButton).toBeDisabled();
      expect(csvButton).toBeDisabled();
      expect(retryButton).toBeDisabled();
      expect(reloadButton).toBeDisabled();
    });

    resolveExport?.({
      recoveredCount: 1,
      skippedCount: 1,
      exportedAt: '2026-04-10T00:00:00.000Z',
    });

    await waitFor(() => {
      expect(jsonButton).not.toBeDisabled();
      expect(csvButton).not.toBeDisabled();
      expect(retryButton).not.toBeDisabled();
      expect(reloadButton).not.toBeDisabled();
    });
  });

  it('surfaces manual inspection guidance if emergency export fails', async () => {
    mocks.exportEmergencyJsonBackup.mockRejectedValueOnce(
      new Error('Dexie open failed'),
    );

    render(
      <ExportPanelCrashFallback
        error={new Error('Export crash')}
        onRetry={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /emergency json export/i }),
    );

    expect(screen.getAllByText('Dexie open failed')).toHaveLength(2);
    expect(
      screen.getByText(
        /inspect browser devtools, then application, then indexeddb/i,
      ),
    ).toBeInTheDocument();
  });

  it('calls retry and reload actions', async () => {
    const onRetry = vi.fn();

    render(
      <ExportPanelCrashFallback
        error={new Error('Export crash')}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: /retry section/i }));
    await user.click(screen.getByRole('button', { name: /reload page/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });
});
