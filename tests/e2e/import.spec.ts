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

type InvalidImportPayload = {
  app: 'OpsNormal';
  schemaVersion: 1;
  exportedAt: string;
  entries: Array<{
    date: string;
    sectorId: string;
    status: ImportStatus;
    updatedAt: string;
  }>;
};

function currentDateKey(): string {
  return new Date().toISOString().slice(0, 10);
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

function buildInvalidImportPayload(): InvalidImportPayload {
  return {
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
  };
}

async function openImportPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /import and restore/i }).click();
}

async function stageImportJson(
  page: Page,
  fileName: string,
  payloadText: string
): Promise<void> {
  await page.locator('[data-testid="import-file-input"]').evaluate(
    (element, args: { fileName: string; payloadText: string }) => {
      if (!(element instanceof HTMLInputElement)) {
        throw new Error('Import file input was not an HTMLInputElement.');
      }

      const file = new File([args.payloadText], args.fileName, {
        type: 'application/json'
      });

      const transfer = new DataTransfer();
      transfer.items.add(file);

      element.files = transfer.files;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { fileName, payloadText }
  );
}

test.describe('OpsNormal import workflow', () => {
  test('imports valid JSON into the current browser database', async ({ page }) => {
    const payload = buildImportPayload(currentDateKey());

    await page.goto('/');
    await openImportPanel(page);
    await stageImportJson(page, 'opsnormal-import.json', JSON.stringify(payload));

    await expect(page.getByRole('heading', { name: /import preview/i })).toBeVisible();
    await expect(page.getByText(/legacy backup detected/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm merge import/i }).click();

    await expect(
      page.getByRole('button', { name: /^Body\. Current state/i })
    ).toContainText('DEGRADED');

    await expect(
      page.getByRole('button', { name: /^Rest\. Current state/i })
    ).toContainText('NOMINAL');
  });

  test('rejects invalid json payloads before write', async ({ page }) => {
    const invalidPayload = buildInvalidImportPayload();

    await page.goto('/');
    await openImportPanel(page);
    await stageImportJson(page, 'opsnormal-invalid.json', JSON.stringify(invalidPayload));

    await expect(page.getByText(/import rejected|entries\.0\.sectorId/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /import preview/i })).toHaveCount(0);
  });
});
