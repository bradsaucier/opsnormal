import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __opsCspViolations?: Array<{
      blockedURI: string;
      violatedDirective: string;
      originalPolicy: string;
    }>;
  }
}

async function installCspViolationCollector(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__opsCspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__opsCspViolations?.push({
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy
      });
    });
  });
}

async function getCspViolations(page: Page) {
  return page.evaluate(() => window.__opsCspViolations ?? []);
}

test.describe('OpsNormal CSP posture', () => {
  test('boots without CSP violations in Chromium', async ({ page }) => {
    await installCspViolationCollector(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });

  test('renders the boot fallback surface without CSP violations in Chromium', async ({ page }) => {
    await installCspViolationCollector(page);

    await page.goto('/boot-fallback-harness.html');

    await expect(page.locator('.ops-boot-fallback-title')).toHaveText('OpsNormal failed to start');
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.locator('.ops-boot-fallback-shell')).toHaveAttribute('role', 'alert');
    await expect(page.locator('.ops-boot-fallback-shell')).not.toHaveAttribute('aria-live', /./);

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });
});
