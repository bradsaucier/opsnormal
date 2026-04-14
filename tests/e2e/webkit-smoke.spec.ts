import { expect, test, type Page } from '@playwright/test';

const LAST_EXPORT_AT_KEY = 'opsnormal-last-export-at';

async function openStorageHealth(page: Page) {
  const storageHealthToggle = page.getByRole('button', {
    name: /storage health/i,
  });
  await storageHealthToggle.click();
  await expect(
    page.getByText('Storage durability', { exact: true }),
  ).toBeVisible();
}

function sectorRadio(
  page: Page,
  sectorLabel: string,
  statusLabel: 'unmarked' | 'nominal' | 'degraded',
) {
  return page.getByRole('radio', {
    name: new RegExp(`^${sectorLabel} ${statusLabel}$`, 'i'),
  });
}

test.describe('OpsNormal WebKit release smoke', () => {
  test('loads the shell and surfaces the natural Apple WebKit backup prompt', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Safari tab risk requires a fresh backup',
      }),
    ).toBeVisible();
  });

  test('renders the natural WebKit storage warning path inside the storage-health panel', async ({
    page,
  }) => {
    await page.goto('/');
    await openStorageHealth(page);

    await expect(
      page.getByText(
        'High-risk storage posture in Safari on macOS. Local browser data can disappear without backup. Export routinely.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Browser tab', { exact: true })).toBeVisible();
  });

  test('persists a check-in across reload in the WebKit release smoke lane', async ({
    page,
  }) => {
    await page.goto('/');

    const workDegraded = sectorRadio(page, 'Work or School', 'degraded');

    await workDegraded.click();
    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');

    await page.reload();

    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');
  });

  test('suppresses the Safari-tab backup banner when a fresh backup timestamp already exists in browser storage', async ({
    page,
  }) => {
    const freshBackupAt = new Date().toISOString();

    await page.addInitScript(
      ({ storageKey, timestamp }) => {
        window.localStorage.setItem(storageKey, timestamp);
      },
      {
        storageKey: LAST_EXPORT_AT_KEY,
        timestamp: freshBackupAt,
      },
    );

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Safari tab risk requires a fresh backup',
      }),
    ).toHaveCount(0);
  });
});
