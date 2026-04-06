import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppCrashFallback } from '../../src/components/AppCrashFallback';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { SectionCrashFallback } from '../../src/components/SectionCrashFallback';
import type { CrashExportSnapshot } from '../../src/lib/crashExport';

const emptyCrashExportSnapshot: CrashExportSnapshot = {
  entries: [],
  skippedCount: 0,
  storageDiagnostics: {
    connectionDropsDetected: 0,
    reconnectSuccesses: 0,
    reconnectFailures: 0,
    reconnectState: 'steady',
    lastReconnectError: null,
    persistAttempted: false,
    persistGranted: false,
    standaloneMode: false,
    installRecommended: false,
    webKitRisk: false,
    lastVerificationResult: 'unknown',
    lastVerifiedAt: null
  }
};

const mocks = vi.hoisted(() => ({
  deleteOpsNormalDatabase: vi.fn(() => Promise.resolve()),
  readCrashExportSnapshot: vi.fn(),
  createCrashJsonExport: vi.fn(() => Promise.resolve('{"ok":true}')),
  createCsvExport: vi.fn(() => 'date,sectorId,status,updatedAt'),
  downloadTextFile: vi.fn(),
  recordExportCompleted: vi.fn(),
  reloadCurrentPage: vi.fn()
}));

vi.mock('../../src/lib/crashExport', () => ({
  deleteOpsNormalDatabase: mocks.deleteOpsNormalDatabase,
  readCrashExportSnapshot: mocks.readCrashExportSnapshot
}));

vi.mock('../../src/lib/export', () => ({
  createCrashJsonExport: mocks.createCrashJsonExport,
  createCsvExport: mocks.createCsvExport,
  downloadTextFile: mocks.downloadTextFile,
  recordExportCompleted: mocks.recordExportCompleted
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage
  };
});

class Explodes extends Error {
  constructor(message = 'render failure') {
    super(message);
  }
}

