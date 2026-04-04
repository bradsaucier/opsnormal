import { readFile } from 'node:fs/promises';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { computeJsonExportChecksum } from '../../src/lib/export';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type EntryStatus,
  type JsonExportPayload,
  type SectorId
} from '../../src/types';

const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';
const FIXED_TEST_DATE_KEY = FIXED_TEST_TIME_ISO.slice(0, 10);

type ImportPayload = JsonExportPayload;
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

async function expectExportPayloadIntegrity(payload: JsonExportPayload): Promise<void> {
  expect(payload.app).toBe(OPSNORMAL_APP_NAME);
  expect(payload.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  expect(payload.checksum).toMatch(/^[a-f0-9]{64}$/);

  const recomputedChecksum = await computeJsonExportChecksum({
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries
  });

  expect(payload.checksum).toBe(recomputedChecksum);
}

async function seedCrashExportEntries(page: Page): Promise<void> {
  await page.goto('/');

  const workButton = page.getByRole('button', { name: /work or school/i });
  const restButton = page.getByRole('button', { name: /^rest/i });

  await workButton.click();
  await expect(workButton).toContainText('NOMINAL');

  await restButton.click();
  await expect(restButton).toContainText('NOMINAL');
  await restButton.click();
  await expect(restButton).toContainText('DEGRADED');
}

async function openCrashFallbackHarness(page: Page): Promise<void> {
  await page.goto('/crash-fallback-harness.html');

  await expect(page.getByRole('heading', { name: 'OpsNormal stopped rendering' })).toBeVisible();
  await expect(page.getByText(/crash fallback harness injected render fault/i)).toBeVisible();
}

async function exportCrashJson(page: Page): Promise<ImportPayload> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const downloadPath = requireDownloadPath(await download.path());
  const rawText = await readLocalFileText(downloadPath);
  const payload = JSON.parse(rawText) as ImportPayload;

  return payload;
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

    const payload = await exportCrashJson(page);

    await expectExportPayloadIntegrity(payload);
    expect(normalizeEntries(payload.entries)).toEqual(EXPECTED_CRASH_EXPORT_ENTRIES);
    await expect(page.getByText('JSON export complete. 2 entries recovered.')).toBeVisible();

    const importContext = await createCleanImportContext(browser);

    try {
      const importPage = await importContext.newPage();
      await importPage.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
      await importPage.goto('/');
      await importCrashJsonPayload(importPage, JSON.stringify(payload));

      await expect(
        importPage.getByRole('button', { name: /^Work or School\. Current state/i })
      ).toContainText('NOMINAL');
      await expect(
        importPage.getByRole('button', { name: /^Rest\. Current state/i })
      ).toContainText('DEGRADED');
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
