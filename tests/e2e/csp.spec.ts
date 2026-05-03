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
        originalPolicy: event.originalPolicy,
      });
    });
  });
}

async function getCspViolations(page: Page) {
  return page.evaluate(() => window.__opsCspViolations ?? []);
}

// Directive drift is pinned separately in tests/csp.directive.test.ts and
// tests/e2e/csp.directive.spec.ts. This suite only watches live runtime paths.
test.describe('OpsNormal CSP posture', () => {
  test('boots without CSP violations in Chromium', async ({ page }) => {
    await installCspViolationCollector(page);

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });

  test('renders the mobile history path without CSP violations in Chromium', async ({
    page,
  }) => {
    await installCspViolationCollector(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('radio', { name: /body nominal/i }).click();

    await expect(
      page.getByRole('region', { name: /weekly readiness history/i }),
    ).toBeVisible();
    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });

  test('renders the boot fallback surface without CSP violations in Chromium @harness', async ({
    page,
  }) => {
    await installCspViolationCollector(page);

    await page.goto('/tests/harness/boot-fallback-harness.html');

    await expect(page.locator('.ops-boot-fallback-title')).toHaveText(
      'OpsNormal failed to start',
    );
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.locator('.ops-boot-fallback-shell')).toHaveAttribute(
      'role',
      'alert',
    );
    await expect(page.locator('.ops-boot-fallback-shell')).not.toHaveAttribute(
      'aria-live',
      /./,
    );

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });

  test('renders the root crash fallback surface without CSP violations in Chromium @harness', async ({
    page,
  }) => {
    await installCspViolationCollector(page);

    await page.goto('/tests/harness/crash-fallback-harness.html');

    await expect(
      page.getByRole('heading', { name: 'OpsNormal stopped rendering' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Export JSON' }),
    ).toBeVisible();
    await expect(page.locator('[data-testid="app-crash-fallback"]')).toHaveCSS(
      'background-color',
      'rgb(10, 15, 13)',
    );
    await expect(page.locator('.ops-crash-fallback-title')).toHaveCSS(
      'text-transform',
      'uppercase',
    );

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });
});
