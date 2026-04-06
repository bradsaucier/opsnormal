import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeJsonExportChecksum,
  createCsvExport,
  createJsonExport,
  formatLastExportCompletedAt
} from '../../src/lib/export';
import { parseImportPayload } from '../../src/services/importValidation';
import { parseExportPayload } from '../helpers/exportPayload';
import { EXPORT_SCHEMA_VERSION, OPSNORMAL_APP_NAME, type DailyEntry } from '../../src/types';

const sampleEntries: DailyEntry[] = [
  {
    id: 1,
    date: '2026-03-27',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-27T12:00:00.000Z'
  }
];

describe('export helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates csv with header and rows', () => {
    const csv = createCsvExport(sampleEntries);

    expect(csv).toContain('date,sectorId,status,updatedAt');
    expect(csv).toContain('2026-03-27,work-school,nominal,2026-03-27T12:00:00.000Z');
  });

  it('creates versioned json payload with entries and checksum', async () => {
    const exportedAt = '2026-03-28T10:11:12.000Z';
    const json = await createJsonExport(sampleEntries, exportedAt);
    const parsed = parseExportPayload(json);

    expect(parsed.app).toBe(OPSNORMAL_APP_NAME);
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe(exportedAt);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces output that passes import validation', async () => {
    const exportedAt = '2026-03-28T10:11:12.000Z';
    const json = await createJsonExport(sampleEntries, exportedAt);
    const parsed = await parseImportPayload(json);

    expect(parsed.entries).toEqual(sampleEntries);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('includes a checksum that matches recomputation', async () => {
    const exportedAt = '2026-03-28T10:11:12.000Z';
    const json = await createJsonExport(sampleEntries, exportedAt);
    const parsed = parseExportPayload(json);

    const recomputedChecksum: string = await computeJsonExportChecksum({
      app: parsed.app,
      schemaVersion: parsed.schemaVersion,
      exportedAt: parsed.exportedAt,
      entries: parsed.entries
    });

    expect(parsed.checksum).toBe(recomputedChecksum);
  });

  it('fails cleanly when subtle crypto is unavailable', async () => {
    vi.stubGlobal('crypto', {
      subtle: undefined
    });
    vi.stubGlobal('isSecureContext', true);

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries
      })
    ).rejects.toThrow('required Web Crypto API');
  });

  it('formats backup status text when no export is recorded', () => {
    expect(formatLastExportCompletedAt(null)).toBe(
      'No external backup recorded on this browser yet.'
    );
  });
});
