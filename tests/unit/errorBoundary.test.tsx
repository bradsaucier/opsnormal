import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppCrashFallback } from '../../src/components/AppCrashFallback';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { SectionCrashFallback } from '../../src/components/SectionCrashFallback';

const mocks = vi.hoisted(() => ({
  readEntriesForCrashExport: vi.fn(() => Promise.resolve([])),
  createJsonExport: vi.fn(() => Promise.resolve('{"ok":true}')),
  createCsvExport: vi.fn(() => 'date,sectorId,status,updatedAt'),
  downloadTextFile: vi.fn(),
  recordExportCompleted: vi.fn(),
  reloadCurrentPage: vi.fn()
}));

vi.mock('../../src/lib/crashExport', () => ({
  readEntriesForCrashExport: mocks.readEntriesForCrashExport
}));

vi.mock('../../src/lib/export', () => ({
  createJsonExport: mocks.createJsonExport,
  createCsvExport: mocks.createCsvExport,
  downloadTextFile: mocks.downloadTextFile,
  recordExportCompleted: mocks.recordExportCompleted
}));

vi.mock('../../src/lib/runtime', () => ({
  reloadCurrentPage: mocks.reloadCurrentPage
}));

class Explodes extends Error {
  constructor(message = 'render failure') {
    super(message);
  }
}

function CrashOnRender() {
  throw new Explodes();
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
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

    function CrashUntilReset() {
      if (shouldThrow) {
        throw new Explodes('retry failure');
      }

      return <div>Recovered after retry</div>;
    }

    render(
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div>
            <span>{error.message}</span>
            <button
              type="button"
              onClick={() => {
                shouldThrow = false;
                resetErrorBoundary();
              }}
            >
              Retry boundary
            </button>
          </div>
        )}
      >
        <CrashUntilReset />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /retry boundary/i })).toBeInTheDocument();
    expect(screen.getByText('retry failure')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry boundary/i }));

    expect(screen.getByText('Recovered after retry')).toBeInTheDocument();
  });

  it('exports JSON from the crash fallback through an isolated export path', async () => {
    render(<AppCrashFallback error={new Error('render failure')} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /export json/i }));

    expect(mocks.readEntriesForCrashExport).toHaveBeenCalledTimes(1);
    expect(mocks.createJsonExport).toHaveBeenCalledTimes(1);
    expect(mocks.downloadTextFile).toHaveBeenCalledWith(
      'opsnormal-crash-export.json',
      '{"ok":true}',
      'application/json'
    );
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
