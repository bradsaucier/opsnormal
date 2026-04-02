import { expect, test } from '@playwright/test';

test.describe('OpsNormal mobile history', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders week-paginated history and updates the daily brief after day selection', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/mobile holds the history picture one week at a time/i)).toBeVisible();
    await expect(page.getByText('Daily brief')).toBeVisible();

    const dayButtons = page.locator('.history-scroll-shell-mobile button');
    await expect(dayButtons).toHaveCount(7);

    const dailyBriefHeading = page.getByRole('heading', { level: 3 }).filter({ hasText: /,/ }).first();
    const initialHeading = (await dailyBriefHeading.textContent()) ?? '';

    await page.getByRole('button', { name: /open daily brief for thu, mar 26, 2026/i }).click();

    await expect(dailyBriefHeading).not.toHaveText(initialHeading);
    await expect(page.getByText('Rest')).toBeVisible();
  });
});
