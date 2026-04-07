import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function markUpdateReady(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.__opsNormalPwaTestApi__?.markUpdateReady();
  });
}

async function dispatchControllerChange(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.__opsNormalPwaTestApi__?.dispatchControllerChange();
  });
}

test.describe('OpsNormal PWA update lifecycle', () => {
  test('reloads both tabs through the synthetic controller handoff without losing the visible check-in state', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const appUrl = 'http://127.0.0.1:4173/';
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto(appUrl);
    await pageB.goto(appUrl);

    const workNominal = pageA.getByRole('radio', { name: /^Work or School nominal$/i });
    await workNominal.click();
    await expect(workNominal).toHaveAttribute('aria-checked', 'true');

    await markUpdateReady(pageA);
    await expect(pageA.getByRole('heading', { name: 'Update Ready' })).toBeVisible();

    await pageA.getByRole('button', { name: /apply update/i }).click();

    await expect.poll(() => pageB.evaluate(() => window.__opsNormalDbTestApi__?.simulateVersionChange() ?? 'noop')).toBe('reloading');
    await expect.poll(() => pageB.evaluate(() => window.__opsNormalDbTestApi__?.isRecoveryRequired() ?? false)).toBe(true);

    await dispatchControllerChange(pageA);

    await expect.poll(() =>
      pageA.evaluate((): string => {
        const lastNavigationEntry = performance.getEntriesByType('navigation').at(-1);
        if (!(lastNavigationEntry instanceof PerformanceNavigationTiming)) {
          return 'navigate';
        }

        return lastNavigationEntry.type;
      })
    ).toBe('reload');
    await expect.poll(() =>
      pageB.evaluate((): string => {
        const lastNavigationEntry = performance.getEntriesByType('navigation').at(-1);
        if (!(lastNavigationEntry instanceof PerformanceNavigationTiming)) {
          return 'navigate';
        }

        return lastNavigationEntry.type;
      })
    ).toBe('reload');

    await expect(pageA.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(pageB.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(pageA.getByRole('radio', { name: /^Work or School nominal$/i })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pageA.evaluate(() => window.__opsNormalDbTestApi__?.isRecoveryRequired() ?? true)).toBe(false);
    await expect.poll(() => pageB.evaluate(() => window.__opsNormalDbTestApi__?.isRecoveryRequired() ?? true)).toBe(false);

    await context.close();
  });

  test('pins stalled handoff guidance until the operator reloads', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/');

    await markUpdateReady(page);
    await page.getByRole('button', { name: /apply update/i }).click();

    await expect(page.getByText(/update handoff did not complete/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /reload tab/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dismiss/i })).toHaveCount(0);
  });
});
