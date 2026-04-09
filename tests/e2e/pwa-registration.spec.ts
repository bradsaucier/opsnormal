import { expect, test } from '@playwright/test';

test.describe('OpsNormal service worker registration', () => {
  test('registers the service worker in Chromium', async ({ page, context }) => {
    const serviceWorkerPromise = context.waitForEvent('serviceworker');

    await page.goto('/');

    const serviceWorker = await serviceWorkerPromise;

    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();

          return {
            activeState: registration?.active?.state ?? null,
            activeScriptUrl: registration?.active?.scriptURL ?? null,
            waitingState: registration?.waiting?.state ?? null,
            waitingScriptUrl: registration?.waiting?.scriptURL ?? null,
            installingState: registration?.installing?.state ?? null,
            installingScriptUrl: registration?.installing?.scriptURL ?? null
          };
        });
      }, {
        timeout: 30000,
        message: 'Expected a registered service worker to reach an installable or active state.'
      })
      .toMatchObject({
        activeState: 'activated',
        activeScriptUrl: expect.stringContaining('/sw.js')
      });

    expect(serviceWorker.url()).toContain('/sw.js');
  });
});
