/// <reference types="node" />

import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { computeJsonExportChecksum } from '../../src/lib/export';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type EntryStatus,
  type JsonExportPayload,
  type SectorId
} from '../../src/types';

type ImportEntry = JsonExportPayload['entries'][number];
type ImportPayload = JsonExportPayload;

type InvalidImportPayload = {
  app: 'OpsNormal';
  schemaVersion: 1;
  exportedAt: string;
  entries: Array<{
    date: string;
    sectorId: string;
    status: EntryStatus;
    updatedAt: string;
  }>;
};

const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';

function currentDateKey(): string {
  return FIXED_TEST_TIME_ISO.slice(0, 10);
}

function offsetDateKey(daysFromToday: number): string {
  const date = new Date(FIXED_TEST_TIME_ISO);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function createImportEntry(args: {
  date: string;
  sectorId: SectorId;
  status: EntryStatus;
  updatedAt: string;
}): ImportEntry {
  return {
    date: args.date,
    sectorId: args.sectorId,
    status: args.status,
    updatedAt: args.updatedAt
  };
}

function buildLegacyImportPayload(todayKey: string): ImportPayload {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: FIXED_TEST_TIME_ISO,
    entries: [
      createImportEntry({
        date: todayKey,
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }),
      createImportEntry({
        date: todayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-03-28T12:01:00.000Z'
      })
    ]
  };
}

async function buildVerifiedImportPayload(entries: ImportEntry[]): Promise<ImportPayload> {
  const payload: ImportPayload = {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: FIXED_TEST_TIME_ISO,
    entries
  };

  payload.checksum = await computeJsonExportChecksum({
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries
  });

  return payload;
}

function buildInvalidImportPayload(): InvalidImportPayload {
  return {
    app: 'OpsNormal',
    schemaVersion: 1,
    exportedAt: FIXED_TEST_TIME_ISO,
    entries: [
      {
        date: '2026-03-28',
        sectorId: 'invalid-sector',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }
    ]
  };
}

function normalizeEntries(entries: JsonExportPayload['entries']) {
  return [...entries]
    .map((entry) => ({
      date: entry.date,
      sectorId: entry.sectorId,
      status: entry.status,
      updatedAt: entry.updatedAt
    }))
    .sort((left, right) => {
      const leftKey = `${left.date}:${left.sectorId}`;
      const rightKey = `${right.date}:${right.sectorId}`;
      return leftKey.localeCompare(rightKey);
    });
}

function requireDownloadPath(path: string | null): string {
  if (!path) {
    throw new Error('Playwright did not provide a downloadable file path.');
  }

  return path;
}

async function readLocalFileText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8');
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

async function exportCurrentJson(page: Page): Promise<JsonExportPayload> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const downloadPath = requireDownloadPath(await download.path());
  const rawText = await readLocalFileText(downloadPath);

  return JSON.parse(rawText) as JsonExportPayload;
}

async function ensureImportPanelOpen(page: Page): Promise<void> {
  const importToggle = page.getByRole('button', { name: /import and restore/i });

  if ((await importToggle.getAttribute('aria-expanded')) !== 'true') {
    await importToggle.click();
  }
}

async function stageImportJson(
  page: Page,
  fileName: string,
  payloadText: string
): Promise<void> {
  await page.locator('[data-testid="import-file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(payloadText, 'utf8')
  });
}

async function stageImportPreview(
  page: Page,
  fileName: string,
  payload: ImportPayload | InvalidImportPayload
): Promise<void> {
  await ensureImportPanelOpen(page);
  await stageImportJson(page, fileName, JSON.stringify(payload));
}

async function confirmMergeImport(page: Page): Promise<void> {
  await page.getByRole('button', { name: /confirm merge import/i }).click();
}

async function switchToReplaceMode(page: Page): Promise<void> {
  await page.getByRole('radio', { name: /replace/i }).click();
}

async function completeManualReplaceCheckpoint(page: Page): Promise<void> {
  const exportBackupButton = page.getByRole('button', { name: /export pre-replace backup/i });
  await expect(exportBackupButton).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await exportBackupButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^opsnormal-pre-replace-backup-.*\.json$/);

  const armButton = page.getByRole('button', { name: /arm replace all data/i });
  await expect(armButton).toBeDisabled();

  await page
    .getByRole('checkbox', {
      name: /i confirm the backup file was successfully saved to my device before importing this restore/i
    })
    .check();
  await expect(armButton).toBeDisabled();

  await page.getByRole('button', { name: /unlock replace after manual backup check/i }).click();
  await expect(page.getByText(/manual backup checkpoint acknowledged/i)).toBeVisible();
  await expect(armButton).toBeEnabled();
}

