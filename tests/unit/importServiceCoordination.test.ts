import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OPSNORMAL_APP_NAME, type JsonExportPayload } from '../../src/types';
import { flushMicrotasks } from '../setup';

class MockBroadcastChannel extends EventTarget {
  static instances: MockBroadcastChannel[] = [];

  closed = false;
  readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown): void {
    queueMicrotask(() => {
      for (const instance of MockBroadcastChannel.instances) {
        if (
          instance === this ||
          instance.closed ||
          instance.name !== this.name
        ) {
          continue;
        }

        instance.dispatchEvent(
          new MessageEvent<unknown>('message', { data: message }),
        );
      }
    });
  }

  close(): void {
    this.closed = true;
  }
}

function buildPayload(
  entries: JsonExportPayload['entries'],
): JsonExportPayload {
  return {
    app: OPSNORMAL_APP_NAME,
    schemaVersion: 1,
    exportedAt: '2026-03-28T12:00:00.000Z',
    entries,
  };
}

async function loadModules() {
  vi.resetModules();

  const coordinationModule =
    await import('../../src/services/entryWrittenCoordination');
  const appDbModule = await import('../../src/db/appDb');
  const importServiceModule = await import('../../src/services/importService');

  if (!appDbModule.db.isOpen()) {
    await appDbModule.db.open();
  }

  await appDbModule.db.dailyEntries.clear();
  importServiceModule.__resetUndoSnapshotStateForTests();

  return {
    coordinationModule,
    appDbModule,
    importServiceModule,
  };
}

describe('import service cross-tab undo invalidation', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    const appDbModule = await import('../../src/db/appDb');

    if (appDbModule.db.isOpen()) {
      await appDbModule.db.dailyEntries.clear();
    }
  });

  it('invalidates a staged undo on a valid peer-tab message and fails closed on restore', async () => {
    const { coordinationModule, appDbModule, importServiceModule } =
      await loadModules();

    await appDbModule.setDailyStatus('2026-03-27', 'body', 'nominal');

    const result = await importServiceModule.applyImport(
      buildPayload([
        {
          date: '2026-03-29',
          sectorId: 'household',
          status: 'nominal',
          updatedAt: '2026-03-29T12:00:00.000Z',
        },
      ]),
      'replace',
      { allowUnverified: true },
    );
    const windowEventSpy = vi.fn();
    window.addEventListener('opsnormal:entry-written', windowEventSpy);

    try {
      coordinationModule.broadcastEntryWritten({
        type: 'entry-written',
        sourceTabId: 'peer-tab',
        source: 'daily-status',
        at: 101,
      });
      await flushMicrotasks();

      expect(windowEventSpy).toHaveBeenCalledTimes(1);
      await expect(result.undo()).rejects.toMatchObject({
        name: 'UndoInvalidatedError',
        code: 'UNDO_INVALIDATED',
      });
    } finally {
      window.removeEventListener('opsnormal:entry-written', windowEventSpy);
    }
  });

  it('ignores same-tab echoes, non-daily-status messages, and malformed payloads', async () => {
    const { coordinationModule, appDbModule, importServiceModule } =
      await loadModules();

    await appDbModule.setDailyStatus('2026-03-27', 'body', 'nominal');

    const validPayload = buildPayload([
      {
        date: '2026-03-29',
        sectorId: 'household',
        status: 'nominal',
        updatedAt: '2026-03-29T12:00:00.000Z',
      },
    ]);

    const sameTabUndo = await importServiceModule.applyImport(
      validPayload,
      'replace',
      { allowUnverified: true },
    );

    coordinationModule.broadcastEntryWritten({
      type: 'entry-written',
      sourceTabId: coordinationModule.createEntryWrittenTabId(),
      source: 'daily-status',
      at: 102,
    });
    await flushMicrotasks();
    await expect(sameTabUndo.undo()).resolves.toBeUndefined();

    await appDbModule.setDailyStatus('2026-03-27', 'body', 'nominal');

    const wrongSourceUndo = await importServiceModule.applyImport(
      validPayload,
      'replace',
      { allowUnverified: true },
    );
    const wrongSourceChannel = new MockBroadcastChannel(
      coordinationModule.ENTRY_WRITTEN_COORDINATION_CHANNEL_NAME,
    );
    wrongSourceChannel.postMessage({
      type: 'entry-written',
      sourceTabId: 'peer-tab',
      source: 'backup',
      at: 103,
    });
    wrongSourceChannel.close();
    await flushMicrotasks();
    await expect(wrongSourceUndo.undo()).resolves.toBeUndefined();

    await appDbModule.setDailyStatus('2026-03-27', 'body', 'nominal');

    const malformedUndo = await importServiceModule.applyImport(
      validPayload,
      'replace',
      { allowUnverified: true },
    );
    const malformedChannel = new MockBroadcastChannel(
      coordinationModule.ENTRY_WRITTEN_COORDINATION_CHANNEL_NAME,
    );
    malformedChannel.postMessage(
      Object.create({
        type: 'entry-written',
        sourceTabId: 'peer-tab',
        source: 'daily-status',
        at: 104,
      }),
    );
    malformedChannel.close();
    await flushMicrotasks();
    await expect(malformedUndo.undo()).resolves.toBeUndefined();
  });

  it('imports cleanly without BroadcastChannel and still honors the same-tab window invalidation path', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    const { appDbModule, importServiceModule } = await loadModules();

    await appDbModule.setDailyStatus('2026-03-27', 'body', 'nominal');

    const result = await importServiceModule.applyImport(
      buildPayload([
        {
          date: '2026-03-29',
          sectorId: 'household',
          status: 'nominal',
          updatedAt: '2026-03-29T12:00:00.000Z',
        },
      ]),
      'replace',
      { allowUnverified: true },
    );

    window.dispatchEvent(
      new CustomEvent('opsnormal:entry-written', {
        detail: { source: 'daily-status' },
      }),
    );

    await expect(result.undo()).rejects.toMatchObject({
      name: 'UndoInvalidatedError',
      code: 'UNDO_INVALIDATED',
    });
  });
});
