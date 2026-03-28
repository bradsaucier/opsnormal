import { describe, expect, it } from 'vitest';

import {
  createCsvExport,
  createJsonExport,
  formatLastExportCompletedAt
} from '../../src/lib/export';
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
  it('creates csv with header and rows', () => {
    const csv = createCsvExport(sampleEntries);

    expect(csv).toContain('date,sectorId,status,updatedAt');
    expect(csv).toContain('2026-03-27,work-school,nominal,2026-03-27T12:00:00.000Z');
  });

  it('creates versioned json payload with entries', () => {
    const exportedAt = '2026-03-28T10:11:12.000Z';
    const json = createJsonExport(sampleEntries, exportedAt);
    const parsed = JSON.parse(json) as {
      app: string;
      schemaVersion: number;
      exportedAt: string;
      entries: DailyEntry[];
    };

    expect(parsed.app).toBe(OPSNORMAL_APP_NAME);
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe(exportedAt);
    expect(parsed.entries).toHaveLength(1);
  });

  it('formats backup status text when no export is recorded', () => {
    expect(formatLastExportCompletedAt(null)).toBe(
      'No external backup recorded on this browser yet.'
    );
  });
});
