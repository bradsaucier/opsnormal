import { expect, test } from '@playwright/test';

const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';

test.describe('OpsNormal desktop history', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
  });

  test('supports keyboard traversal and keeps the selected-cell brief aligned on desktop', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /body nominal/i }).click();

    const grid = page.getByRole('grid');
    const selectedCell = () =>
      page.locator('[role="gridcell"][aria-selected="true"]').first();
    const selectedSummary = page.locator('#history-grid-status-summary');

    await expect(grid).toBeVisible();
    await expect(
      page.getByText(/desktop holds the full 30-day picture/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /previous week/i }),
    ).toHaveCount(0);

    await expect(selectedCell()).toHaveAttribute(
      'aria-label',
      /Work or School on Sat, Mar 28, 2026: UNMARKED\./i,
    );
    await selectedCell().focus();

    await page.keyboard.press('ArrowDown');
    await expect(selectedCell()).toHaveAttribute(
      'aria-label',
      /Household on Sat, Mar 28, 2026: UNMARKED\./i,
    );
    await expect(selectedSummary).toHaveText(
      /Household on Sat, Mar 28, 2026 is UNMARKED\./i,
    );

    await page.keyboard.press('PageUp');
    await expect(selectedCell()).toHaveAttribute(
      'aria-label',
      /Household on Sat, Mar 21, 2026: UNMARKED\./i,
    );
    await expect(selectedSummary).toHaveText(
      /Household on Sat, Mar 21, 2026 is UNMARKED\./i,
    );

    await page.keyboard.press('Home');
    await expect(selectedCell()).toHaveAttribute(
      'aria-label',
      /Household on Fri, Feb 27, 2026: UNMARKED\./i,
    );

    await page.keyboard.press('Control+End');
    await expect(selectedCell()).toHaveAttribute(
      'aria-label',
      /Rest on Sat, Mar 28, 2026: UNMARKED\./i,
    );
    await expect(selectedSummary).toHaveText(
      /Rest on Sat, Mar 28, 2026 is UNMARKED\./i,
    );
    await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(
      1,
    );
  });
});
