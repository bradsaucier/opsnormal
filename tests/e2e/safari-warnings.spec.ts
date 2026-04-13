import { expect, test, type Page } from '@playwright/test';

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

async function waitForStorageTestApi(page: Page) {
  await page.waitForFunction(
    () => typeof window.__opsNormalStorageTestApi__ !== 'undefined',
  );
}

async function setSyntheticStorageState(
  page: Page,
  storageHealth: StorageHealth,
  lastBackupAt: string | null,
) {
  await waitForStorageTestApi(page);

  await page.evaluate(
    async ({ nextStorageHealth, nextLastBackupAt }) => {
      window.__opsNormalStorageTestApi__?.setLastBackupAt(nextLastBackupAt);
      window.__opsNormalStorageTestApi__?.setStorageHealth(nextStorageHealth);
      await window.__opsNormalStorageTestApi__?.refreshStorageHealth();
    },
    {
      nextStorageHealth: storageHealth,
      nextLastBackupAt: lastBackupAt,
    },
  );
}

async function openStorageHealth(page: Page) {
  const storageHealthToggle = page.getByRole('button', {
    name: /storage health/i,
  });
  await storageHealthToggle.click();
  await expect(
    page.getByText('Storage durability', { exact: true }),
  ).toBeVisible();
}

function isoDaysBefore(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test.describe('@harness OpsNormal Safari storage warning harness', () => {
  test('surfaces a fresh-backup order for stale Safari browser-tab risk', async ({
    page,
  }) => {
    await page.goto('/');

    await setSyntheticStorageState(
      page,
      buildStorageHealth({
        status: 'warning',
        message:
          'High-risk storage posture in Safari on macOS. Local browser data can disappear without backup. Export routinely.',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
        },
      }),
      isoDaysBefore(9),
    );

    await expect(
      page.getByRole('heading', {
        name: 'Safari tab risk requires a fresh backup',
      }),
    ).toBeVisible();
    await expect(page.getByText(/Refresh the JSON export now/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open backup and recovery' }),
    ).toHaveAttribute('href', '#backup-and-recovery');
  });

  test('stays quiet when Safari browser-tab risk still has a fresh backup inside the warning buffer', async ({
    page,
  }) => {
    await page.goto('/');

    await setSyntheticStorageState(
      page,
      buildStorageHealth({
        status: 'warning',
        message:
          'High-risk storage posture in Safari on macOS. Local browser data can disappear without backup. Export routinely.',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
        },
      }),
      isoDaysBefore(2),
    );

    await expect(
      page.getByRole('heading', {
        name: 'Safari tab risk requires a fresh backup',
      }),
    ).toHaveCount(0);
  });

  test('prioritizes reconnect guidance over stale Safari-tab guidance', async ({
    page,
  }) => {
    await page.goto('/');

    await setSyntheticStorageState(
      page,
      buildStorageHealth({
        status: 'warning',
        message:
          'Local database reconnection failed. Reload the app, confirm the last visible check-in, and export before further edits.',
        safari: {
          ...buildStorageHealth().safari,
          reconnectState: 'failed',
          reconnectFailures: 1,
          lastReconnectError: 'Connection to Indexed Database server lost',
          webKitRisk: true,
        },
      }),
      isoDaysBefore(9),
    );

    await expect(
      page.getByRole('heading', {
        name: 'Confirm state and refresh the JSON backup',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Recent storage diagnostics show a reconnect/i),
    ).toBeVisible();
  });

  test('renders install guidance for synthetic iPhone and iPad browser risk', async ({
    page,
  }) => {
    await page.goto('/');

    await setSyntheticStorageState(
      page,
      buildStorageHealth({
        status: 'warning',
        message:
          'High-risk storage posture on iPhone or iPad. Browser data can be evicted after inactivity. Install to Home Screen and export routinely.',
        safari: {
          ...buildStorageHealth().safari,
          installRecommended: true,
          webKitRisk: true,
        },
      }),
      null,
    );

    await openStorageHealth(page);

    await expect(
      page.getByText(
        'Install to Home Screen, then request durable storage again. On iPhone and iPad, installation is the strongest protection path for local data.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Browser tab - install recommended'),
    ).toBeVisible();
  });
});
