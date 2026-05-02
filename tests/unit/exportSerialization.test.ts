import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHECKSUM_ALGORITHM_V2,
  computeJsonExportChecksum,
  createCrashJsonExport,
  createCsvExport,
  createJsonExport,
} from '../../src/lib/exportSerialization';
import { canonicalSerialize } from '../../src/lib/canonicalJson';
import { verifyParsedExportChecksum } from '../../src/services/importValidation';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type CrashStorageDiagnostics,
  type DailyEntry,
} from '../../src/types';

function stripEntryIds(entries: DailyEntry[]) {
  return entries.map((entry) => ({
    date: entry.date,
    sectorId: entry.sectorId,
    status: entry.status,
    updatedAt: entry.updatedAt,
  }));
}

const sampleEntries: DailyEntry[] = [
  {
    id: 1,
    date: '2026-03-27',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-27T12:00:00.000Z',
  },
];

const sampleCrashDiagnostics: CrashStorageDiagnostics = {
  connectionDropsDetected: 1,
  reconnectSuccesses: 1,
  reconnectFailures: 0,
  reconnectState: 'steady',
  lastReconnectError: null,
  persistAttempted: true,
  persistGranted: false,
  standaloneMode: false,
  installRecommended: true,
  webKitRisk: true,
  lastVerificationResult: 'verified',
  lastVerifiedAt: '2026-03-28T10:11:12.000Z',
};

