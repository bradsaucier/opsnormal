import { expect, test, type Page, type TestInfo } from '@playwright/test';

declare global {
  interface Window {
    __opsCspViolations?: Array<{
      blockedURI: string;
      violatedDirective: string;
      originalPolicy: string;
    }>;
  }
}

const EXPECTED_DIRECTIVES: Record<string, string> = {
  'default-src': "'none'",
  'script-src': "'self'",
  'style-src': "'self'",
  'img-src': "'self' data:",
  'font-src': "'self'",
  'manifest-src': "'self'",
  'worker-src': "'self'",
  'connect-src': "'self'",
  'base-uri': "'self'",
  'form-action': "'none'",
  'object-src': "'none'",
  'require-trusted-types-for': "'script'",
  'trusted-types': 'opsnormal-default',
};

function skipUnlessChromiumProject(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== 'chromium',
    'CSP directive contract is asserted only on the Chromium project.',
  );
}

function parseDirectiveRecord(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...valueParts] = directive.split(/\s+/);

        if (!name) {
          throw new Error('Encountered an empty CSP directive name.');
        }

        return [name, valueParts.join(' ')];
      }),
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
  test('serves the expected meta CSP directives', async ({
    page,
  }, testInfo) => {
    skipUnlessChromiumProject(testInfo);

    await page.goto('/');

    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');

    expect(policy).toBeTruthy();
    expect(parseDirectiveRecord(policy ?? '')).toEqual(EXPECTED_DIRECTIVES);
  });

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
