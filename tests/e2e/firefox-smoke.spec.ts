import {
  expect,
  test,
  type BrowserContext,
  type Download,
  type Page,
} from '@playwright/test';

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

async function openStorageHealth(page: Page) {
  const storageHealthToggle = page.getByRole('button', {
    name: /storage health/i,
  });
  await storageHealthToggle.click();
  await expect(
    page.getByText('Storage durability', { exact: true }),
  ).toBeVisible();
}

function sectorRadio(
  page: Page,
  sectorLabel: string,
  statusLabel: 'unmarked' | 'nominal' | 'degraded',
) {
  return page.getByRole('radio', {
    name: new RegExp(`^${sectorLabel} ${statusLabel}$`, 'i'),
  });
}

function waitForDownload(
  context: BrowserContext,
  page: Page,
): Promise<Download> {
  const downloadContext = context as BrowserContext & {
    on: (
      event: 'download',
      listener: (download: Download) => void,
    ) => BrowserContext;
    off: (
      event: 'download',
      listener: (download: Download) => void,
    ) => BrowserContext;
  };

  return new Promise((resolve) => {
    let resolved = false;

    const finish = (download: Download) => {
      if (resolved) {
        return;
      }

      resolved = true;
      downloadContext.off('download', handleDownload);
      resolve(download);
    };

    const handleDownload = (download: Download) => {
      finish(download);
    };

    downloadContext.on('download', handleDownload);
    void page.waitForEvent('download').then((download) => {
      finish(download);
    });
  });
}

test.describe('OpsNormal Firefox smoke', () => {
  test('boots on Gecko, renders the non-WebKit storage path, and avoids CSP refusal events', async ({
    page,
  }) => {
    await installCspViolationCollector(page);
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();

    await openStorageHealth(page);

    await expect(
      page.getByText(
        /Persistent storage active|Persistent storage not granted|Storage telemetry unavailable on this browser/i,
      ),
    ).toBeVisible();
    await expect(page.getByText('Browser tab', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/High-risk storage posture in Safari on macOS/i),
    ).toHaveCount(0);

    await expect.poll(() => getCspViolations(page)).toEqual([]);
  });

  test('persists a check-in across reload in the Firefox smoke lane', async ({
    page,
  }) => {
    await page.goto('/');

    const workDegraded = sectorRadio(page, 'Work or School', 'degraded');

    await workDegraded.click();
    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');

    await page.reload();

    await expect(workDegraded).toHaveAttribute('aria-checked', 'true');
  });

  test('registers the service worker through activation on Firefox', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();

    await expect
      .poll(
        async () => {
          return page.evaluate(async () => {
            const registration =
              await navigator.serviceWorker.getRegistration();

            return {
              activeState: registration?.active?.state ?? null,
              activeScriptUrl: registration?.active?.scriptURL ?? null,
              waitingState: registration?.waiting?.state ?? null,
              waitingScriptUrl: registration?.waiting?.scriptURL ?? null,
              installingState: registration?.installing?.state ?? null,
              installingScriptUrl: registration?.installing?.scriptURL ?? null,
            };
          });
        },
        {
          timeout: 30000,
          message:
            'Expected a registered service worker to reach the activated state on Firefox.',
        },
      )
      .toMatchObject({
        activeState: 'activated',
        activeScriptUrl: expect.stringContaining('/sw.js'),
      });
  });

  test('uses the fallback Blob download path for JSON export on Firefox', async ({
    page,
    context,
  }) => {
    const downloadPromise = waitForDownload(context, page);

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          return typeof (
            window as Window &
              typeof globalThis & {
                showSaveFilePicker?: unknown;
              }
          ).showSaveFilePicker;
        }),
      )
      .toBe('undefined');

    await page.getByRole('button', { name: 'Export JSON' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('opsnormal-export.json');
  });
});
