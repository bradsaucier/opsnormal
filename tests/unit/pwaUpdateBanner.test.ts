import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PwaUpdateBanner } from '../../src/components/PwaUpdateBanner';

describe('PwaUpdateBanner', () => {
  it('keeps the status region mounted while dormant', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: false,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn()
      })
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the update-ready contract and calls reload', async () => {
    const onReload = vi.fn();
    const onDismiss = vi.fn();

    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: false,
        onReload,
        onDismiss,
        onReloadPage: vi.fn()
      })
    );

    expect(screen.getByRole('heading', { name: 'Update Ready' })).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /apply update/i });
    expect(applyButton).toBeInTheDocument();

    await userEvent.click(applyButton);

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders the offline-ready contract without reload', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: false,
        offlineReady: true,
        isApplyingUpdate: false,
        updateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn()
      })
    );

    expect(screen.getByRole('heading', { name: 'Offline Ready' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply update/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders stalled update recovery guidance and pins the banner until reload', async () => {
    const onReloadPage = vi.fn();

    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: true,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage
      })
    );

    expect(screen.getByText(/update handoff did not complete/i)).toBeInTheDocument();

    const reloadTabButton = screen.getByRole('button', { name: /reload tab/i });
    expect(reloadTabButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();

    await userEvent.click(reloadTabButton);
    expect(onReloadPage).toHaveBeenCalledTimes(1);
  });

  it('shows the applying state while the update handoff is in progress', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: true,
        updateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn()
      })
    );

    expect(screen.getByRole('button', { name: 'Applying' })).toBeDisabled();
  });
});
