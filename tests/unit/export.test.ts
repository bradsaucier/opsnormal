import { describe, expect, it } from 'vitest';

import { createCsvExport, createJsonExport } from '../../src/lib/export';
import type { DailyEntry } from '../../src/types';

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

  it('creates json payload with entries', () => {
    const json = createJsonExport(sampleEntries);
    const parsed = JSON.parse(json) as { app: string; entries: DailyEntry[] };

    expect(parsed.app).toBe('OpsNormal');
    expect(parsed.entries).toHaveLength(1);
  });
});
