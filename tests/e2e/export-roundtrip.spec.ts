/// <reference types="node" />

import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

type ExportEntry = {
  date: string;
  sectorId: string;
  status: string;
  updatedAt: string;
};

type ExportPayload = {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  entries: ExportEntry[];
  checksum?: string;
};

function requireDownloadPath(path: string | null): string {
  if (!path) {
    throw new Error('Playwright did not provide a downloadable file path.');
  }

  return path;
}

function parseExportPayload(rawText: string): ExportPayload {
  return JSON.parse(rawText) as ExportPayload;
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

    const workButton = page.getByRole('button', { name: /work or school/i });
    const bodyButton = page.getByRole('button', { name: /body/i });

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
    const firstBuffer = await readFile(firstDownloadPath);
    const firstPayload = parseExportPayload(firstBuffer.toString('utf-8'));

    expect(firstPayload.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizeExportPayload(firstPayload).entries).toHaveLength(2);

    const appUrl = new URL('/', page.url()).toString();
    const recoveryContext = await browser.newContext({ acceptDownloads: true });

    try {
      const recoveryPage = await recoveryContext.newPage();

      await recoveryPage.goto(appUrl);
      await recoveryPage.locator('[data-testid="import-file-input"]').setInputFiles({
        name: firstDownload.suggestedFilename(),
        mimeType: 'application/json',
        buffer: firstBuffer
      });

      await expect(recoveryPage.getByRole('heading', { name: 'Import ready' })).toBeVisible();
      await expect(recoveryPage.getByText(/integrity verified/i)).toBeVisible();
      await recoveryPage.getByRole('button', { name: 'Confirm Import' }).click();

      await expect(recoveryPage.getByRole('button', { name: /work or school/i })).toContainText(
        'DEGRADED'
      );
      await expect(recoveryPage.getByRole('button', { name: /body/i })).toContainText('NOMINAL');

      const secondDownloadPromise = recoveryPage.waitForEvent('download');
      await recoveryPage.getByRole('button', { name: 'Export JSON' }).click();
      const secondDownload = await secondDownloadPromise;

      expect(secondDownload.suggestedFilename()).toBe('opsnormal-export.json');

      const secondDownloadPath = requireDownloadPath(await secondDownload.path());
      const secondBuffer = await readFile(secondDownloadPath);
      const secondPayload = parseExportPayload(secondBuffer.toString('utf-8'));

      expect(secondPayload.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(secondPayload.checksum).toBe(firstPayload.checksum);
      expect(normalizeExportPayload(secondPayload)).toEqual(normalizeExportPayload(firstPayload));
    } finally {
      await recoveryContext.close();
    }
  });
});
