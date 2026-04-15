import type { AxeResults } from 'axe-core';
import type { Page } from '@playwright/test';

import { OPSNORMAL_DB_BLOCKED_EVENT_NAME } from '../../src/db/appDb';
import type { StorageHealth } from '../../src/lib/storage';
import { expect, test } from '../fixtures/a11y-fixture';

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
        .map((target) => `- ${String(target)}`)
        .join('\n');

      return `${violation.id} [${impact}] ${violation.help}\n${targets}`;
    })
    .join('\n\n');
}

function buildStorageHealth(
  overrides: Partial<StorageHealth> = {},
): StorageHealth {
  return {
    persisted: false,
    persistenceAvailable: true,
    estimateAvailable: true,
    usageBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    status: 'warning',
    message:
      'Recent local write verification failed. Confirm the latest visible check-in, export now, then reload before continuing.',
    safari: {
      connectionDropsDetected: 0,
      reconnectSuccesses: 0,
      reconnectFailures: 0,
      reconnectState: 'failed',
      lastReconnectError: null,
      persistAttempted: false,
      persistGranted: false,
      standaloneMode: false,
      installRecommended: false,
      webKitRisk: true,
      lastVerificationResult: 'mismatch',
      lastVerifiedAt: null,
    },
    ...overrides,
  };
}

const SAFARI_WARNING_STORAGE_HEALTH: StorageHealth = buildStorageHealth();

async function waitForStorageTestApi(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__opsNormalStorageTestApi__ !== 'undefined',
  );
}

test.describe('OpsNormal recovery-surface accessibility coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
  });

  test('Import and Restore section passes WCAG 2.1 AA when opened', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');

    const importHeader = page.getByRole('button', {
      name: /import and restore/i,
    });
    await importHeader.click();
    await expect(importHeader).toHaveAttribute('aria-expanded', 'true');

    const importRegion = page.getByRole('region', {
      name: /import and restore/i,
    });
    await expect(importRegion).toBeVisible();
    const importRegionId = await importHeader.getAttribute('aria-controls');
    if (!importRegionId) {
      throw new Error('Import and Restore region id not found.');
    }

    const results = await makeAxeBuilder()
      .include(`#${importRegionId}`)
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Undo and Recovery section passes WCAG 2.1 AA when opened', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');

    const undoHeader = page.getByRole('button', { name: /undo and recovery/i });
    await undoHeader.click();
    await expect(undoHeader).toHaveAttribute('aria-expanded', 'true');

    const undoRegion = page.getByRole('region', { name: /undo and recovery/i });
    await expect(undoRegion).toBeVisible();
    const undoRegionId = await undoHeader.getAttribute('aria-controls');
    if (!undoRegionId) {
      throw new Error('Undo and Recovery region id not found.');
    }

    const results = await makeAxeBuilder().include(`#${undoRegionId}`).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Storage Health section passes WCAG 2.1 AA with Safari-risk signals', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');
    await waitForStorageTestApi(page);

    await page.evaluate((health) => {
      window.__opsNormalStorageTestApi__?.setStorageHealth(health);
    }, SAFARI_WARNING_STORAGE_HEALTH);

    const storageHeader = page.getByRole('button', { name: /storage health/i });
    await storageHeader.click();
    await expect(storageHeader).toHaveAttribute('aria-expanded', 'true');

    const storageRegion = page.getByRole('region', { name: /storage health/i });
    await expect(storageRegion).toBeVisible();
    const storageRegionId = await storageHeader.getAttribute('aria-controls');
    if (!storageRegionId) {
      throw new Error('Storage Health region id not found.');
    }

    const results = await makeAxeBuilder()
      .include(`#${storageRegionId}`)
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Backup Action Banner warning passes WCAG 2.1 AA', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');
    await waitForStorageTestApi(page);

    await page.evaluate((health) => {
      window.__opsNormalStorageTestApi__?.setStorageHealth(health);
      window.__opsNormalStorageTestApi__?.setLastBackupAt(null);
    }, SAFARI_WARNING_STORAGE_HEALTH);
    await page.evaluate(async () => {
      await window.__opsNormalStorageTestApi__?.refreshStorageHealth();
    });

    const banner = page.getByRole('alert', {
      name: /confirm state and refresh the json backup/i,
    });
    await expect(banner).toBeVisible();

    const results = await makeAxeBuilder()
      .include('[aria-labelledby="backup-action-banner-title"]')
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Database upgrade blocked alert passes WCAG 2.1 AA', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/');

    await page.evaluate((eventName) => {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            message:
              'A newer version of OpsNormal is trying to upgrade the local database.',
          },
        }),
      );
    }, OPSNORMAL_DB_BLOCKED_EVENT_NAME);

    const alert = page.getByRole('alert', {
      name: /database upgrade blocked/i,
    });
    await expect(alert).toBeVisible();

    const results = await makeAxeBuilder()
      .include('[aria-labelledby="database-upgrade-blocked-title"]')
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Boot-fallback harness passes WCAG 2.1 AA', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/tests/harness/boot-fallback-harness.html');

    await expect(page.locator('.ops-boot-fallback-shell')).toBeVisible();

    const results = await makeAxeBuilder().analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Crash-fallback harness passes WCAG 2.1 AA', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/tests/harness/crash-fallback-harness.html');

    await expect(
      page.getByRole('button', { name: /export/i }).first(),
    ).toBeVisible();

    const results = await makeAxeBuilder().analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});
