import { expect, test } from '@playwright/test';

test.describe('OpsNormal mobile history', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders week-paginated history, supports explicit week controls, and updates the daily brief', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /body nominal/i }).click();

    await expect(
      page.getByText(/mobile holds the history picture one week at a time/i),
    ).toBeVisible();
    await expect(page.getByText('Daily brief', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /previous week/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /next week/i }),
    ).toBeVisible();

    const weekCards = page.locator('.history-week-card');
    await expect(weekCards).toHaveCount(5);

    const firstWeekButtons = weekCards.first().getByRole('button');
    await expect(firstWeekButtons).toHaveCount(7);

    const allDayButtons = page.locator('.history-scroll-shell-mobile button');
    await expect(allDayButtons).toHaveCount(30);

    const weekStatus = page.getByTestId('mobile-history-week-status');
    const previousWeekButton = page.getByRole('button', {
      name: /previous week/i,
    });
    const nextWeekButton = page.getByRole('button', { name: /next week/i });
    const dailyBrief = page.locator('#mobile-history-daily-brief');
    const dailyBriefHeading = dailyBrief
      .getByRole('heading', { level: 3 })
      .first();
    const initialHeading = (await dailyBriefHeading.textContent()) ?? '';

    await expect(nextWeekButton).toBeDisabled();
    await expect(weekStatus).toContainText('Week 5 of 5');

    await previousWeekButton.click();

    await expect(weekStatus).toContainText('Week 4 of 5');
    await expect(dailyBriefHeading).not.toHaveText(initialHeading);
    await expect(nextWeekButton).toBeEnabled();

    const headingAfterWeekStep = (await dailyBriefHeading.textContent()) ?? '';
    const weekFourTargetButton = weekCards.nth(3).getByRole('button').nth(2);
    await expect(weekFourTargetButton).toBeVisible();
    await weekFourTargetButton.click({ force: true });

    await expect(dailyBriefHeading).not.toHaveText(headingAfterWeekStep);
    await expect(dailyBrief.getByText('Rest', { exact: true })).toBeVisible();

    await nextWeekButton.click();
    await expect(weekStatus).toContainText('Week 5 of 5');
  });
});
