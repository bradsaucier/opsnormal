import { beforeEach, describe, expect, it } from 'vitest';

import {
  CONTROLLER_RELOAD_COUNT_KEY,
  CONTROLLER_RELOAD_LAST_AT_KEY,
  CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE,
  CONTROLLER_RELOAD_WINDOW_MS,
} from '../../src/features/pwa/pwaUpdateConstants';
import {
  broadcastControllerReloadRecoveryClear,
  clearControllerReloadState,
  isControllerReloadRecoveryMessage,
  isControllerReloadRecoveryRequired,
  readControllerReloadState,
  recordControllerReloadAttempt,
  subscribeToControllerReloadRecovery,
} from '../../src/features/pwa/controllerReloadRecovery';

class MockBroadcastChannel extends EventTarget {
  static instances: MockBroadcastChannel[] = [];

  readonly name: string;
  closed = false;

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

describe('controller reload recovery helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    MockBroadcastChannel.instances = [];
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: MockBroadcastChannel,
    });
  });

  it('starts empty and clears stale reload windows', () => {
    expect(readControllerReloadState(1_000)).toEqual({
      count: 0,
      lastAt: null,
    });

    window.sessionStorage.setItem(CONTROLLER_RELOAD_COUNT_KEY, '2');
    window.sessionStorage.setItem(CONTROLLER_RELOAD_LAST_AT_KEY, '1000');

    expect(
      readControllerReloadState(1_000 + CONTROLLER_RELOAD_WINDOW_MS + 1),
    ).toEqual({
      count: 0,
      lastAt: null,
    });
  });

  it('records reload attempts inside the active session window', () => {
    expect(recordControllerReloadAttempt(1_000)).toBe(1);
    expect(recordControllerReloadAttempt(1_500)).toBe(2);
    expect(readControllerReloadState(1_500)).toEqual({
      count: 2,
      lastAt: 1_500,
    });
    expect(isControllerReloadRecoveryRequired(1_500)).toBe(true);
  });

  it('clears session bookkeeping keys', () => {
    recordControllerReloadAttempt(1_000);
    clearControllerReloadState();

    expect(window.sessionStorage.getItem(CONTROLLER_RELOAD_COUNT_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(CONTROLLER_RELOAD_LAST_AT_KEY)).toBeNull();
  });

  it('broadcasts and receives manual recovery clear messages', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeToControllerReloadRecovery((event) => {
      received.push(event.data);
    });

    broadcastControllerReloadRecoveryClear();

    expect(received).toEqual([
      {
        type: CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE,
      },
    ]);
    expect(
      isControllerReloadRecoveryMessage({
        type: CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE,
      }),
    ).toBe(true);
    expect(isControllerReloadRecoveryMessage({ type: 'wrong' })).toBe(false);

    unsubscribe?.();
  });
});
