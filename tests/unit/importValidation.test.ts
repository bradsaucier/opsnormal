import { describe, expect, it } from 'vitest';

import { computeJsonExportChecksum } from '../../src/lib/export';
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
  it('accepts a valid export payload', async () => {
    const raw = JSON.stringify(buildPayload());
    const parsed = await parseImportPayload(raw);

    expect(parsed.entries).toHaveLength(1);
  });

  it('rejects malformed json', async () => {
    await expect(parseImportPayload('{bad json')).rejects.toThrow(
      'Import rejected. File is not valid JSON.'
    );
  });

  it('rejects duplicate date and sector pairs', async () => {
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

    await expect(parseImportPayload(raw)).rejects.toThrow(
      'Duplicate entry detected for 2026-03-28:body.'
    );
  });

  it('rejects blocked keys', async () => {
    const raw = '{"app":"OpsNormal","schemaVersion":1,"exportedAt":"2026-03-28T12:00:00.000Z","entries":[],"__proto__":{}}';

    await expect(parseImportPayload(raw)).rejects.toThrow(
      'Import rejected. File contains blocked keys.'
    );
  });

  it('rejects invalid sectors', async () => {
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

    await expect(parseImportPayload(raw)).rejects.toThrow();
  });

  it('rejects a payload with an invalid checksum format', async () => {
    const payload = buildPayload({
      checksum: 'abc123'
    });

    await expect(parseImportPayload(JSON.stringify(payload))).rejects.toThrow(
      'checksum - Checksum must be a 64-character lowercase SHA-256 hex digest.'
    );
  });

  it('accepts a payload with a valid checksum', async () => {
    const payload = buildPayload();
    payload.checksum = await computeJsonExportChecksum({
      app: payload.app,
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      entries: payload.entries
    });

    const parsed = await parseImportPayload(JSON.stringify(payload));

    expect(parsed.checksum).toBe(payload.checksum);
  });

  it('rejects a payload with a mismatched checksum', async () => {
    const payload = buildPayload();
    payload.checksum = await computeJsonExportChecksum({
      app: payload.app,
      schemaVersion: payload.schemaVersion,
      exportedAt: payload.exportedAt,
      entries: payload.entries
    });
    payload.entries[0] = {
      ...payload.entries[0]!,
      status: 'degraded'
    };

    await expect(parseImportPayload(JSON.stringify(payload))).rejects.toThrow(
      'Import rejected. File integrity check failed. The backup may be corrupted or modified.'
    );
  });

  it('accepts legacy payloads without a checksum', async () => {
    const legacyPayload = buildPayload();
    delete legacyPayload.checksum;
    const parsed = await parseImportPayload(JSON.stringify(legacyPayload));

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.checksum).toBeUndefined();
  });
});
