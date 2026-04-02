import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

type ImportStatus = 'nominal' | 'degraded';
type ImportSectorId = 'body' | 'rest';

type ImportEntry = {
  date: string;
  sectorId: ImportSectorId;
  status: ImportStatus;
  updatedAt: string;
};

type ImportPayload = {
  app: 'OpsNormal';
  schemaVersion: 1;
  exportedAt: string;
  entries: ImportEntry[];
};

async function writeJsonFixture(fileName: string, jsonText: string): Promise<{
  dirPath: string;
  filePath: string;
}> {
  const dirPath = await mkdtemp(join(tmpdir(), 'opsnormal-import-'));
  const filePath = join(dirPath, fileName);

  await writeFile(filePath, jsonText, 'utf8');

  return { dirPath, filePath };
}

function buildImportPayload(todayKey: string): ImportPayload {
  return {
    app: 'OpsNormal',
    schemaVersion: 1,
    exportedAt: '2026-03-28T12:00:00.000Z',
    entries: [
      {
        date: todayKey,
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T12:00:00.000Z'
      },
      {
        date: todayKey,
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-03-28T12:01:00.000Z'
      }
    ]
  };
}

async function openImportPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /import and restore/i }).click();
}

async function stageImportFile(page: Page, filePath: string): Promise<void> {
  await page.locator('[data-testid="import-file-input"]').setInputFiles(filePath);
}

test.describe('OpsNormal import workflow', () => {
  test('imports valid JSON into the current browser database', async ({ page }) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const payload = buildImportPayload(todayKey);
    const fixture = await writeJsonFixture(
      'opsnormal-import.json',
      JSON.stringify(payload)
    );

    try {
      await page.goto('/');
      await openImportPanel(page);
      await stageImportFile(page, fixture.filePath);

      await expect(page.getByRole('heading', { name: /import preview/i })).toBeVisible();
      await expect(page.getByText(/legacy backup detected/i)).toBeVisible();
      await page.getByRole('button', { name: /confirm merge import/i }).click();

      await expect(
        page.getByRole('button', { name: /^Body\. Current state/i })
      ).toContainText('DEGRADED');
      await expect(
        page.getByRole('button', { name: /^Rest\. Current state/i })
      ).toContainText('NOMINAL');
    } finally {
      await rm(fixture.dirPath, { recursive: true, force: true });
    }
  });

  test('rejects invalid json payloads before write', async ({ page }) => {
    const invalidJson = JSON.stringify({
      app: 'OpsNormal',
      schemaVersion: 1,
      exportedAt: '2026-03-28T12:00:00.000Z',
      entries: [
        {
          date: '2026-03-28',
          sectorId: 'invalid-sector',
          status: 'nominal',
          updatedAt: '2026-03-28T12:00:00.000Z'
        }
      ]
    });

    const fixture = await writeJsonFixture('opsnormal-invalid.json', invalidJson);

    try {
      await page.goto('/');
      await openImportPanel(page);
      await stageImportFile(page, fixture.filePath);

      await expect(page.getByText(/import rejected|entries\.0\.sectorId/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: /import preview/i })).toHaveCount(0);
    } finally {
      await rm(fixture.dirPath, { recursive: true, force: true });
    }
  });
});
