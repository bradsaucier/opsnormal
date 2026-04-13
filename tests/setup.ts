import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

import { afterEach } from 'vitest';
import { configureAxe } from 'vitest-axe';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type BroadcastMessageHandler = ((event: MessageEvent<unknown>) => void) | null;

class TestBroadcastChannel extends EventTarget {
  private static readonly channels = new Map<string, Set<TestBroadcastChannel>>();

  static resetForTesting(): void {
    for (const instances of TestBroadcastChannel.channels.values()) {
      for (const instance of instances) {
        instance.closed = true;
      }
    }

    TestBroadcastChannel.channels.clear();
  }

  readonly name: string;
  closed = false;
  onmessage: BroadcastMessageHandler = null;

  constructor(name: string) {
    super();
    this.name = name;

    if (!TestBroadcastChannel.channels.has(name)) {
      TestBroadcastChannel.channels.set(name, new Set());
    }

    TestBroadcastChannel.channels.get(name)?.add(this);
  }

  postMessage(message: unknown): void {
    if (this.closed) {
      return;
    }

    const peers = Array.from(TestBroadcastChannel.channels.get(this.name) ?? []);

    queueMicrotask(() => {
      for (const peer of peers) {
        if (peer === this || peer.closed) {
          continue;
        }

        const event = new MessageEvent<unknown>('message', { data: message });
        peer.dispatchEvent(event);
        peer.onmessage?.(event);
      }
    });
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    TestBroadcastChannel.channels.get(this.name)?.delete(this);

    if (TestBroadcastChannel.channels.get(this.name)?.size === 0) {
      TestBroadcastChannel.channels.delete(this.name);
    }
  }
}

if (typeof globalThis.BroadcastChannel === 'undefined') {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    writable: true,
    value: TestBroadcastChannel,
  });
}

if (typeof URL.createObjectURL !== 'function') {
  let objectUrlSequence = 0;

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => `blob:opsnormal-test-${++objectUrlSequence}`,
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

afterEach(() => {
  TestBroadcastChannel.resetForTesting();
});

export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

export async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
