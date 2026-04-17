import { expect, test, type Page } from '@playwright/test';

import { computeJsonExportChecksum } from '../../src/lib/export';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type EntryStatus,
  type JsonExportPayload,
  type SectorId,
} from '../../src/types';

const APP_URL = 'http://127.0.0.1:4173/';
const FIXED_TEST_TIME_ISO = '2026-03-28T12:00:00.000Z';

function currentDateKey(): string {
  return FIXED_TEST_TIME_ISO.slice(0, 10);
}

function createImportEntry(args: {
  date: string;
  sectorId: SectorId;
  status: EntryStatus;
  updatedAt: string;
}) {
  return {
    date: args.date,
    sectorId: args.sectorId,
    status: args.status,
    updatedAt: args.updatedAt,
  };
}

async function buildVerifiedImportPayload(
  entries: JsonExportPayload['entries'],
): Promise<JsonExportPayload> {
  const payload: JsonExportPayload = {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: FIXED_TEST_TIME_ISO,
    entries,
  };

  payload.checksum = await computeJsonExportChecksum({
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries,
  });

  return payload;
}

async function ensureImportPanelOpen(page: Page): Promise<void> {
  const importToggle = page.getByRole('button', {
    name: /import and restore/i,
  });

  if ((await importToggle.getAttribute('aria-expanded')) !== 'true') {
    await importToggle.click();
  }
}

async function stageImportPreview(
  page: Page,
  fileName: string,
  payload: JsonExportPayload,
): Promise<void> {
  await ensureImportPanelOpen(page);
  await page.locator('[data-testid="import-file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
}

async function confirmMergeImport(page: Page): Promise<void> {
  await page.getByRole('button', { name: /confirm merge import/i }).click();
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

test.describe('cross-tab undo invalidation', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Cross-tab undo is asserted only on the Chromium project; WebKit gate is narrow per docs/webkit-limitations.md.',
  );

  test('disables undo in a peer tab after a verified daily check-in and preserves the newer row', async ({
    browser,
  }) => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));
    await pageB.clock.setFixedTime(new Date(FIXED_TEST_TIME_ISO));

    await pageA.goto(APP_URL);
    await pageB.goto(APP_URL);

    const importPayload = await buildVerifiedImportPayload([
      createImportEntry({
        date: currentDateKey(),
        sectorId: 'household',
        status: 'nominal',
        updatedAt: FIXED_TEST_TIME_ISO,
      }),
    ]);

    await stageImportPreview(
      pageA,
      'opsnormal-cross-tab-import.json',
      importPayload,
    );
    await expect(
      pageA.getByRole('heading', { name: /import preview/i }),
    ).toBeVisible();
    await expect(pageA.getByText(/integrity verified/i)).toBeVisible();
    await confirmMergeImport(pageA);

    const undoButton = pageA.getByRole('button', { name: /undo last import/i });
    await expect(undoButton).toBeEnabled();

    await sectorRadio(pageB, 'Work or School', 'degraded').click();
    await expect(
      sectorRadio(pageB, 'Work or School', 'degraded'),
    ).toHaveAttribute('aria-checked', 'true');

    await expect(undoButton).toBeDisabled();
    await expect(
      pageA.getByText(
        /undo disabled after a post-import daily check-in\. export a fresh backup before proceeding\./i,
      ),
    ).toBeVisible();

    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      sectorRadio(pageB, 'Work or School', 'degraded'),
    ).toHaveAttribute('aria-checked', 'true');

    await context.close();
  });
});
