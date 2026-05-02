import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, getAllEntries, setDailyStatus } from '../../src/db/appDb';
import { UnverifiedImportRejectedError } from '../../src/lib/errors';
import { createCrashJsonExport, createJsonExport } from '../../src/lib/export';
import {
  __resetUndoSnapshotStateForTests,
  applyImport,
} from '../../src/services/importService';
import {
  ChecksumFailedImportError,
  parseImportPayload,
} from '../../src/services/importValidation';
import type {
  CrashStorageDiagnostics,
  DailyEntry,
  JsonExportPayload,
} from '../../src/types';

const verifiedExportedAt = '2026-03-28T12:00:00.000Z';

function buildEntries(): DailyEntry[] {
  return [
    {
      date: '2026-03-28',
      sectorId: 'body',
      status: 'nominal',
      updatedAt: '2026-03-28T12:00:00.000Z',
    },
    {
      date: '2026-03-29',
      sectorId: 'rest',
      status: 'degraded',
      updatedAt: '2026-03-29T12:00:00.000Z',
    },
  ];
}

function buildExportOrderedCrashDiagnostics(): CrashStorageDiagnostics {
  return {
    connectionDropsDetected: 1,
    reconnectSuccesses: 1,
    reconnectFailures: 0,
    reconnectState: 'steady',
    lastReconnectError: null,
    lastVerificationResult: 'verified',
    lastVerifiedAt: '2026-03-28T12:00:00.000Z',
    persistAttempted: true,
    persistGranted: false,
    standaloneMode: false,
    installRecommended: true,
    webKitRisk: true,
  };
}

async function buildVerifiedPayload(
  entries: DailyEntry[] = buildEntries(),
): Promise<JsonExportPayload> {
  return parseImportPayload(
    await createJsonExport(entries, verifiedExportedAt),
  );
}

function expectNoRwTransaction(transactionSpy: {
  mock: { calls: unknown[][] };
}): void {
  expect(transactionSpy.mock.calls.some(([mode]) => mode === 'rw')).toBe(false);
}

function tamperFirstEntry(payload: JsonExportPayload): void {
  const firstEntry = payload.entries[0];

  if (!firstEntry) {
    throw new Error('Test payload must include at least one entry.');
  }

  firstEntry.status = 'degraded';
}

describe('applyImport integrity gate', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    __resetUndoSnapshotStateForTests();
    await db.dailyEntries.clear();
  });

  it('writes verified payloads successfully', async () => {
    const payload = await buildVerifiedPayload();

    const result = await applyImport(payload, 'merge');

    expect(result.importedCount).toBe(payload.entries.length);
    expect(await db.dailyEntries.count()).toBe(payload.entries.length);
  });

  it('writes verified crash export payloads successfully', async () => {
    const rawPayload = await createCrashJsonExport(
      buildEntries(),
      buildExportOrderedCrashDiagnostics(),
      verifiedExportedAt,
    );
    const payload = await parseImportPayload(rawPayload);

    const result = await applyImport(payload, 'merge');

    expect(result.importedCount).toBe(payload.entries.length);
    expect(await db.dailyEntries.count()).toBe(payload.entries.length);
  });

  it('rejects tampered entries before opening a rw transaction', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    const preImportCount = await db.dailyEntries.count();
    const payload = await buildVerifiedPayload();
    tamperFirstEntry(payload);
    const transactionSpy = vi.spyOn(db, 'transaction');

    try {
      await expect(applyImport(payload, 'merge')).rejects.toBeInstanceOf(
        ChecksumFailedImportError,
      );
      expect(await db.dailyEntries.count()).toBe(preImportCount);
      expectNoRwTransaction(transactionSpy);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('rejects a tampered checksum field before opening a rw transaction', async () => {
    const payload = await buildVerifiedPayload();
    payload.checksum = 'f'.repeat(64);
    const transactionSpy = vi.spyOn(db, 'transaction');

    try {
      await expect(applyImport(payload, 'merge')).rejects.toBeInstanceOf(
        ChecksumFailedImportError,
      );
      expectNoRwTransaction(transactionSpy);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('rejects missing checksums without an explicit opt-in', async () => {
    const payload = await buildVerifiedPayload();
    delete payload.checksum;
    const transactionSpy = vi.spyOn(db, 'transaction');

    try {
      await expect(applyImport(payload, 'merge')).rejects.toBeInstanceOf(
        UnverifiedImportRejectedError,
      );
      expectNoRwTransaction(transactionSpy);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('accepts missing checksums when unverified imports are explicitly allowed', async () => {
    const payload = await buildVerifiedPayload();
    delete payload.checksum;

    const result = await applyImport(payload, 'merge', {
      allowUnverified: true,
    });

    expect(result.importedCount).toBe(payload.entries.length);
    expect(await db.dailyEntries.count()).toBe(payload.entries.length);
  });

  it('preserves existing entries on replace when the payload is tampered', async () => {
    await setDailyStatus('2026-03-27', 'body', 'nominal');
    await setDailyStatus('2026-03-27', 'rest', 'degraded');
    const originalEntries = await getAllEntries();
    const payload = await buildVerifiedPayload();
    tamperFirstEntry(payload);
    const transactionSpy = vi.spyOn(db, 'transaction');

    try {
      await expect(applyImport(payload, 'replace')).rejects.toBeInstanceOf(
        ChecksumFailedImportError,
      );
      expect(await getAllEntries()).toEqual(originalEntries);
      expectNoRwTransaction(transactionSpy);
    } finally {
      transactionSpy.mockRestore();
    }
  });

  it('does not stage an undo function when integrity verification fails', async () => {
    const payload = await buildVerifiedPayload();
    tamperFirstEntry(payload);
    let result: Awaited<ReturnType<typeof applyImport>> | null = null;

    await expect(
      applyImport(payload, 'merge').then((applyResult) => {
        result = applyResult;
        return applyResult;
      }),
    ).rejects.toBeInstanceOf(ChecksumFailedImportError);

    expect(result).toBeNull();
  });
});
