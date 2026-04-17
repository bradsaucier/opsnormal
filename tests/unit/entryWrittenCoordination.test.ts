import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../setup';

type EntryWrittenCoordinationModule =
  typeof import('../../src/services/entryWrittenCoordination');

class MockBroadcastChannel extends EventTarget {
  static instances: MockBroadcastChannel[] = [];

  closed = false;
  readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
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

  close() {
    this.closed = true;
  }
}

describe('entry-written coordination helpers', () => {
  async function loadModule(): Promise<EntryWrittenCoordinationModule> {
    vi.resetModules();
    return await import('../../src/services/entryWrittenCoordination');
  }

  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: MockBroadcastChannel,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a stable per-tab id from crypto.randomUUID when available', async () => {
    const coordination = await loadModule();

    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'opsnormal-uuid'),
    });

    expect(coordination.createEntryWrittenTabId()).toBe('opsnormal-uuid');
    expect(coordination.createEntryWrittenTabId()).toBe('opsnormal-uuid');
  });

  it('falls back to a generated tab id when randomUUID is unavailable', async () => {
    const coordination = await loadModule();

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_100_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const firstTabId = coordination.createEntryWrittenTabId();
    const secondTabId = coordination.createEntryWrittenTabId();

    expect(firstTabId).toMatch(/^opsnormal-tab-1776100000000-/);
    expect(secondTabId).toBe(firstTabId);
  });

  it('keeps a stable fallback tab id when session storage cannot persist it', async () => {
    const coordination = await loadModule();

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_150_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.456789123);
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const firstTabId = coordination.createEntryWrittenTabId();
    const secondTabId = coordination.createEntryWrittenTabId();

    expect(firstTabId).toMatch(/^opsnormal-tab-1776150000000-/);
    expect(secondTabId).toBe(firstTabId);
  });

  it('returns the cached fallback tab id when session storage later becomes unreadable', async () => {
    const coordination = await loadModule();

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_175_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.765432198);
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const firstTabId = coordination.createEntryWrittenTabId();

    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unreadable');
    });

    const secondTabId = coordination.createEntryWrittenTabId();

    expect(firstTabId).toMatch(/^opsnormal-tab-1776175000000-/);
    expect(secondTabId).toBe(firstTabId);
  });

  it('falls back to an in-memory tab id when window is unavailable', async () => {
    const coordination = await loadModule();

    vi.stubGlobal('window', undefined);
    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(1_776_200_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.987654321);

    const firstTabId = coordination.createEntryWrittenTabId();
    const secondTabId = coordination.createEntryWrittenTabId();

    expect(firstTabId).toMatch(/^opsnormal-tab-1776200000000-/);
    expect(secondTabId).toBe(firstTabId);
  });

  it('broadcasts entry-written messages across the coordination channel', async () => {
    const coordination = await loadModule();
    const received: unknown[] = [];
    const unsubscribe = coordination.subscribeToEntryWrittenCoordination(
      (event) => {
        received.push(event.data);
      },
    );

    expect(unsubscribe).not.toBeNull();
    expect(MockBroadcastChannel.instances[0]?.name).toBe(
      coordination.ENTRY_WRITTEN_COORDINATION_CHANNEL_NAME,
    );

    coordination.broadcastEntryWritten({
      type: 'entry-written',
      sourceTabId: 'tab-alpha',
      source: 'daily-status',
      at: 101,
    });
    await flushMicrotasks();

    expect(received).toEqual([
      {
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      },
    ]);

    unsubscribe?.();
  });

  it('returns null when BroadcastChannel is unavailable or cannot be created', async () => {
    let coordination = await loadModule();

    vi.stubGlobal('BroadcastChannel', undefined);

    expect(
      coordination.subscribeToEntryWrittenCoordination(() => undefined),
    ).toBeNull();
    expect(() =>
      coordination.broadcastEntryWritten({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      }),
    ).not.toThrow();

    class ThrowingBroadcastChannel {
      constructor() {
        throw new Error('constructor failed');
      }
    }

    vi.stubGlobal('BroadcastChannel', ThrowingBroadcastChannel);
    coordination = await loadModule();

    expect(
      coordination.subscribeToEntryWrittenCoordination(() => undefined),
    ).toBeNull();
    expect(() =>
      coordination.broadcastEntryWritten({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      }),
    ).not.toThrow();
  });

  it('swallows delivery failures and still closes the one-shot channel', async () => {
    const coordination = await loadModule();

    class FailingBroadcastChannel extends MockBroadcastChannel {
      override postMessage(): void {
        throw new Error('post failed');
      }
    }

    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: FailingBroadcastChannel,
    });

    expect(() =>
      coordination.broadcastEntryWritten({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      }),
    ).not.toThrow();
    expect(FailingBroadcastChannel.instances[0]?.closed).toBe(true);
  });

  it('validates coordination payloads strictly', async () => {
    const coordination = await loadModule();

    expect(
      coordination.isEntryWrittenCoordinationMessage({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      }),
    ).toBe(true);
    expect(
      coordination.isEntryWrittenCoordinationMessage({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
      }),
    ).toBe(false);
    expect(
      coordination.isEntryWrittenCoordinationMessage({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'import',
        at: 101,
      }),
    ).toBe(false);
    expect(
      coordination.isEntryWrittenCoordinationMessage({
        type: 'wrong-type',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: 101,
      }),
    ).toBe(false);
    expect(
      coordination.isEntryWrittenCoordinationMessage(
        Object.create({
          type: 'entry-written',
          sourceTabId: 'tab-alpha',
          source: 'daily-status',
          at: 101,
        }),
      ),
    ).toBe(false);
    expect(
      coordination.isEntryWrittenCoordinationMessage({
        type: 'entry-written',
        sourceTabId: 'tab-alpha',
        source: 'daily-status',
        at: Number.NaN,
      }),
    ).toBe(false);
    expect(coordination.isEntryWrittenCoordinationMessage(null)).toBe(false);
  });
});
