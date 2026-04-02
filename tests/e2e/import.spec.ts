import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function buildImportPayload(todayKey: string) {
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

test.describe('OpsNormal import workflow', () => {
  test('imports valid JSON into the current browser database', async ({ page }, testInfo) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const importFilePath = testInfo.outputPath('opsnormal-import.json');

    await writeFile(importFilePath, JSON.stringify(buildImportPayload(todayKey)), 'utf8');

    await page.goto('/');
    await page.getByRole('button', { name: /import and restore/i }).click();
    await page.locator('[data-testid="import-file-input"]').setInputFiles(importFilePath);

    await expect(page.getByRole('heading', { name: /import preview/i })).toBeVisible();
    await expect(page.getByText(/legacy backup detected/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm merge import/i }).click();

    await expect(page.getByRole('button', { name: /^Body\. Current state/i })).toContainText(
      'DEGRADED'
    );
    await expect(page.getByRole('button', { name: /^Rest\. Current state/i })).toContainText(
      'NOMINAL'
    );
  });

  test('rejects invalid json payloads before write', async ({ page }, testInfo) => {
    const invalidFilePath = testInfo.outputPath('opsnormal-invalid.json');

    await writeFile(
      invalidFilePath,
      JSON.stringify({
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
      }),
      'utf8'
    );

    await page.goto('/');
    await page.getByRole('button', { name: /import and restore/i }).click();
    await page.locator('[data-testid="import-file-input"]').setInputFiles(invalidFilePath);

    await expect(page.getByText(/import rejected|entries\.0\.sectorId/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /import preview/i })).toHaveCount(0);
  });
});