test.describe('OpsNormal import workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        writable: true,
        value: undefined
      });
    });

    await page.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
  });

  test('imports valid JSON into the current browser database', async ({ page }) => {
    await page.goto('/');

    const payload = buildLegacyImportPayload(currentDateKey());
    await stageImportPreview(page, 'opsnormal-import.json', payload);

    await expect(page.getByRole('heading', { name: /import preview/i })).toBeVisible();
    await expect(page.getByText(/legacy backup detected/i)).toBeVisible();
    await confirmMergeImport(page);

    await expectSectorStatus(page, 'Body', 'degraded');
    await expectSectorStatus(page, 'Rest', 'nominal');
  });

  test('rejects invalid json payloads before write', async ({ page }) => {
    const invalidPayload = buildInvalidImportPayload();

    await page.goto('/');
    await stageImportPreview(page, 'opsnormal-invalid.json', invalidPayload);

    await expect(page.getByText(/import rejected|entries\.0\.sectorId/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /import preview/i })).toHaveCount(0);
  });

  test('keeps replace locked until the manual backup checkpoint completes', async ({ page }) => {
    await page.goto('/');

    const todayKey = currentDateKey();
    const payload = await buildVerifiedImportPayload([
      createImportEntry({
        date: todayKey,
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }),
      createImportEntry({
        date: todayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-03-28T12:01:00.000Z'
      })
    ]);

    await stageImportPreview(page, 'opsnormal-replace-verified.json', payload);

    await expect(page.getByText(/integrity verified/i)).toBeVisible();
    await switchToReplaceMode(page);

    const armButton = page.getByRole('button', { name: /arm replace all data/i });
    await expect(armButton).toBeDisabled();

    await completeManualReplaceCheckpoint(page);
  });

  test('requires a separate arm step and leaves data unchanged when replace is disarmed', async ({ page }) => {
    await page.goto('/');

    const todayKey = currentDateKey();
    const seedPayload = await buildVerifiedImportPayload([
      createImportEntry({
        date: todayKey,
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z'
      })
    ]);
    const replacePayload = await buildVerifiedImportPayload([
      createImportEntry({
        date: todayKey,
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-29T12:00:00.000Z'
      }),
      createImportEntry({
        date: todayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-03-29T12:01:00.000Z'
      })
    ]);

    await stageImportPreview(page, 'opsnormal-seed.json', seedPayload);
    await expect(page.getByText(/integrity verified/i)).toBeVisible();
    await confirmMergeImport(page);

    await expectSectorStatus(page, 'Body', 'nominal');
    await expectSectorStatus(page, 'Rest', 'unmarked');

    await stageImportPreview(page, 'opsnormal-replace-staged.json', replacePayload);
    await expect(page.getByRole('heading', { name: /import preview/i })).toBeVisible();
    await switchToReplaceMode(page);
    await completeManualReplaceCheckpoint(page);

    await page.getByRole('button', { name: /arm replace all data/i }).click();

    await expect(page.getByText(/replace armed\./i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /execute replace all \d+ rows/i })
    ).toBeVisible();
    await expectSectorStatus(page, 'Body', 'nominal');
    await expectSectorStatus(page, 'Rest', 'unmarked');

    await page.getByRole('button', { name: /disarm replace/i }).click();

    await expect(page.getByText(/replace disarmed\. local data unchanged\./i)).toBeVisible();
    await expect(page.getByRole('button', { name: /arm replace all data/i })).toBeVisible();
    await expectSectorStatus(page, 'Body', 'nominal');
    await expectSectorStatus(page, 'Rest', 'unmarked');
  });

  test('replaces all local rows with the imported snapshot and supports undo restore', async ({
    page
  }) => {
    await page.goto('/');

    const todayKey = currentDateKey();
    const yesterdayKey = offsetDateKey(-1);
    const seedPayload = await buildVerifiedImportPayload([
      createImportEntry({
        date: todayKey,
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }),
      createImportEntry({
        date: todayKey,
        sectorId: 'relationships',
        status: 'degraded',
        updatedAt: '2026-03-28T12:01:00.000Z'
      }),
      createImportEntry({
        date: yesterdayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-03-27T12:02:00.000Z'
      })
    ]);
    const replacePayload = await buildVerifiedImportPayload([
      createImportEntry({
        date: todayKey,
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z'
      }),
      createImportEntry({
        date: yesterdayKey,
        sectorId: 'work-school',
        status: 'degraded',
        updatedAt: '2026-03-29T12:01:00.000Z'
      })
    ]);

    await stageImportPreview(page, 'opsnormal-seed-snapshot.json', seedPayload);
    await expect(page.getByText(/integrity verified/i)).toBeVisible();
    await confirmMergeImport(page);

    const beforeReplaceExport = await exportCurrentJson(page);

    await expectExportPayloadIntegrity(beforeReplaceExport);
    expect(normalizeEntries(beforeReplaceExport.entries)).toEqual(normalizeEntries(seedPayload.entries));

    await stageImportPreview(page, 'opsnormal-replace-snapshot.json', replacePayload);
    await switchToReplaceMode(page);
    await completeManualReplaceCheckpoint(page);
    await page.getByRole('button', { name: /arm replace all data/i }).click();
    await page.getByRole('button', { name: /execute replace all \d+ rows/i }).click();

    await expect(page.getByText(/replace import complete\. 2 rows restored\./i)).toBeVisible();
    await expectSectorStatus(page, 'Body', 'unmarked');
    await expectSectorStatus(page, 'Household', 'nominal');
    await expectSectorStatus(page, 'Relationships', 'unmarked');

    const afterReplaceExport = await exportCurrentJson(page);

    await expectExportPayloadIntegrity(afterReplaceExport);
    expect(normalizeEntries(afterReplaceExport.entries)).toEqual(
      normalizeEntries(replacePayload.entries)
    );

    await page.getByRole('button', { name: /undo last import/i }).click();
    await expect(
      page.getByText(/undo complete\. the pre-import database snapshot has been restored\./i)
    ).toBeVisible();

    const afterUndoExport = await exportCurrentJson(page);

    await expectExportPayloadIntegrity(afterUndoExport);
    expect(normalizeEntries(afterUndoExport.entries)).toEqual(normalizeEntries(seedPayload.entries));
    await expectSectorStatus(page, 'Body', 'nominal');
    await expectSectorStatus(page, 'Relationships', 'degraded');
    await expectSectorStatus(page, 'Household', 'unmarked');
  });
});