function CrashOnRender(): ReactElement {
  throw new Explodes();
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.readCrashExportSnapshot.mockResolvedValue(emptyCrashExportSnapshot);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('contains a render crash and shows the fallback', () => {
    render(
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <AppCrashFallback error={error} onRetry={resetErrorBoundary} />
        )}
      >
        <CrashOnRender />
      </ErrorBoundary>
    );

    expect(screen.getByText(/opsnormal stopped rendering/i)).toBeInTheDocument();
    expect(screen.getByText(/render failure/i)).toBeInTheDocument();
  });

  it('resets the latched fault when reset keys change', () => {
    const view = render(
      <ErrorBoundary fallbackRender={({ error }) => <div>{error.message}</div>} resetKeys={['alpha']}>
        <CrashOnRender />
      </ErrorBoundary>
    );

    expect(screen.getByText('render failure')).toBeInTheDocument();

    view.rerender(
      <ErrorBoundary fallbackRender={({ error }) => <div>{error.message}</div>} resetKeys={['bravo']}>
        <div>Recovered</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('remounts the crashed subtree when retry is selected', async () => {
    let shouldThrow = true;

    function CrashThenRecover(): ReactElement {
      if (shouldThrow) {
        throw new Explodes('retry failure');
      }

      return <div>Recovered after retry</div>;
    }

    render(
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <button
            type="button"
            onClick={() => {
              shouldThrow = false;
              resetErrorBoundary();
            }}
          >
            Retry boundary
          </button>
        )}
      >
        <CrashThenRecover />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /retry boundary/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry boundary/i }));

    expect(screen.getByText('Recovered after retry')).toBeInTheDocument();
  });

  it('exports JSON from the crash fallback through an isolated export path', async () => {
    mocks.readCrashExportSnapshot.mockResolvedValueOnce({
      entries: [],
      skippedCount: 0,
      storageDiagnostics: emptyCrashExportSnapshot.storageDiagnostics
    });

    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /export json/i }));

    expect(mocks.readCrashExportSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.createCrashJsonExport).toHaveBeenCalledTimes(1);
    expect(mocks.downloadTextFile).toHaveBeenCalledWith(
      'opsnormal-crash-export.json',
      '{"ok":true}',
      'application/json'
    );
    expect(screen.getByText('JSON export complete. 0 entries recovered. Crash diagnostics captured.')).toBeInTheDocument();
  });

  it('locks recovery controls while a crash export is running', async () => {
    let resolveSnapshot: ((value: CrashExportSnapshot) => void) | undefined;

    mocks.readCrashExportSnapshot.mockReturnValueOnce(
      new Promise((resolve: (value: CrashExportSnapshot) => void) => {
        resolveSnapshot = resolve;
      })
    );

    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const exportJsonButton = screen.getByRole('button', { name: /export json/i });
    const exportCsvButton = screen.getByRole('button', { name: /export csv/i });
    const retryButton = screen.getByRole('button', { name: /retry app/i });
    const reloadButton = screen.getByRole('button', { name: /reload page/i });

    await userEvent.click(exportJsonButton);

    await waitFor(() => {
      expect(exportJsonButton).toBeDisabled();
      expect(exportCsvButton).toBeDisabled();
      expect(retryButton).toBeDisabled();
      expect(reloadButton).toBeDisabled();
    });

    resolveSnapshot?.({
      entries: [],
      skippedCount: 0,
      storageDiagnostics: emptyCrashExportSnapshot.storageDiagnostics
    });

    await waitFor(() => {
      expect(exportJsonButton).not.toBeDisabled();
      expect(exportCsvButton).not.toBeDisabled();
      expect(retryButton).not.toBeDisabled();
      expect(reloadButton).not.toBeDisabled();
    });
  });

  it('reports skipped malformed rows after a crash export', async () => {
    mocks.readCrashExportSnapshot.mockResolvedValueOnce({
      entries: [
        {
          date: '2026-03-28',
          sectorId: 'body',
          status: 'nominal',
          updatedAt: '2026-03-28T12:00:00.000Z'
        }
      ],
      skippedCount: 2,
      storageDiagnostics: emptyCrashExportSnapshot.storageDiagnostics
    });

    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(screen.getByText('CSV export complete. 1 entry recovered. 2 malformed rows skipped.')).toBeInTheDocument();
  });


  it('keeps clear-data reset locked until export or explicit acknowledgment unlocks it', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const clearDataButton = screen.getByRole('button', { name: /clear local data and reload/i });
    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });

    expect(clearDataButton).toBeDisabled();

    await userEvent.click(acknowledgment);

    expect(clearDataButton).not.toBeDisabled();
  });

  it('arms then clears local data and reloads the page', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });
    await userEvent.click(acknowledgment);

    const clearDataButton = screen.getByRole('button', { name: /clear local data and reload/i });
    await userEvent.click(clearDataButton);

    expect(
      screen.getByRole('button', { name: /confirm delete all local data and reload/i })
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete all local data and reload/i })
    );

    expect(mocks.deleteOpsNormalDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });

  it('disarms the clear-data reset when Escape is pressed', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });
    await userEvent.click(acknowledgment);

    await userEvent.click(screen.getByRole('button', { name: /clear local data and reload/i }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /confirm delete all local data and reload/i })
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText('Clear-data reset disarmed. Local data remains untouched.')).toBeInTheDocument();
  });

  it('restores focus to the clear-data button when the destructive path is disarmed', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });
    await userEvent.click(acknowledgment);

    const clearDataButton = screen.getByRole('button', { name: /clear local data and reload/i });
    await userEvent.click(clearDataButton);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(clearDataButton).toHaveFocus();
  });

  it('ignores Escape disarm input while local data deletion is already running', async () => {
    let resolveDelete: (() => void) | undefined;
    mocks.deleteOpsNormalDatabase.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });
    await userEvent.click(acknowledgment);

    await userEvent.click(screen.getByRole('button', { name: /clear local data and reload/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete all local data and reload/i })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(
      screen.getByText('Deleting all local OpsNormal data now. The page will reload after the reset completes.')
    ).toBeInTheDocument();

    resolveDelete?.();

    await waitFor(() => {
      expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByText('Clear-data reset disarmed. Local data remains untouched.')
    ).not.toBeInTheDocument();
  });

  it('announces fallback status updates and the render fault to assistive technology', () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('render failure');
  });

  it('surfaces local reset failures without reloading', async () => {
    mocks.deleteOpsNormalDatabase.mockRejectedValueOnce(new Error('Database is blocked by another open tab.'));

    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i understand this will permanently delete local data/i
    });
    await userEvent.click(acknowledgment);

    await userEvent.click(screen.getByRole('button', { name: /clear local data and reload/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /confirm delete all local data and reload/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Database is blocked by another open tab.')).toBeInTheDocument();
    });
    expect(mocks.reloadCurrentPage).not.toHaveBeenCalled();
  });

  it('reloads the page from the crash fallback', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /reload page/i }));

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });
});

describe('SectionCrashFallback', () => {
  it('displays the section label and error message', () => {
    render(
      <SectionCrashFallback
        label="History Grid"
        error={new Error('Grid fault')}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('History Grid failed to render')).toBeInTheDocument();
    expect(screen.getByText('Grid fault')).toBeInTheDocument();
  });

  it('calls onRetry when retry is clicked', async () => {
    const onRetry = vi.fn();

    render(
      <SectionCrashFallback
        label="History Grid"
        error={new Error('Grid fault')}
        onRetry={onRetry}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
