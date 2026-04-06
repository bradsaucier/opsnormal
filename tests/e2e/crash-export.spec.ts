import { readFile } from 'node:fs/promises';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { computeJsonExportChecksum } from '../../src/lib/export';
import { parseExportPayloadDetails, type ParsedExportPayloadDetails } from '../helpers/exportPayload';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type EntryStatus,
  type JsonExportPayload,
  type SectorId
} from '../../src/types';

const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';
const FIXED_TEST_DATE_KEY = FIXED_TEST_TIME_ISO.slice(0, 10);

type CrashEntry = {
  date: string;
  sectorId: SectorId;
  status: EntryStatus;
  updatedAt: string;
};

const EXPECTED_CRASH_EXPORT_ENTRIES: CrashEntry[] = [
  {
    date: FIXED_TEST_DATE_KEY,
    sectorId: 'rest',
    status: 'degraded',
    updatedAt: FIXED_TEST_TIME_ISO
  },
  {
    date: FIXED_TEST_DATE_KEY,
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: FIXED_TEST_TIME_ISO
  }
];

function requireDownloadPath(path: string | null): string {
  if (!path) {
    throw new Error('Playwright did not provide a downloadable file path.');
  }

  return path;
}

async function readLocalFileText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8');
}


function sectorRadio(page: Page, sectorLabel: string, statusLabel: 'unmarked' | 'nominal' | 'degraded') {
  return page.getByRole('radio', {
    name: new RegExp(`^${sectorLabel} ${statusLabel}$`, 'i')
  });
}

async function expectSectorStatus(
  page: Page,
  sectorLabel: string,
  statusLabel: 'unmarked' | 'nominal' | 'degraded'
) {
  await expect(sectorRadio(page, sectorLabel, statusLabel)).toHaveAttribute('aria-checked', 'true');
}

async function waitForStoredStatus(
  page: Page,
  sectorId: string,
  expectedStatus: 'nominal' | 'degraded'
): Promise<void> {
  await page.waitForFunction(
    async ({ dateKey, sectorId: expectedSectorId, expectedStatus }) => {
      return await new Promise<boolean>((resolve) => {
        const request = window.indexedDB.open('opsnormal');

        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('dailyEntries', 'readonly');
          const store = transaction.objectStore('dailyEntries');
          const getAllRequest = store.getAll();

          getAllRequest.onerror = () => {
            database.close();
            resolve(false);
          };

          getAllRequest.onsuccess = () => {
            const entries = getAllRequest.result as Array<{
              date?: string;
              sectorId?: string;
              status?: string;
            }>;
            const match = entries.find(
              (entry) => entry.date === dateKey && entry.sectorId === expectedSectorId
            );

            database.close();
            resolve(match?.status === expectedStatus);
          };
        };
      });
    },
    { dateKey: FIXED_TEST_DATE_KEY, sectorId, expectedStatus }
  );
}

function normalizeEntries(entries: JsonExportPayload['entries']): CrashEntry[] {
  return [...entries]
    .map((entry) => ({
      date: entry.date,
      sectorId: entry.sectorId,
      status: entry.status,
      updatedAt: entry.updatedAt
    }))
    .sort((left, right) => `${left.date}:${left.sectorId}`.localeCompare(`${right.date}:${right.sectorId}`));
}

async function expectExportPayloadIntegrity(parsedPayload: ParsedExportPayloadDetails): Promise<void> {
  const { payload, rawChecksumPayload } = parsedPayload;

  expect(payload.app).toBe(OPSNORMAL_APP_NAME);
  expect(payload.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  expect(payload.checksum).toMatch(/^[a-f0-9]{64}$/);

  const recomputedChecksum: string = await computeJsonExportChecksum(rawChecksumPayload);

  expect(payload.checksum).toBe(recomputedChecksum);
}

async function seedCrashExportEntries(page: Page): Promise<void> {
  await page.goto('/');

  const workNominal = sectorRadio(page, 'Work or School', 'nominal');
  const restNominal = sectorRadio(page, 'Rest', 'nominal');
  const restDegraded = sectorRadio(page, 'Rest', 'degraded');

  await workNominal.click();
  await expectSectorStatus(page, 'Work or School', 'nominal');

  await restNominal.click();
  await expectSectorStatus(page, 'Rest', 'nominal');
  await expect(restDegraded).toBeEnabled();
  await restDegraded.click();
  await expectSectorStatus(page, 'Rest', 'degraded');
  await waitForStoredStatus(page, 'work-school', 'nominal');
  await waitForStoredStatus(page, 'rest', 'degraded');
}

async function seedMalformedCrashExportEntry(page: Page): Promise<void> {
  await page.evaluate(
    async ({ dateKey, updatedAt }) => {
      await new Promise<void>((resolve, reject) => {
        const request = window.indexedDB.open('opsnormal');

        request.onerror = () => {
          reject(request.error ?? new Error('Failed to open IndexedDB for malformed crash export seed.'));
        };

        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('dailyEntries', 'readwrite');
          const store = transaction.objectStore('dailyEntries');

          store.add({
            date: dateKey,
            sectorId: 'household',
            status: 'invalid-status',
            updatedAt
          });

          transaction.oncomplete = () => {
            database.close();
            resolve();
          };

          transaction.onerror = () => {
            const transactionError =
              transaction.error ?? new Error('Failed to seed malformed crash export row.');
            database.close();
            reject(transactionError);
          };

          transaction.onabort = () => {
            const transactionError =
              transaction.error ?? new Error('Malformed crash export row was aborted.');
            database.close();
            reject(transactionError);
          };
        };
      });
    },
    {
      dateKey: FIXED_TEST_DATE_KEY,
      updatedAt: FIXED_TEST_TIME_ISO
    }
  );
}

