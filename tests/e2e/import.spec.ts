import { Buffer } from 'node:buffer';
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
  test('imports valid JSON into the current browser database', async ({ page }) => {
    const todayKey = new Date().toISOString().slice(0, 10);

    await page.goto('/');
    await page.locator('[data-testid="import-file-input"]').setInputFiles({
      name: 'opsnormal-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(buildImportPayload(todayKey)), 'utf-8')
    });

    await expect(page.getByRole('heading', { name: 'Import ready' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    await expect(page.getByRole('button', { name: /body/i })).toContainText('DEGRADED');
    await expect(page.getByRole('button', { name: /rest/i })).toContainText('NOMINAL');
  });

  test('rejects invalid json payloads before write', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="import-file-input"]').setInputFiles({
      name: 'opsnormal-invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
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
        'utf-8'
      )
    });

    await expect(page.getByText(/import rejected|entries\.0\.sectorId/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import ready' })).toHaveCount(0);
  });
});
