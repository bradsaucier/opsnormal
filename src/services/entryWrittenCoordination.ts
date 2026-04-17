export const ENTRY_WRITTEN_COORDINATION_CHANNEL_NAME =
  'opsnormal-entry-written-coordination';

const ENTRY_WRITTEN_TAB_ID_STORAGE_KEY = 'opsnormal-entry-written-tab-id';

let fallbackTabId: string | null = null;

export interface EntryWrittenCoordinationMessage {
  type: 'entry-written';
  sourceTabId: string;
  source: 'daily-status';
  at: number;
}

function createCoordinationChannel(): BroadcastChannel | null {
  if (
    typeof window === 'undefined' ||
    typeof BroadcastChannel === 'undefined'
  ) {
    return null;
  }

  try {
    return new BroadcastChannel(ENTRY_WRITTEN_COORDINATION_CHANNEL_NAME);
  } catch {
    return null;
  }
}

function createRandomTabId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `opsnormal-tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEntryWrittenTabId(): string {
  if (typeof window === 'undefined') {
    fallbackTabId ??= createRandomTabId();
    return fallbackTabId;
  }

  let existingTabId = fallbackTabId;

  try {
    existingTabId =
      window.sessionStorage.getItem(ENTRY_WRITTEN_TAB_ID_STORAGE_KEY) ??
      fallbackTabId;
  } catch {
    // Ignore session-scoped storage access failures during coordination setup.
  }

  if (existingTabId) {
    fallbackTabId = existingTabId;
    return existingTabId;
  }

  const nextTabId = createRandomTabId();
  fallbackTabId = nextTabId;

  try {
    window.sessionStorage.setItem(ENTRY_WRITTEN_TAB_ID_STORAGE_KEY, nextTabId);
  } catch {
    // Ignore session-scoped storage write failures during coordination setup.
  }

  return nextTabId;
}

function hasOwnProperty(
  value: object,
  property: keyof EntryWrittenCoordinationMessage,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

export function isEntryWrittenCoordinationMessage(
  value: unknown,
): value is EntryWrittenCoordinationMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    !hasOwnProperty(value, 'type') ||
    !hasOwnProperty(value, 'sourceTabId') ||
    !hasOwnProperty(value, 'source') ||
    !hasOwnProperty(value, 'at')
  ) {
    return false;
  }

  return (
    candidate.type === 'entry-written' &&
    typeof candidate.sourceTabId === 'string' &&
    candidate.source === 'daily-status' &&
    typeof candidate.at === 'number' &&
    Number.isFinite(candidate.at)
  );
}

export function broadcastEntryWritten(
  message: EntryWrittenCoordinationMessage,
): void {
  const channel = createCoordinationChannel();

  if (!channel) {
    return;
  }

  try {
    channel.postMessage(message);
  } catch {
    // Ignore coordination delivery failures. The local tab still owns its own invalidation path.
  } finally {
    channel.close();
  }
}

export function subscribeToEntryWrittenCoordination(
  onMessage: (event: MessageEvent<unknown>) => void,
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
