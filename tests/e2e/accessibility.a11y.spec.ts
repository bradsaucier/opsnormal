import type { AxeResults } from 'axe-core';

import { test, expect } from '../fixtures/a11y-fixture';

const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';

function formatViolations(violations: AxeResults['violations']): string {
  if (violations.length === 0) {
    return 'No accessibility violations detected.';
  }

  return violations
    .map((violation) => {
      const impact = violation.impact ?? 'unclassified';
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .map((target) => `- ${target}`)
        .join('\n');

      return `${violation.id} [${impact}] ${violation.help}\n${targets}`;
    })
    .join('\n\n');
}

test.describe('OpsNormal accessibility regression coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
  });

  test('passes WCAG 2.1 AA checks on the desktop app shell', async ({ page, makeAxeBuilder }) => {
    await page.goto('/');

    const results = await makeAxeBuilder().analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('preserves direct-select radiogroup semantics after a status change', async ({ page, makeAxeBuilder }) => {
    await page.goto('/');

    const radiogroup = page.getByRole('radiogroup', { name: /work or school status/i });
    await page.getByRole('radio', { name: /^Work or School nominal$/i }).click();

    await expect(radiogroup).toMatchAriaSnapshot({ name: 'work-or-school-radiogroup.aria.yml' });

    const results = await makeAxeBuilder().include('[role="radiogroup"]').analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('uses standard mobile history region semantics and passes WCAG 2.1 AA checks', async ({
    page,
    makeAxeBuilder
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const mobileHistoryRegion = page.getByRole('region', { name: /weekly readiness history/i });

    await expect(mobileHistoryRegion).toBeVisible();
    await expect(mobileHistoryRegion).not.toHaveAttribute('aria-roledescription', 'carousel');

    const results = await makeAxeBuilder().include('#main-content').analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});