describe('exportSerialization', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('escapes csv cells that contain commas, quotes, or newlines', () => {
    const csv = createCsvExport([
      {
        id: 2,
        date: '2026-03-28',
        sectorId: 'body',
        status: 'degraded',
        updatedAt: '2026-03-28T15:30:00.000Z,"quoted"\nnext',
      },
    ]);

    expect(csv).toContain(
      '2026-03-28,body,degraded,"2026-03-28T15:30:00.000Z,""quoted""\nnext"',
    );
  });

  it('uses the default exportedAt timestamp for standard json exports', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    const json = await createJsonExport(sampleEntries);
    const parsed = JSON.parse(json) as {
      exportedAt: string;
      checksum: string;
      entries: Array<Record<string, unknown>>;
    };

    expect(parsed.exportedAt).toBe('2026-04-14T00:00:00.000Z');
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.entries[0]).not.toHaveProperty('id');
  });

  it('uses the default exportedAt timestamp for crash json exports', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T01:02:03.000Z'));

    const json = await createCrashJsonExport(
      sampleEntries,
      sampleCrashDiagnostics,
    );
    const parsed = JSON.parse(json) as {
      exportedAt: string;
      checksum: string;
      crashDiagnostics: CrashStorageDiagnostics;
      entries: Array<Record<string, unknown>>;
    };

    expect(parsed.exportedAt).toBe('2026-04-14T01:02:03.000Z');
    expect(parsed.crashDiagnostics).toEqual(sampleCrashDiagnostics);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.entries[0]).not.toHaveProperty('id');
  });

  it('omits internal ids from json exports and computes the checksum from semantic fields only', async () => {
    const exportedAt = '2026-04-14T05:06:07.000Z';
    const json = await createJsonExport(sampleEntries, exportedAt);
    const parsed = JSON.parse(json) as {
      app: string;
      schemaVersion: number;
      checksumAlgorithm: string;
      exportedAt: string;
      checksum: string;
      entries: Array<Record<string, unknown>>;
    };

    expect(parsed.entries).toEqual(stripEntryIds(sampleEntries));
    expect(parsed.entries.every((entry) => !('id' in entry))).toBe(true);
    expect(parsed.checksumAlgorithm).toBe(CHECKSUM_ALGORITHM_V2);

    const recomputedChecksum = await computeJsonExportChecksum({
      app: OPSNORMAL_APP_NAME,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      checksumAlgorithm: CHECKSUM_ALGORITHM_V2,
      exportedAt,
      entries: stripEntryIds(sampleEntries),
    });

    expect(parsed.checksum).toBe(recomputedChecksum);
  });

  it('writes the canonical checksum algorithm tag near the top of json exports', async () => {
    const json = await createJsonExport(
      sampleEntries,
      '2026-04-14T05:06:07.000Z',
    );
    const parsed = JSON.parse(json) as {
      checksumAlgorithm: string;
    };

    expect(parsed.checksumAlgorithm).toBe(CHECKSUM_ALGORITHM_V2);
    expect(json.indexOf('"schemaVersion"')).toBeLessThan(
      json.indexOf('"checksumAlgorithm"'),
    );
    expect(json.indexOf('"checksumAlgorithm"')).toBeLessThan(
      json.indexOf('"exportedAt"'),
    );
  });

  it('verifies canonical v2 checksums after top-level and diagnostics keys are reordered', async () => {
    const json = await createCrashJsonExport(
      sampleEntries,
      sampleCrashDiagnostics,
      '2026-04-14T05:06:07.000Z',
    );
    const parsed = JSON.parse(json) as {
      crashDiagnostics: CrashStorageDiagnostics;
    } & Parameters<typeof verifyParsedExportChecksum>[0];
    const reorderedPayload = Object.fromEntries(
      Object.entries({
        ...parsed,
        crashDiagnostics: Object.fromEntries(
          Object.entries(parsed.crashDiagnostics).reverse(),
        ),
      }).reverse(),
    ) as unknown as Parameters<typeof verifyParsedExportChecksum>[0];

    await expect(
      verifyParsedExportChecksum(reorderedPayload),
    ).resolves.toBeUndefined();
  });

  it('pins the canonical v2 checksum input bytes', () => {
    const serialized = canonicalSerialize({
      app: OPSNORMAL_APP_NAME,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      checksumAlgorithm: CHECKSUM_ALGORITHM_V2,
      exportedAt: '2026-04-14T05:06:07.000Z',
      entries: stripEntryIds(sampleEntries),
    });

    expect(serialized).toBe(
      '{"app":"OpsNormal","checksumAlgorithm":"sha256-canonical-v1","entries":[{"date":"2026-03-27","sectorId":"work-school","status":"nominal","updatedAt":"2026-03-27T12:00:00.000Z"}],"exportedAt":"2026-04-14T05:06:07.000Z","schemaVersion":1}',
    );
  });

  it('uses the window secure-context hint when it is explicitly false', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries,
      }),
    ).rejects.toThrow('secure HTTPS origin');
  });

  it('uses the window secure-context hint when it is explicitly true', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries,
      }),
    ).rejects.toThrow('required Web Crypto API');
  });

  it('falls back to globalThis.isSecureContext when window does not expose a boolean', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    vi.stubGlobal('window', {
      isSecureContext: undefined,
    });
    vi.stubGlobal('isSecureContext', false);

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries,
      }),
    ).rejects.toThrow('secure HTTPS origin');
  });

  it('uses the global secure-context hint when it is explicitly true', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    vi.stubGlobal('window', {
      isSecureContext: undefined,
    });
    vi.stubGlobal('isSecureContext', true);

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries,
      }),
    ).rejects.toThrow('required Web Crypto API');
  });

  it('reports missing Web Crypto when no secure-context hint is available', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });
    vi.stubGlobal('window', {
      isSecureContext: undefined,
    });
    vi.stubGlobal('isSecureContext', undefined);

    await expect(
      computeJsonExportChecksum({
        app: OPSNORMAL_APP_NAME,
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: '2026-03-28T10:11:12.000Z',
        entries: sampleEntries,
      }),
    ).rejects.toThrow('required Web Crypto API');
  });

  it('fails when checksum input encoding unexpectedly returns no bytes', async () => {
    const originalTextEncoder = globalThis.TextEncoder;

    class BrokenTextEncoder {
      encode(): Uint8Array {
        return new Uint8Array();
      }
    }

    vi.stubGlobal('TextEncoder', BrokenTextEncoder);

    try {
      await expect(
        computeJsonExportChecksum({
          app: OPSNORMAL_APP_NAME,
          schemaVersion: EXPORT_SCHEMA_VERSION,
          exportedAt: '2026-03-28T10:11:12.000Z',
          entries: sampleEntries,
          crashDiagnostics: sampleCrashDiagnostics,
        }),
      ).rejects.toThrow('failed while encoding the backup payload');
    } finally {
      vi.stubGlobal('TextEncoder', originalTextEncoder);
    }
  });
});
