import { expect, test } from '@playwright/test';

test.describe('OpsNormal', () => {
  test('persists a check-in across reloads', async ({ page }) => {
    await page.goto('/');

    const storageHealthToggle = page.getByRole('button', { name: /storage health/i });
    await expect(storageHealthToggle).toBeVisible();
    await storageHealthToggle.click();
    await expect(page.getByText(/storage durability/i)).toBeVisible();

    const workButton = page.getByRole('button', { name: /work or school/i });

    await workButton.click();
    await expect(workButton).toContainText('NOMINAL');

    await workButton.click();
    await expect(workButton).toContainText('DEGRADED');

    await page.reload();
    await expect(workButton).toContainText('DEGRADED');
  });

  test('can reopen offline after first load', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
  });
});
