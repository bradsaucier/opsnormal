import { expect, test } from '@playwright/test';

test.describe('OpsNormal service worker registration', () => {
  test('registers the service worker in Chromium', async ({ page, context }) => {
    const serviceWorkerPromise = context.waitForEvent('serviceworker');

    await page.goto('/');

    const serviceWorker = await serviceWorkerPromise;

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration?.active?.state === 'activated') {
        return;
      }

      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    });

    expect(serviceWorker.url()).toContain('/sw.js');
  });
});
