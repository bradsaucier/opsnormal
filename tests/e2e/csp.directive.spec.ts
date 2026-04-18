import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  EXPECTED_DIRECTIVES,
  parseDirectiveRecord,
} from '../support/cspDirectiveContract';

declare global {
  interface Window {
    __opsCspViolations?: Array<{
      blockedURI: string;
      violatedDirective: string;
      originalPolicy: string;
    }>;
  }
}

const CONTRACT_ROUTES = [
  '/',
  '/tests/harness/boot-fallback-harness.html',
  '/tests/harness/crash-fallback-harness.html',
] as const;

function skipUnlessChromiumProject(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== 'chromium',
    'CSP directive contract is asserted only on the Chromium project.',
  );
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

test.describe('OpsNormal CSP directive contract', () => {
  for (const route of CONTRACT_ROUTES) {
    test(`serves the expected meta CSP directives at ${route}`, async ({
      page,
    }, testInfo) => {
      skipUnlessChromiumProject(testInfo);

      await page.goto(route);

      const policy = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute('content');

      expect(policy).toBeTruthy();
      expect(parseDirectiveRecord(policy ?? '')).toEqual(EXPECTED_DIRECTIVES);
    });
  }

  test('blocks javascript URI execution and records one CSP violation', async ({
    page,
  }, testInfo) => {
    skipUnlessChromiumProject(testInfo);

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await installCspViolationCollector(page);
    await page.goto('/');

    await expect.poll(() => getCspViolations(page)).toEqual([]);

    await page.evaluate(() => {
      location.href = 'javascript:alert(1)';
    });

    await expect
      .poll(async () => (await getCspViolations(page)).length)
      .toBe(1);

    const violations = await getCspViolations(page);

    expect(violations[0]?.violatedDirective).toMatch(/script-src/i);
    expect(dialogs).toEqual([]);
  });
});