async function openCrashFallbackHarness(page: Page): Promise<void> {
  await page.goto('/crash-fallback-harness.html');

  await expect(page).toHaveTitle('OpsNormal Crash Fallback Harness');
  await expect(page.getByRole('heading', { name: 'OpsNormal stopped rendering' })).toBeVisible();
  await expect(page.getByText(/crash fallback harness injected render fault/i)).toBeVisible();
}

async function exportCrashJson(page: Page): Promise<ParsedExportPayloadDetails> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const downloadPath = requireDownloadPath(await download.path());
  const rawText = await readLocalFileText(downloadPath);
  return parseExportPayloadDetails(rawText);
}

async function exportCrashCsv(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const downloadPath = requireDownloadPath(await download.path());

  return await readLocalFileText(downloadPath);
}

async function ensureImportPanelOpen(page: Page): Promise<void> {
  const importToggle = page.getByRole('button', { name: /import and restore/i });

  if ((await importToggle.getAttribute('aria-expanded')) !== 'true') {
    await importToggle.click();
  }
}

async function importCrashJsonPayload(page: Page, payloadText: string): Promise<void> {
  await ensureImportPanelOpen(page);
  await page.locator('[data-testid="import-file-input"]').setInputFiles({
    name: 'opsnormal-crash-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(payloadText, 'utf8')
  });
  await page.getByRole('button', { name: /confirm merge import/i }).click();
}

async function createCleanImportContext(browser: Browser): Promise<BrowserContext> {
  return await browser.newContext();
}

test.use({ serviceWorkers: 'block' });

test.describe('OpsNormal crash export recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
  });

  test('exports valid crash-state JSON that can be imported into a clean browser context', async ({
    browser,
    page
  }) => {
    await seedCrashExportEntries(page);
    await openCrashFallbackHarness(page);

    const exported = await exportCrashJson(page);

    await expectExportPayloadIntegrity(exported);
    expect(normalizeEntries(exported.payload.entries)).toEqual(EXPECTED_CRASH_EXPORT_ENTRIES);
    await expect(page.getByText('JSON export complete. 2 entries recovered.')).toBeVisible();

    const importContext = await createCleanImportContext(browser);

    try {
      const importPage = await importContext.newPage();
      await importPage.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
      await importPage.goto('/');
      await importCrashJsonPayload(importPage, JSON.stringify(exported.payload));

      await expectSectorStatus(importPage, 'Work or School', 'nominal');
      await expectSectorStatus(importPage, 'Rest', 'degraded');
    } finally {
      await importContext.close();
    }
  });

  test('skips malformed stored rows and still exports importable crash-state JSON', async ({
    browser,
    page
  }) => {
    await seedCrashExportEntries(page);
    await seedMalformedCrashExportEntry(page);
    await openCrashFallbackHarness(page);

    const exported = await exportCrashJson(page);

    await expectExportPayloadIntegrity(exported);
    expect(normalizeEntries(exported.payload.entries)).toEqual(EXPECTED_CRASH_EXPORT_ENTRIES);
    await expect(
      page.getByText('JSON export complete. 2 entries recovered. 1 malformed row skipped.')
    ).toBeVisible();

    const importContext = await createCleanImportContext(browser);

    try {
      const importPage = await importContext.newPage();
      await importPage.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
      await importPage.goto('/');
      await importCrashJsonPayload(importPage, JSON.stringify(exported.payload));

      await expectSectorStatus(importPage, 'Work or School', 'nominal');
      await expectSectorStatus(importPage, 'Rest', 'degraded');
      await expectSectorStatus(importPage, 'Household', 'unmarked');
    } finally {
      await importContext.close();
    }
  });

  test('exports crash-state CSV from the root fallback surface', async ({ page }) => {
    await seedCrashExportEntries(page);
    await openCrashFallbackHarness(page);

    const csv = await exportCrashCsv(page);

    expect(csv.trim().split('\n')).toEqual([
      'date,sectorId,status,updatedAt',
      `${FIXED_TEST_DATE_KEY},rest,degraded,${FIXED_TEST_TIME_ISO}`,
      `${FIXED_TEST_DATE_KEY},work-school,nominal,${FIXED_TEST_TIME_ISO}`
    ]);
    await expect(page.getByText('CSV export complete. 2 entries recovered.')).toBeVisible();
  });
});
