import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PWA_UPDATE_COORDINATION_CHANNEL_NAME,
  broadcastPwaUpdateHandoffCleared,
  broadcastPwaUpdateHandoffStalled,
  broadcastPwaUpdateHandoffStarted,
  createPwaUpdateTabId,
  isPwaUpdateCoordinationMessage,
  subscribeToPwaUpdateCoordination,
} from '../../src/features/pwa/pwaUpdateCoordination';

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
    for (const instance of MockBroadcastChannel.instances) {
      if (instance === this || instance.closed || instance.name !== this.name) {
        continue;
      }

      const event = new MessageEvent<unknown>('message', { data: message });
      instance.dispatchEvent(event);
    }
  }

  close() {
    this.closed = true;
  }
}

describe('pwa update coordination helpers', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: MockBroadcastChannel,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a stable tab id from crypto.randomUUID when available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: vi.fn(() => 'opsnormal-uuid'),
      },
    });

    expect(createPwaUpdateTabId()).toBe('opsnormal-uuid');
  });

  it('falls back to a generated tab id when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_776_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    expect(createPwaUpdateTabId()).toMatch(/^opsnormal-tab-1776000000000-/);
  });

  it('broadcasts handoff lifecycle messages across the coordination channel', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeToPwaUpdateCoordination((event) => {
      received.push(event.data);
    });

    expect(unsubscribe).not.toBeNull();
    expect(MockBroadcastChannel.instances[0]?.name).toBe(
      PWA_UPDATE_COORDINATION_CHANNEL_NAME,
    );

    broadcastPwaUpdateHandoffStarted('tab-alpha', 101);
    broadcastPwaUpdateHandoffStalled('tab-alpha', 202);
    broadcastPwaUpdateHandoffCleared('tab-alpha', 303);

    expect(received).toEqual([
      {
        type: 'update-handoff-started',
        sourceTabId: 'tab-alpha',
        at: 101,
      },
      {
        type: 'update-handoff-stalled',
        sourceTabId: 'tab-alpha',
        at: 202,
      },
      {
        type: 'update-handoff-cleared',
        sourceTabId: 'tab-alpha',
        at: 303,
      },
    ]);

    unsubscribe?.();
  });

  it('validates coordination message payloads', () => {
    expect(
      isPwaUpdateCoordinationMessage({
        type: 'update-handoff-started',
        sourceTabId: 'tab-alpha',
        at: 101,
      }),
    ).toBe(true);
    expect(
      isPwaUpdateCoordinationMessage({ type: 'update-handoff-started' }),
    ).toBe(false);
    expect(isPwaUpdateCoordinationMessage(null)).toBe(false);
  });
});
