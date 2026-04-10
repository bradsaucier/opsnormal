export const PWA_UPDATE_COORDINATION_CHANNEL_NAME = 'opsnormal-pwa-update-coordination';

type PwaUpdateCoordinationMessageType =
  | 'update-handoff-started'
  | 'update-handoff-stalled'
  | 'update-handoff-cleared';

export interface PwaUpdateCoordinationMessage {
  type: PwaUpdateCoordinationMessageType;
  sourceTabId: string;
  at: number;
}

function createCoordinationChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  try {
    return new BroadcastChannel(PWA_UPDATE_COORDINATION_CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function createPwaUpdateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `opsnormal-tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isPwaUpdateCoordinationMessage(value: unknown): value is PwaUpdateCoordinationMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'sourceTabId' in value &&
    'at' in value &&
    typeof value.type === 'string' &&
    typeof value.sourceTabId === 'string' &&
    typeof value.at === 'number'
  );
}

function broadcastCoordinationMessage(message: PwaUpdateCoordinationMessage): void {
  const channel = createCoordinationChannel();

  if (!channel) {
    return;
  }

  try {
    channel.postMessage(message);
  } catch {
    // Ignore coordination delivery failures. The local tab still owns its own recovery path.
  } finally {
    channel.close();
  }
}

export function broadcastPwaUpdateHandoffStarted(sourceTabId: string, at = Date.now()): void {
  broadcastCoordinationMessage({ type: 'update-handoff-started', sourceTabId, at });
}

export function broadcastPwaUpdateHandoffStalled(sourceTabId: string, at = Date.now()): void {
  broadcastCoordinationMessage({ type: 'update-handoff-stalled', sourceTabId, at });
}

export function broadcastPwaUpdateHandoffCleared(sourceTabId: string, at = Date.now()): void {
  broadcastCoordinationMessage({ type: 'update-handoff-cleared', sourceTabId, at });
}

export function subscribeToPwaUpdateCoordination(
  onMessage: (event: MessageEvent<unknown>) => void
): (() => void) | null {
  const channel = createCoordinationChannel();

  if (!channel) {
    return null;
  }

  channel.addEventListener('message', onMessage);

  return () => {
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
}
