import {
  CONTROLLER_RELOAD_COUNT_KEY,
  CONTROLLER_RELOAD_LAST_AT_KEY,
  CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS,
  CONTROLLER_RELOAD_RECOVERY_CHANNEL_NAME,
  CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE,
  CONTROLLER_RELOAD_WINDOW_MS
} from './pwaUpdateConstants';
import type { ControllerReloadRecoveryMessage, ControllerReloadState } from './pwaUpdateTypes';

function readSessionNumber(key: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function readControllerReloadState(now = Date.now()): ControllerReloadState {
  const count = Math.max(0, readSessionNumber(CONTROLLER_RELOAD_COUNT_KEY) ?? 0);
  const lastAt = readSessionNumber(CONTROLLER_RELOAD_LAST_AT_KEY);

  if (lastAt === null || now - lastAt > CONTROLLER_RELOAD_WINDOW_MS) {
    return {
      count: 0,
      lastAt: null
    };
  }

  return {
    count,
    lastAt
  };
}

function writeControllerReloadState(count: number, timestamp: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(CONTROLLER_RELOAD_COUNT_KEY, String(count));
    window.sessionStorage.setItem(CONTROLLER_RELOAD_LAST_AT_KEY, String(timestamp));
  } catch {
    // Ignore sessionStorage access failures during recovery bookkeeping.
  }
}

export function clearControllerReloadState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(CONTROLLER_RELOAD_COUNT_KEY);
    window.sessionStorage.removeItem(CONTROLLER_RELOAD_LAST_AT_KEY);
  } catch {
    // Ignore sessionStorage access failures during recovery bookkeeping.
  }
}

export function recordControllerReloadAttempt(now = Date.now()): number {
  const currentState = readControllerReloadState(now);
  const nextCount = currentState.lastAt === null ? 1 : currentState.count + 1;
  writeControllerReloadState(nextCount, now);
  return nextCount;
}

export function isControllerReloadRecoveryRequired(now = Date.now()): boolean {
  return readControllerReloadState(now).count >= CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS;
}

function createRecoveryBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(CONTROLLER_RELOAD_RECOVERY_CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function isControllerReloadRecoveryMessage(value: unknown): value is ControllerReloadRecoveryMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE
  );
}

export function broadcastControllerReloadRecoveryClear(): void {
  const channel = createRecoveryBroadcastChannel();

  if (!channel) {
    return;
  }

  try {
    channel.postMessage({ type: CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE } satisfies ControllerReloadRecoveryMessage);
  } catch {
    // Ignore channel delivery failures during manual recovery.
  } finally {
    channel.close();
  }
}

export function subscribeToControllerReloadRecovery(
  onMessage: (event: MessageEvent<unknown>) => void
): (() => void) | null {
  const channel = createRecoveryBroadcastChannel();

  if (!channel) {
    return null;
  }

  channel.addEventListener('message', onMessage);

  return () => {
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
}
