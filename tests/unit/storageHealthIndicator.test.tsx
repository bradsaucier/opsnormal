import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StorageHealthIndicator } from '../../src/components/StorageHealthIndicator';
import type { StorageHealth } from '../../src/lib/storage';

function buildStorageHealth(
  overrides: Partial<StorageHealth> = {},
): StorageHealth {
  return {
    persisted: false,
    persistenceAvailable: true,
    estimateAvailable: true,
    usageBytes: 100,
    quotaBytes: 1000,
    percentUsed: 0.1,
    status: 'monitor',
    message: 'Persistent storage not granted. Export routinely.',
    safari: {
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
      lastVerifiedAt: null,
    },
    ...overrides,
  };
}

describe('StorageHealthIndicator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the softened manual request label', () => {
    render(
      <StorageHealthIndicator
        storageHealth={buildStorageHealth()}
        onRequestStorageProtection={vi
          .fn()
          .mockResolvedValue(buildStorageHealth())}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Request durable storage' }),
    ).toBeInTheDocument();
  });

  it('preserves the polite status-region contract for storage posture guidance', () => {
    render(<StorageHealthIndicator storageHealth={buildStorageHealth()} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('does not render the request button when persistence is already granted', () => {
    render(
      <StorageHealthIndicator
        storageHealth={buildStorageHealth({ persisted: true })}
        onRequestStorageProtection={vi.fn()}
        isRequestingStorageProtection={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /durable storage/i }),
    ).toBeNull();
  });

  it('enforces a visible cooldown after a denied manual request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'));

    const onRequestStorageProtection = vi.fn().mockResolvedValue(
      buildStorageHealth({
        safari: {
          ...buildStorageHealth().safari,
          persistAttempted: true,
        },
      }),
    );

    render(
      <StorageHealthIndicator
        storageHealth={buildStorageHealth()}
        onRequestStorageProtection={onRequestStorageProtection}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Request durable storage' }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onRequestStorageProtection).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Request denied by browser' }),
    ).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(
      screen.getByRole('button', { name: 'Retry durable storage request' }),
    ).toBeEnabled();
  });

  it('shows install-specific helper text on iPhone and iPad browser risk paths', () => {
    render(
      <StorageHealthIndicator
        storageHealth={buildStorageHealth({
          safari: {
            ...buildStorageHealth().safari,
            installRecommended: true,
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        'Install to Home Screen, then request durable storage again. On iPhone and iPad, installation is the strongest protection path for local data.',
      ),
    ).toBeInTheDocument();
  });
});
