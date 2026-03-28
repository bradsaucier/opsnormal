import { describe, expect, it } from 'vitest';

import { parseImportPayload } from '../../src/services/importService';
import { OPSNORMAL_APP_NAME, type JsonExportPayload } from '../../src/types';

function buildPayload(overrides: Partial<JsonExportPayload> = {}): JsonExportPayload {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: 1,
    exportedAt: '2026-03-28T12:00:00.000Z',
    entries: [
      {
        id: 1,
        date: '2026-03-28',
        sectorId: 'body',
        status: 'nominal',
        updatedAt: '2026-03-28T12:00:00.000Z'
      }
    ],
    ...overrides
  };
}

describe('import validation', () => {
  it('accepts a valid export payload', () => {
    const raw = JSON.stringify(buildPayload());
    const parsed = parseImportPayload(raw);

    expect(parsed.entries).toHaveLength(1);
  });

  it('rejects malformed json', () => {
    expect(() => parseImportPayload('{bad json')).toThrow('Import rejected. File is not valid JSON.');
  });

  it('rejects duplicate date and sector pairs', () => {
    const raw = JSON.stringify(
      buildPayload({
        entries: [
          {
            id: 1,
            date: '2026-03-28',
            sectorId: 'body',
            status: 'nominal',
            updatedAt: '2026-03-28T12:00:00.000Z'
          },
          {
            id: 2,
            date: '2026-03-28',
            sectorId: 'body',
            status: 'degraded',
            updatedAt: '2026-03-28T12:05:00.000Z'
          }
        ]
      })
    );

    expect(() => parseImportPayload(raw)).toThrow('Duplicate entry detected for 2026-03-28:body.');
  });

  it('rejects blocked keys', () => {
    const raw = '{"app":"OpsNormal","schemaVersion":1,"exportedAt":"2026-03-28T12:00:00.000Z","entries":[],"__proto__":{}}';

    expect(() => parseImportPayload(raw)).toThrow('Import rejected. File contains blocked keys.');
  });

  it('rejects invalid sectors', () => {
    const raw = JSON.stringify(
      buildPayload({
        entries: [
          {
            id: 1,
            date: '2026-03-28',
            sectorId: 'invalid-sector' as never,
            status: 'nominal',
            updatedAt: '2026-03-28T12:00:00.000Z'
          }
        ]
      })
    );

    expect(() => parseImportPayload(raw)).toThrow();
  });
});
