import { expect, test, type Page } from '@playwright/test';

type ServiceWorkerClientState = {
  isSupported: boolean;
  activeState: string | null;
  activeScriptUrl: string | null;
  controllerState: string | null;
  controllerScriptUrl: string | null;
};

async function openStorageHealth(page: Page) {
  const storageHealthToggle = page.getByRole('button', { name: /storage health/i });
  await storageHealthToggle.click();
  await expect(page.getByText(/storage durability/i)).toBeVisible();
}

function sectorRadio(page: Page, sectorLabel: string, statusLabel: 'unmarked' | 'nominal' | 'degraded') {
  return page.getByRole('radio', {
    name: new RegExp(`^${sectorLabel} ${statusLabel}$`, 'i')
  });
}

async function readServiceWorkerClientState(page: Page): Promise<ServiceWorkerClientState> {
  return page.evaluate(async (): Promise<ServiceWorkerClientState> => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return {
        isSupported: false,
        activeState: null,
        activeScriptUrl: null,
        controllerState: null,
        controllerScriptUrl: null
      };
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const controller = navigator.serviceWorker.controller;

    return {
      isSupported: true,
      activeState: registration?.active?.state ?? null,
      activeScriptUrl: registration?.active?.scriptURL ?? null,
      controllerState: controller?.state ?? null,
      controllerScriptUrl: controller?.scriptURL ?? null
    };
  });
}

async function waitForActiveServiceWorker(page: Page) {
  await expect
    .poll(() => readServiceWorkerClientState(page), {
      timeout: 30000,
      message: 'Expected a page-side WebKit service worker registration to reach the activated state.'
    })
    .toMatchObject({
      isSupported: true,
      activeState: 'activated',
      activeScriptUrl: expect.stringContaining('/sw.js')
    });
}

async function waitForControllingServiceWorker(page: Page) {
  await expect
    .poll(() => readServiceWorkerClientState(page), {
      timeout: 30000,
      message: 'Expected the WebKit page to be controlled by the active service worker before offline reopen.'
    })
    .toMatchObject({
      isSupported: true,
      controllerState: 'activated',
      controllerScriptUrl: expect.stringContaining('/sw.js')
    });
}

test.describe('OpsNormal WebKit smoke', () => {
  test('loads the shell and surfaces the natural Safari-family backup prompt', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safari tab risk requires a fresh backup' })).toBeVisible();
  });

  test('renders the natural WebKit storage warning path inside the storage-health panel', async ({ page }) => {
    await page.goto('/');
    await openStorageHealth(page);

    await expect(
      page.getByText(
        'High-risk storage posture on Safari-family browsers. Local browser data can disappear without backup. Export routinely.'
      )
    ).toBeVisible();
    await expect(page.getByText('Browser tab', { exact: true })).toBeVisible();
  });

  test('persists a check-in across reload in the WebKit smoke lane', async ({ page }) => {
    await page.goto('/');

    const workDegraded = sectorRadio(page, 'Work or School', 'degraded');

    await workDegraded.click();
    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');

    await page.reload();

    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');
  });

  test('reopens offline after the first controlled load in the WebKit smoke lane', async ({ page, context }) => {
    test.slow();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();

    await waitForActiveServiceWorker(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();

    await waitForControllingServiceWorker(page);

    const relationshipsNominal = sectorRadio(page, 'Relationships', 'nominal');
    await relationshipsNominal.click();
    await expect(relationshipsNominal).toHaveAttribute('aria-checked', 'true');

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'OpsNormal' })).toBeVisible();
    await expect(sectorRadio(page, 'Relationships', 'nominal')).toHaveAttribute('aria-checked', 'true');
  });

  test('clears the Safari-tab backup banner after recording a fresh backup timestamp', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(async () => {
      const storageTestApi = (window as typeof window & {
        __opsNormalStorageTestApi__?: {
          setLastBackupAt: (lastBackupAt: string | null) => void;
          refreshStorageHealth: () => Promise<void>;
        };
      }).__opsNormalStorageTestApi__;

      storageTestApi?.setLastBackupAt(new Date().toISOString());
      await storageTestApi?.refreshStorageHealth();
    });

    await expect(
      page.getByRole('heading', { name: 'Safari tab risk requires a fresh backup' })
    ).toHaveCount(0);
  });
});
