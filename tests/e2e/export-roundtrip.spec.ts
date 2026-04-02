import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
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

test.describe('OpsNormal export recovery', () => {
  test('round-trips a json export through import and re-export without data loss', async ({
    page,
    browser
  }) => {
    await page.goto('/');

    const workButton = page.getByRole('button', { name: /^Work or School\. Current state/i });
    const bodyButton = page.getByRole('button', { name: /^Body\. Current state/i });

    await workButton.click();
    await workButton.click();
    await bodyButton.click();

    await expect(workButton).toContainText('DEGRADED');
    await expect(bodyButton).toContainText('NOMINAL');

    const firstDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const firstDownload = await firstDownloadPromise;

    expect(firstDownload.suggestedFilename()).toBe('opsnormal-export.json');

    const firstDownloadPath = requireDownloadPath(await firstDownload.path());
    const firstRawText = await readFile(firstDownloadPath, 'utf8');
    const firstPayload = parseExportPayload(firstRawText);

    expect(firstPayload.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizeExportPayload(firstPayload).entries).toHaveLength(2);

    const recoveryContext = await browser.newContext({ acceptDownloads: true });

    try {
      const recoveryPage = await recoveryContext.newPage();
      const appUrl = new URL('/', page.url()).toString();

      await recoveryPage.goto(appUrl);
      await recoveryPage.getByRole('button', { name: /import and restore/i }).click();
      await recoveryPage.locator('[data-testid="import-file-input"]').setInputFiles(firstDownloadPath);

      await expect(recoveryPage.getByRole('heading', { name: /import preview/i })).toBeVisible();
      await expect(recoveryPage.getByText(/integrity verified/i)).toBeVisible();
      await recoveryPage.getByRole('button', { name: /confirm merge import/i }).click();

      await expect(
        recoveryPage.getByRole('button', { name: /^Work or School\. Current state/i })
      ).toContainText('DEGRADED');
      await expect(
        recoveryPage.getByRole('button', { name: /^Body\. Current state/i })
      ).toContainText('NOMINAL');

      const secondDownloadPromise = recoveryPage.waitForEvent('download');
      await recoveryPage.getByRole('button', { name: 'Export JSON' }).click();
      const secondDownload = await secondDownloadPromise;

      const secondDownloadPath = requireDownloadPath(await secondDownload.path());
      const secondRawText = await readFile(secondDownloadPath, 'utf8');
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
