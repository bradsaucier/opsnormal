import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeJsonExportChecksum,
  createCrashJsonExport,
  createCsvExport,
  createJsonExport,
} from '../../src/lib/exportSerialization';
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type CrashStorageDiagnostics,
  type DailyEntry,
} from '../../src/types';

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
    const parsed = JSON.parse(json) as { exportedAt: string; checksum: string };

    expect(parsed.exportedAt).toBe('2026-04-14T00:00:00.000Z');
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
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
    };

    expect(parsed.exportedAt).toBe('2026-04-14T01:02:03.000Z');
    expect(parsed.crashDiagnostics).toEqual(sampleCrashDiagnostics);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
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
