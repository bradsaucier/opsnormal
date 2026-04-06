import { expect, test, type Page } from '@playwright/test';

function sectorRadio(page: Page, sectorLabel: string, statusLabel: 'unmarked' | 'nominal' | 'degraded') {
  return page.getByRole('radio', {
    name: new RegExp(`^${sectorLabel} ${statusLabel}$`, 'i')
  });
}

test.describe('OpsNormal', () => {
  test('skip link targets main content', async ({ page }) => {
    await page.goto('/');

    const skipLink = page.locator('.ops-skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
  });

  test('persists a check-in across reloads', async ({ page }) => {
    await page.goto('/');

    const storageHealthToggle = page.getByRole('button', { name: /storage health/i });
    await expect(storageHealthToggle).toBeVisible();
    await storageHealthToggle.click();
    await expect(page.getByText(/storage durability/i)).toBeVisible();

    const workNominal = sectorRadio(page, 'Work or School', 'nominal');
    const workDegraded = sectorRadio(page, 'Work or School', 'degraded');

    await workNominal.click();
    await expect(workNominal).toHaveAttribute('aria-checked', 'true');
    await expect(workNominal).toBeEnabled();

    await workDegraded.click();
    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');
    await expect(workDegraded).toBeEnabled();

    await page.reload();
    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');
  });

  test('keeps inset focus styling and prevents page scroll on keyboard selection', async ({ page }) => {
    await page.goto('/');

    const workUnmarked = sectorRadio(page, 'Work or School', 'unmarked');
    const workNominal = sectorRadio(page, 'Work or School', 'nominal');

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await workUnmarked.evaluate((element) => document.activeElement === element)) {
        break;
      }

      await page.keyboard.press('Tab');
    }

    await expect(workUnmarked).toBeFocused();

    const focusShadow = await workUnmarked.evaluate(
      (element) => window.getComputedStyle(element).boxShadow
    );
    expect(focusShadow.toLowerCase()).toContain('inset');

    const initialScrollY = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowRight');
    await expect(workNominal).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Space');
    await expect(workNominal).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
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
