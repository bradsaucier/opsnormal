import { createElement } from 'react';
import { act, render, screen } from '@testing-library/react';
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
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
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
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload,
        onDismiss,
        onReloadPage: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Update Ready' }),
    ).toBeInTheDocument();

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
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Offline Ready' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /apply update/i }),
    ).not.toBeInTheDocument();
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
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage,
      }),
    );

    expect(
      screen.getByText(/update handoff did not complete/i),
    ).toBeInTheDocument();

    const reloadTabButton = screen.getByRole('button', { name: /reload tab/i });
    expect(reloadTabButton).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();

    await userEvent.click(reloadTabButton);
    expect(onReloadPage).toHaveBeenCalledTimes(1);
  });

  it('announces loop-breaker recovery guidance after mount and pins the banner until manual reload', () => {
    vi.useFakeTimers();
    const onReloadPage = vi.fn();

    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: false,
        reloadRecoveryRequired: true,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage,
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Update Recovery Required' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/update loop intercepted/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reload tab/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /apply update/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /update loop intercepted/i,
    );

    act(() => {
      screen.getByRole('button', { name: /reload tab/i }).click();
    });

    expect(onReloadPage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('pins coordinated update guidance while another tab owns the handoff', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: false,
        reloadRecoveryRequired: false,
        externalUpdateInProgress: true,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Update In Progress' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /apply update/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  });

  it('pins coordinated recovery when another tab stalls the handoff', () => {
    vi.useFakeTimers();
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: false,
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: true,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Update Recovery Required' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reload tab/i }),
    ).toBeInTheDocument();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /another opsnormal tab started an update handoff/i,
    );
    vi.useRealTimers();
  });

  it('prioritizes local stalled recovery over external stalled messaging when both states are present', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: false,
        updateStalled: true,
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: true,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
    );

    expect(
      screen.getByText(/update handoff did not complete/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /another opsnormal tab started an update handoff, but this tab has not received the new worker/i,
      ),
    ).not.toBeInTheDocument();
  });

  it('shows the applying state while the update handoff is in progress and pins the banner', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        isApplyingUpdate: true,
        updateStalled: false,
        reloadRecoveryRequired: false,
        externalUpdateInProgress: false,
        externalUpdateStalled: false,
        onReload: vi.fn(),
        onDismiss: vi.fn(),
        onReloadPage: vi.fn(),
      }),
    );

    expect(screen.getByRole('button', { name: 'Applying' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Dismiss' }),
    ).not.toBeInTheDocument();
  });
});
