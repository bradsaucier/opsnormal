
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeJsonExportChecksum,
  createCrashJsonExport,
  createCsvExport,
  createJsonExport,
} from "../../src/lib/exportSerialization";
import {
  EXPORT_SCHEMA_VERSION,
  OPSNORMAL_APP_NAME,
  type CrashStorageDiagnostics,
  type DailyEntry,
} from "../../src/types";

const sampleEntries: DailyEntry[] = [
  {
    id: 1,
    date: "2026-03-27",
    sectorId: "work-school",
    status: "nominal",
    updatedAt: "2026-03-27T12:00:00.000Z",
  },
];

const sampleCrashDiagnostics: CrashStorageDiagnostics = {
  connectionDropsDetected: 1,
  reconnectSuccesses: 1,
  reconnectFailures: 0,
  reconnectState: "steady",
  lastReconnectError: null,
  persistAttempted: true,
  persistGranted: false,
  standaloneMode: false,
  installRecommended: true,
  webKitRisk: true,
  lastVerificationResult: "verified",
  lastVerifiedAt: "2026-03-28T10:11:12.000Z",
};

function createPayload(overrides?: {
  crashDiagnostics?: CrashStorageDiagnostics;
  exportedAt?: string;
}) {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: overrides?.exportedAt ?? "2026-03-28T10:11:12.000Z",
    entries: sampleEntries,
    ...(overrides?.crashDiagnostics
      ? { crashDiagnostics: overrides.crashDiagnostics }
      : {}),
  };
}

describe("exportSerialization", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a standard json export without crash diagnostics", async () => {
    const json = await createJsonExport(
      sampleEntries,
      "2026-03-28T10:11:12.000Z",
    );
    const parsed = JSON.parse(json) as {
      app: string;
      schemaVersion: number;
      exportedAt: string;
      entries: DailyEntry[];
      checksum: string;
      crashDiagnostics?: CrashStorageDiagnostics;
    };

    expect(parsed.app).toBe(OPSNORMAL_APP_NAME);
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBe("2026-03-28T10:11:12.000Z");
    expect(parsed.entries).toEqual(sampleEntries);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect("crashDiagnostics" in parsed).toBe(false);
  });

  it("creates a crash json export with crash diagnostics included", async () => {
    const json = await createCrashJsonExport(
      sampleEntries,
      sampleCrashDiagnostics,
      "2026-03-28T10:11:12.000Z",
    );
    const parsed = JSON.parse(json) as {
      crashDiagnostics: CrashStorageDiagnostics;
      checksum: string;
    };

    expect(parsed.crashDiagnostics).toEqual(sampleCrashDiagnostics);
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the current time when exportedAt is omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T01:02:03.000Z"));

    const standardJson = await createJsonExport(sampleEntries);
    const crashJson = await createCrashJsonExport(
      sampleEntries,
      sampleCrashDiagnostics,
    );

    expect(JSON.parse(standardJson).exportedAt).toBe(
      "2026-04-14T01:02:03.000Z",
    );
    expect(JSON.parse(crashJson).exportedAt).toBe("2026-04-14T01:02:03.000Z");
  });

  it("computes deterministic checksums and changes them when crash diagnostics are added", async () => {
    const basePayload = createPayload();
    const crashPayload = createPayload({
      crashDiagnostics: sampleCrashDiagnostics,
    });

    const baseChecksumA = await computeJsonExportChecksum(basePayload);
    const baseChecksumB = await computeJsonExportChecksum(basePayload);
    const crashChecksum = await computeJsonExportChecksum(crashPayload);

    expect(baseChecksumA).toBe(baseChecksumB);
    expect(baseChecksumA).toMatch(/^[a-f0-9]{64}$/);
    expect(crashChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(crashChecksum).not.toBe(baseChecksumA);
  });

  it("leaves ordinary csv cells unquoted", () => {
    const csv = createCsvExport(sampleEntries);

    expect(csv).toContain(
      "2026-03-27,work-school,nominal,2026-03-27T12:00:00.000Z",
    );
  });

  it("quotes csv cells that contain commas", () => {
    const csv = createCsvExport([
      {
        ...sampleEntries[0],
        updatedAt: "2026-03-27T12:00:00.000Z,comma",
      },
    ]);

    expect(csv).toContain('"2026-03-27T12:00:00.000Z,comma"');
  });

  it("quotes csv cells that contain quotation marks", () => {
    const csv = createCsvExport([
      {
        ...sampleEntries[0],
        updatedAt: '2026-03-27T12:00:00.000Z "quoted"',
      },
    ]);

    expect(csv).toContain('"2026-03-27T12:00:00.000Z ""quoted"""');
  });

  it("quotes csv cells that contain newlines", () => {
    const csv = createCsvExport([
      {
        ...sampleEntries[0],
        updatedAt: "2026-03-27T12:00:00.000Z\nnext-line",
      },
    ]);

    expect(csv).toContain('"2026-03-27T12:00:00.000Z\nnext-line"');
  });

  it("throws the secure-origin error when window reports an insecure context", async () => {
    vi.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);
    vi.stubGlobal("window", { isSecureContext: false } as unknown as Window &
      typeof globalThis);

    await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
      "secure HTTPS origin",
    );
  });

  it("throws the missing Web Crypto error when window reports a secure context", async () => {
    vi.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);
    vi.stubGlobal("window", { isSecureContext: true } as unknown as Window &
      typeof globalThis);

    await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
      "required Web Crypto API",
    );
  });

  it("falls back to the global secure-context hint when window does not provide a boolean", async () => {
    vi.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);
    vi.stubGlobal("window", {
      isSecureContext: "unknown",
    } as unknown as Window & typeof globalThis);
    vi.stubGlobal("isSecureContext", false as unknown as boolean);

    await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
      "secure HTTPS origin",
    );
  });

  it("uses the global secure-context hint when it is true", async () => {
    vi.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);
    vi.stubGlobal("window", {
      isSecureContext: "unknown",
    } as unknown as Window & typeof globalThis);
    vi.stubGlobal("isSecureContext", true as unknown as boolean);

    await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
      "required Web Crypto API",
    );
  });

  it("defaults to the missing Web Crypto error when neither window nor global secure-context hints are available", async () => {
    vi.stubGlobal("crypto", { subtle: undefined } as unknown as Crypto);
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);
    vi.stubGlobal("isSecureContext", undefined as unknown as boolean);

    await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
      "required Web Crypto API",
    );
  });

  it("throws when payload encoding unexpectedly returns no bytes", async () => {
    const originalTextEncoder = globalThis.TextEncoder;

    class BrokenTextEncoder {
      encode(): Uint8Array {
        return new Uint8Array();
      }
    }

    vi.stubGlobal("TextEncoder", BrokenTextEncoder as typeof TextEncoder);

    try {
      await expect(computeJsonExportChecksum(createPayload())).rejects.toThrow(
        "failed while encoding the backup payload",
      );
    } finally {
      vi.stubGlobal("TextEncoder", originalTextEncoder);
    }
  });
});
