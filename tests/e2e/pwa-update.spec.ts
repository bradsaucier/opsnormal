/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('OpsNormal service worker update posture', () => {
  test('surfaces the update banner when a newer service worker is detected', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

    const currentServiceWorker = await readFile('dist/sw.js', 'utf-8');
    let updateServed = false;

    await context.route('**/sw.js*', async (route) => {
      if (!updateServed) {
        updateServed = true;

        await route.fulfill({
          contentType: 'application/javascript',
          body: `${currentServiceWorker}
// opsnormal-playwright-update-marker`
        });
        return;
      }

      await route.continue();
    });

    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByRole('heading', { name: 'Update Ready' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  });
});
