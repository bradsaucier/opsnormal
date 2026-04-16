import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reloadCurrentPage: vi.fn(),
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage,
  };
});

import {
  db,
  getAllEntries,
  handleDatabaseReady,
  handleDatabaseVersionChange,
  setDailyStatus,
  shouldSuppressControllerReload,
} from '../../src/db/appDb';
import {
  getStorageDurabilityDiagnostics,
  resetStorageDurabilityDiagnostics,
} from '../../src/lib/storage';
import type { DailyEntry } from '../../src/types';

function mockVerificationLookup(
  readImpl: () => Promise<DailyEntry | undefined>,
) {
  const originalWhere = db.dailyEntries.where.bind(db.dailyEntries);
  let equalsCallCount = 0;

  return vi.spyOn(db.dailyEntries, 'where').mockImplementation(((
    index: string,
  ) => {
    if (index !== '[date+sectorId]') {
      return originalWhere(index as '[date+sectorId]');
    }

    const whereClause = originalWhere(index as '[date+sectorId]');

    return {
      equals: ((compoundKey: [string, string]) => {
        equalsCallCount += 1;

        if (equalsCallCount === 2) {
          return {
            first: readImpl,
          } as unknown as ReturnType<typeof whereClause.equals>;
        }

        return whereClause.equals(compoundKey);
      }) as typeof whereClause.equals,
    } as unknown as ReturnType<typeof db.dailyEntries.where>;
  }) as typeof db.dailyEntries.where);
}

describe('appDb verification paths', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete window.__opsNormalDbTestApi__;
  });

  beforeEach(async () => {
    mocks.reloadCurrentPage.mockReset();
    window.sessionStorage.clear();
    resetStorageDurabilityDiagnostics();
    handleDatabaseReady();

    if (!db.isOpen()) {
      await db.open();
    }

    await db.dailyEntries.clear();
  });

  it('records mismatch when unmarked verification finds a residual row', async () => {
    await setDailyStatus('2026-03-27', 'rest', 'nominal');

    const whereSpy = mockVerificationLookup(() =>
      Promise.resolve({
        date: '2026-03-27',
        sectorId: 'rest',
        status: 'nominal',
        updatedAt: '2026-04-16T12:00:00.000Z',
      }),
    );

    try {
      await expect(
        setDailyStatus('2026-03-27', 'rest', 'unmarked'),
      ).rejects.toThrow(
        'Local write verification failed. Confirm the latest check-in, export now, then reload before continuing.',
      );
    } finally {
      whereSpy.mockRestore();
    }

    expect(getStorageDurabilityDiagnostics().lastVerificationResult).toBe(
      'mismatch',
    );
    expect(getStorageDurabilityDiagnostics().lastVerifiedAt).not.toBeNull();
  });

  it('records failed verification when the read-back lookup times out', async () => {
    const whereSpy = mockVerificationLookup(
      () => new Promise<DailyEntry | undefined>(() => {}),
    );
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((handler: TimerHandler) => {
        if (typeof handler === 'function') {
          (handler as () => void)();
        }

        return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
      }) as unknown as typeof globalThis.setTimeout);

    try {
      await expect(
        setDailyStatus('2026-03-27', 'body', 'nominal'),
      ).rejects.toThrow(
        'Local write verification stalled. Confirm the latest check-in, export now, then reload before continuing.',
      );
    } finally {
      setTimeoutSpy.mockRestore();
      whereSpy.mockRestore();
    }

    expect(getStorageDurabilityDiagnostics().lastVerificationResult).toBe(
      'failed',
    );
    expect(getStorageDurabilityDiagnostics().lastVerifiedAt).not.toBeNull();
  });

  it('holds the controller reload guard only inside the exact boundary window', () => {
    window.sessionStorage.setItem('opsnormal-schema-reload-guard', '10000');

    expect(shouldSuppressControllerReload(14_999)).toBe(true);
    expect(shouldSuppressControllerReload(15_000)).toBe(false);
  });

  it('retries once after a database-closed failure and wraps the retry error', async () => {
    const originalOrderBy = db.dailyEntries.orderBy.bind(db.dailyEntries);
    let orderByCallCount = 0;

    const orderBySpy = vi
      .spyOn(db.dailyEntries, 'orderBy')
      .mockImplementation(((index: string) => {
        if (index === '[date+sectorId]') {
          return {
            toArray: () => {
              orderByCallCount += 1;

              if (orderByCallCount === 1) {
                return Promise.reject(new Error('Database is closed'));
              }

              return Promise.reject(new Error('retry blew up'));
            },
          } as unknown as ReturnType<typeof db.dailyEntries.orderBy>;
        }

        return originalOrderBy(index as '[date+sectorId]');
      }) as typeof db.dailyEntries.orderBy);

    try {
      await expect(getAllEntries()).rejects.toThrow('retry blew up');
      expect(orderByCallCount).toBe(2);
    } finally {
      orderBySpy.mockRestore();
    }
  });

  it('covers reloading, blocked, and noop database version-change states', () => {
    expect(handleDatabaseVersionChange(10_000)).toBe('reloading');
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);

    handleDatabaseReady();
    window.sessionStorage.setItem('opsnormal-schema-reload-guard', '10000');

    expect(handleDatabaseVersionChange(12_000)).toBe('blocked');
    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);

    vi.stubGlobal('window', undefined);

    expect(handleDatabaseVersionChange(20_000)).toBe('noop');
  });

  it('installs the e2e test api when the module loads in e2e mode', async () => {
    vi.resetModules();
    vi.stubEnv('MODE', 'e2e');

    const appDbModule = await import('../../src/db/appDb');

    expect(window.__opsNormalDbTestApi__).toBeDefined();
    expect(window.__opsNormalDbTestApi__?.isRecoveryRequired()).toBe(
      appDbModule.isDatabaseRecoveryRequired(),
    );
    expect(window.__opsNormalDbTestApi__?.simulateVersionChange()).toBe(
      'reloading',
    );
  });
});
