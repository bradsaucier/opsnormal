import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PwaUpdateBanner } from '../../src/components/PwaUpdateBanner';

describe('PwaUpdateBanner', () => {
  it('renders the update-ready contract and calls reload', async () => {
    const onReload = vi.fn();
    const onDismiss = vi.fn();

    render(
      createElement(PwaUpdateBanner, {
        needRefresh: true,
        offlineReady: false,
        onReload,
        onDismiss
      })
    );

    expect(screen.getByRole('heading', { name: 'Update Ready' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders the offline-ready contract without reload', () => {
    render(
      createElement(PwaUpdateBanner, {
        needRefresh: false,
        offlineReady: true,
        onReload: vi.fn(),
        onDismiss: vi.fn()
      })
    );

    expect(screen.getByRole('heading', { name: 'Offline Ready' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
