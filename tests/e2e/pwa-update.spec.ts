/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('OpsNormal service worker update posture', () => {
  test('surfaces the update banner when a newer service worker is detected', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

    const currentServiceWorker = await readFile('dist/sw.js', 'utf-8');
    const updatedServiceWorker = `${currentServiceWorker}\n// opsnormal-playwright-update-marker\n`;

    await context.route('**/sw.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: updatedServiceWorker
      });
    });

    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByRole('heading', { name: 'Update Ready' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible({ timeout: 10000 });
  });
});
