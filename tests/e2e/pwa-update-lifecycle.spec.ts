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

async function queueForegroundUpdateReady(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.__opsNormalPwaTestApi__?.queueForegroundUpdateReady();
  });
}

async function getForegroundRevalidationCount(page: import('@playwright/test').Page) {
  return page.evaluate(() => window.__opsNormalPwaTestApi__?.getForegroundRevalidationCount() ?? 0);
}

async function dispatchSyntheticForegroundReturn(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
}

function getPwaUpdateBanner(page: import('@playwright/test').Page) {
  return page.getByTestId('pwa-update-banner');
}

test.describe('OpsNormal PWA update lifecycle', () => {
  test('surfaces a queued update on a synthetic foreground return without repeated revalidation churn @harness', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const appUrl = 'http://127.0.0.1:4173/';
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto(appUrl);
    await pageB.goto(appUrl);
    await pageB.bringToFront();

    await queueForegroundUpdateReady(pageA);
    await dispatchSyntheticForegroundReturn(pageA);

    await expect(pageA.getByRole('heading', { name: 'Update Ready' })).toBeVisible();
    await expect.poll(() => getForegroundRevalidationCount(pageA)).toBe(1);

    await dispatchSyntheticForegroundReturn(pageA);
    await dispatchSyntheticForegroundReturn(pageA);

    await expect.poll(() => getForegroundRevalidationCount(pageA)).toBe(1);

    await context.close();
  });

  test('reloads both tabs through the synthetic controller handoff without losing the visible check-in state @harness', async ({ browser }) => {
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

    const pageBReloadPromise = pageB.waitForNavigation({ waitUntil: 'domcontentloaded' });
    const versionChangeResult = await pageB.evaluate(() => window.__opsNormalDbTestApi__?.simulateVersionChange() ?? 'noop');
    expect(versionChangeResult).toBe('reloading');
    await pageBReloadPromise;

    const pageAReloadPromise = pageA.waitForNavigation({ waitUntil: 'domcontentloaded' });
    await dispatchControllerChange(pageA);
    await pageAReloadPromise;

    const pageANavigationType = await pageA.evaluate((): string => {
      const lastNavigationEntry = performance.getEntriesByType('navigation').at(-1);
      if (!(lastNavigationEntry instanceof PerformanceNavigationTiming)) {
        return 'navigate';
      }

      return lastNavigationEntry.type;
    });
    expect(pageANavigationType).toBe('reload');

    const pageBNavigationType = await pageB.evaluate((): string => {
      const lastNavigationEntry = performance.getEntriesByType('navigation').at(-1);
      if (!(lastNavigationEntry instanceof PerformanceNavigationTiming)) {
        return 'navigate';
      }

      return lastNavigationEntry.type;
    });
    expect(pageBNavigationType).toBe('reload');

    await expect(pageA.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(pageB.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(pageA.getByRole('radio', { name: /^Work or School nominal$/i })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pageA.evaluate(() => window.__opsNormalDbTestApi__?.isRecoveryRequired() ?? true)).toBe(false);
    await expect.poll(() => pageB.evaluate(() => window.__opsNormalDbTestApi__?.isRecoveryRequired() ?? true)).toBe(false);

    await context.close();
  });

  test('pins loop-breaker guidance after repeated automatic reload bookkeeping is detected', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/');

    await page.evaluate(() => {
      window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
      window.sessionStorage.setItem('opsnormal-sw-controller-reload-last-at', String(Date.now()));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    const updateBanner = getPwaUpdateBanner(page);

    await expect(updateBanner.getByRole('heading', { name: 'Update Recovery Required' })).toBeVisible();
    await expect(updateBanner.getByText(/update loop intercepted/i)).toBeVisible();
    await expect(updateBanner.getByRole('button', { name: /reload tab/i })).toBeVisible();
    await expect(updateBanner.getByRole('button', { name: /dismiss/i })).toHaveCount(0);
  });

  test('clears stale recovery guidance in a second tab when manual recovery starts', async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const appUrl = 'http://127.0.0.1:4173/';
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto(appUrl);
    await pageB.goto(appUrl);

    for (const page of [pageA, pageB]) {
      await page.evaluate(() => {
        window.sessionStorage.setItem('opsnormal-sw-controller-reload-count', '2');
        window.sessionStorage.setItem('opsnormal-sw-controller-reload-last-at', String(Date.now()));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(getPwaUpdateBanner(page).getByRole('heading', { name: 'Update Recovery Required' })).toBeVisible();
    }

    const pageAReloadPromise = pageA.waitForNavigation({ waitUntil: 'domcontentloaded' });
    await pageA.getByRole('button', { name: /reload tab/i }).click();
    await pageAReloadPromise;

    await expect(pageB.getByRole('heading', { name: 'Update Recovery Required' })).toHaveCount(0);
    await expect.poll(() => pageB.evaluate(() => window.sessionStorage.getItem('opsnormal-sw-controller-reload-count'))).toBeNull();

    await context.close();
  });

  test('pins stalled handoff guidance until the operator reloads @harness', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/');

    await markUpdateReady(page);
    await page.getByRole('button', { name: /apply update/i }).click();

    const updateBanner = getPwaUpdateBanner(page);

    await expect(updateBanner.getByText(/update handoff did not complete/i)).toBeVisible({ timeout: 5000 });
    await expect(updateBanner.getByRole('button', { name: /reload tab/i })).toBeVisible();
    await expect(updateBanner.getByRole('button', { name: /dismiss/i })).toHaveCount(0);
  });
});
