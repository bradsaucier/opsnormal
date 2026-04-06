import { expect, test, type Page } from '@playwright/test';
import { computeJsonExportChecksum } from '../../src/lib/export';

type ChecksumPayload = Parameters<typeof computeJsonExportChecksum>[0];
type ExportPayload = ChecksumPayload & { checksum?: string };

function requireDownloadPath(path: string | null): string {
  if (!path) {
    throw new Error('Playwright did not provide a downloadable file path.');
  }

  return path;
}

function parseExportPayload(rawText: string): ExportPayload {
  return JSON.parse(rawText) as ExportPayload;
}

function toChecksumPayload(payload: ExportPayload): ChecksumPayload {
  return {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    entries: payload.entries
  };
}

function normalizeExportPayload(payload: ExportPayload) {
  return {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    entries: [...payload.entries].sort((left, right) => {
      const leftKey = `${left.date}:${left.sectorId}`;
      const rightKey = `${right.date}:${right.sectorId}`;
      return leftKey.localeCompare(rightKey);
    })
  };
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

async function readLocalFileText(page: Page, filePath: string): Promise<string> {
  await page.evaluate(() => {
    if (document.querySelector('[data-testid="playwright-local-file-reader"]')) {
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

  const fileReaderInput = page.locator('[data-testid="playwright-local-file-reader"]');
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

test.describe('OpsNormal export recovery', () => {
  test('round-trips a json export through import and re-export without data loss', async ({
    page,
    browser
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

    const firstDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const firstDownload = await firstDownloadPromise;

    expect(firstDownload.suggestedFilename()).toBe('opsnormal-export.json');

    const firstDownloadPath = requireDownloadPath(await firstDownload.path());
    const firstRawText = await readLocalFileText(page, firstDownloadPath);
    const firstPayload = parseExportPayload(firstRawText);

    expect(firstPayload.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizeExportPayload(firstPayload).entries).toHaveLength(2);

    const recoveryContext = await browser.newContext({ acceptDownloads: true });

    try {
      const recoveryPage = await recoveryContext.newPage();
      const appUrl = new URL('/', page.url()).toString();

      await recoveryPage.goto(appUrl);
      await recoveryPage.getByRole('button', { name: /import and restore/i }).click();
      await recoveryPage
        .locator('[data-testid="import-file-input"]')
        .setInputFiles(firstDownloadPath);

      await expect(recoveryPage.getByRole('heading', { name: /import preview/i })).toBeVisible();
      await expect(recoveryPage.getByText(/integrity verified/i)).toBeVisible();
      await recoveryPage.getByRole('button', { name: /confirm merge import/i }).click();

      await expectSectorStatus(recoveryPage, 'Work or School', 'degraded');
      await expectSectorStatus(recoveryPage, 'Body', 'nominal');

      const secondDownloadPromise = recoveryPage.waitForEvent('download');
      await recoveryPage.getByRole('button', { name: 'Export JSON' }).click();
      const secondDownload = await secondDownloadPromise;

      const secondDownloadPath = requireDownloadPath(await secondDownload.path());
      const secondRawText = await readLocalFileText(recoveryPage, secondDownloadPath);
      const secondPayload = parseExportPayload(secondRawText);

      expect(secondPayload.checksum).toMatch(/^[a-f0-9]{64}$/);

      const firstRecomputedChecksum = await computeJsonExportChecksum(
        toChecksumPayload(firstPayload)
      );
      const secondRecomputedChecksum = await computeJsonExportChecksum(
        toChecksumPayload(secondPayload)
      );

      expect(firstPayload.checksum).toBe(firstRecomputedChecksum);
      expect(secondPayload.checksum).toBe(secondRecomputedChecksum);
      expect(normalizeExportPayload(secondPayload)).toEqual(normalizeExportPayload(firstPayload));
    } finally {
      await recoveryContext.close();
    }
  });
});
