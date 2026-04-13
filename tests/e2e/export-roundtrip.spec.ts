import { expect, test, type Browser, type Page } from '@playwright/test';

import { formatDateKey } from '../../src/lib/date';
import { computeJsonExportChecksum } from '../../src/lib/export';
import { parseExportPayloadDetails } from '../helpers/exportPayload';
import type { JsonExportPayload } from '../../src/types';

type ExportPayload = JsonExportPayload;
type ExportEntry = ExportPayload['entries'][number];

const DEXIE_VERSION_1_NATIVE_INDEXED_DB_VERSION = 10;

function requireDownloadPath(path: string | null): string {
  if (!path) {
    throw new Error('Playwright did not provide a downloadable file path.');
  }

  return path;
}

function normalizeExportPayload(payload: ExportPayload) {
  return {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    entries: [...payload.entries].sort((left, right) => {
      const leftKey = `${left.date}:${left.sectorId}`;
      const rightKey = `${right.date}:${right.sectorId}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
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

async function expectSectorStatus(
  page: Page,
  sectorLabel: string,
  statusLabel: 'unmarked' | 'nominal' | 'degraded',
) {
  await expect(sectorRadio(page, sectorLabel, statusLabel)).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

async function readLocalFileText(
  page: Page,
  filePath: string,
): Promise<string> {
  await page.evaluate(() => {
    if (
      document.querySelector('[data-testid="playwright-local-file-reader"]')
    ) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('data-testid', 'playwright-local-file-reader');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    document.body.appendChild(input);
  });

  const fileReaderInput = page.locator(
    '[data-testid="playwright-local-file-reader"]',
  );
  await fileReaderInput.setInputFiles(filePath);

  return await fileReaderInput.evaluate(async (element) => {
    const input = element as HTMLInputElement;
    const file = input.files?.item(0);

    if (!file) {
      throw new Error('No file attached to playwright local file reader.');
    }

    return await file.text();
  });
}

async function exportPayloadFromCurrentPage(page: Page): Promise<{
  downloadPath: string;
  payload: ExportPayload;
  rawChecksumPayload: Parameters<typeof computeJsonExportChecksum>[0];
}> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('opsnormal-export.json');

  const downloadPath = requireDownloadPath(await download.path());
  const rawText = await readLocalFileText(page, downloadPath);
  const parsed = parseExportPayloadDetails(rawText);

  expect(parsed.payload.checksum).toMatch(/^[a-f0-9]{64}$/);

  return {
    downloadPath,
    payload: parsed.payload,
    rawChecksumPayload: parsed.rawChecksumPayload,
  };
}

async function verifyImportRoundTrip(args: {
  browser: Browser;
  sourcePage: Page;
  sourceDownloadPath: string;
  expectedPayload: ExportPayload;
  expectedChecksumPayload: Parameters<typeof computeJsonExportChecksum>[0];
  expectedStatuses: Array<{
    sectorLabel: string;
    statusLabel: 'unmarked' | 'nominal' | 'degraded';
  }>;
}): Promise<void> {
  const recoveryContext = await args.browser.newContext({
    acceptDownloads: true,
  });

  try {
    const recoveryPage = await recoveryContext.newPage();
    const appUrl = new URL('/', args.sourcePage.url()).toString();

    await recoveryPage.goto(appUrl);
    await recoveryPage
      .getByRole('button', { name: /import and restore/i })
      .click();
    await recoveryPage
      .locator('[data-testid="import-file-input"]')
      .setInputFiles(args.sourceDownloadPath);

    await expect(
      recoveryPage.getByRole('heading', { name: /import preview/i }),
    ).toBeVisible();
    await expect(recoveryPage.getByText(/integrity verified/i)).toBeVisible();
    await recoveryPage
      .getByRole('button', { name: /confirm merge import/i })
      .click();

    for (const expectedStatus of args.expectedStatuses) {
      await expectSectorStatus(
        recoveryPage,
        expectedStatus.sectorLabel,
        expectedStatus.statusLabel,
      );
    }

    const secondExport = await exportPayloadFromCurrentPage(recoveryPage);

    const firstRecomputedChecksum = await computeJsonExportChecksum(
      args.expectedChecksumPayload,
    );
    const secondRecomputedChecksum = await computeJsonExportChecksum(
      secondExport.rawChecksumPayload,
    );

    expect(args.expectedPayload.checksum).toBe(firstRecomputedChecksum);
    expect(secondExport.payload.checksum).toBe(secondRecomputedChecksum);
    expect(normalizeExportPayload(secondExport.payload)).toEqual(
      normalizeExportPayload(args.expectedPayload),
    );
  } finally {
    await recoveryContext.close();
  }
}

async function deleteOpsNormalDatabase(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('opsnormal');
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(
          request.error ?? new Error('Failed to delete OpsNormal database.'),
        );
      request.onblocked = () =>
        reject(
          new Error(
            'Deleting OpsNormal database was blocked by another open connection.',
          ),
        );
    });
  });
}

async function seedLegacyVersion1Database(
  page: Page,
  entries: ExportEntry[],
): Promise<void> {
  await page.goto('/boot-fallback-harness.html');
  await deleteOpsNormalDatabase(page);

  await page.evaluate(
    async ({
      nativeVersion,
      seedEntries,
    }: {
      nativeVersion: number;
      seedEntries: ExportEntry[];
    }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('opsnormal', nativeVersion);

        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.createObjectStore('dailyEntries', {
            keyPath: 'id',
            autoIncrement: true,
          });

          store.createIndex('[date+sectorId]', ['date', 'sectorId'], {
            unique: true,
          });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('sectorId', 'sectorId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        };

        request.onerror = () => {
          reject(
            request.error ??
              new Error('Failed to open legacy OpsNormal database.'),
          );
        };

        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('dailyEntries', 'readwrite');
          const store = transaction.objectStore('dailyEntries');

          for (const entry of seedEntries) {
            store.add(entry);
          }

          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(
              transaction.error ??
                new Error('Failed to seed legacy OpsNormal database.'),
            );
          };
          transaction.onabort = () => {
            database.close();
            reject(
              transaction.error ??
                new Error('Legacy OpsNormal seed transaction aborted.'),
            );
          };
        };
      });
    },
    {
      nativeVersion: DEXIE_VERSION_1_NATIVE_INDEXED_DB_VERSION,
      seedEntries: entries,
    },
  );
}

test.describe('OpsNormal export recovery', () => {
  test('round-trips a json export through import and re-export without data loss', async ({
    page,
    browser,
  }) => {
    await page.goto('/');

    const workNominal = sectorRadio(page, 'Work or School', 'nominal');
    const workDegraded = sectorRadio(page, 'Work or School', 'degraded');
    const bodyNominal = sectorRadio(page, 'Body', 'nominal');

    await workNominal.click();
    await expectSectorStatus(page, 'Work or School', 'nominal');
    await workDegraded.click();
    await expectSectorStatus(page, 'Work or School', 'degraded');
    await bodyNominal.click();
    await expectSectorStatus(page, 'Body', 'nominal');

    const firstExport = await exportPayloadFromCurrentPage(page);

    expect(normalizeExportPayload(firstExport.payload).entries).toHaveLength(2);

    await verifyImportRoundTrip({
      browser,
      sourcePage: page,
      sourceDownloadPath: firstExport.downloadPath,
      expectedPayload: firstExport.payload,
      expectedChecksumPayload: firstExport.rawChecksumPayload,
      expectedStatuses: [
        { sectorLabel: 'Work or School', statusLabel: 'degraded' },
        { sectorLabel: 'Body', statusLabel: 'nominal' },
      ],
    });
  });

  test('preserves export and import fidelity after opening legacy version 1 IndexedDB state @harness', async ({
    page,
    browser,
  }) => {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const previousDay = new Date(today);
    previousDay.setDate(today.getDate() - 1);
    const previousDayKey = formatDateKey(previousDay);

    const legacyEntries: ExportEntry[] = [
      {
        date: todayKey,
        sectorId: 'relationships',
        status: 'degraded',
        updatedAt: `${todayKey}T12:00:00.000Z`,
      },
      {
        date: previousDayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: `${previousDayKey}T12:05:00.000Z`,
      },
    ];

    await seedLegacyVersion1Database(page, legacyEntries);
    await page.goto('/');

    await expectSectorStatus(page, 'Relationships', 'degraded');

    const firstExport = await exportPayloadFromCurrentPage(page);

    const expectedLegacyExportEntries: ExportEntry[] = legacyEntries.map(
      (entry, index) => ({
        ...entry,
        id: index + 1,
      }),
    );

    expect(normalizeExportPayload(firstExport.payload).entries).toEqual(
      normalizeExportPayload({
        app: firstExport.payload.app,
        schemaVersion: firstExport.payload.schemaVersion,
        exportedAt: firstExport.payload.exportedAt,
        entries: expectedLegacyExportEntries,
        checksum: firstExport.payload.checksum,
      }).entries,
    );

    await verifyImportRoundTrip({
      browser,
      sourcePage: page,
      sourceDownloadPath: firstExport.downloadPath,
      expectedPayload: firstExport.payload,
      expectedChecksumPayload: firstExport.rawChecksumPayload,
      expectedStatuses: [
        { sectorLabel: 'Relationships', statusLabel: 'degraded' },
      ],
    });
  });
});
