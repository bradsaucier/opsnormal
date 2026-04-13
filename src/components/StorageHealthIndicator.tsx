import { useEffect, useState } from 'react';

import { formatStorageSummary, type StorageHealth } from '../lib/storage';

import { NotchedFrame } from './NotchedFrame';

const MANUAL_RETRY_COOLDOWN_MS = 60 * 1000;
const actionButtonClasses =
  'ops-action-button clip-notched ops-notch-chip px-3 py-2 text-xs font-semibold tracking-[0.14em] uppercase';

interface StorageHealthIndicatorProps {
  storageHealth: StorageHealth | null;
  onRequestStorageProtection?: () => Promise<StorageHealth>;
  isRequestingStorageProtection?: boolean;
}

function getInstallStateLabel(storageHealth: StorageHealth): string {
  if (storageHealth.safari.standaloneMode) {
    return 'Installed path active';
  }

  return storageHealth.safari.installRecommended
    ? 'Browser tab - install recommended'
    : 'Browser tab';
}

function getPersistenceLabel(
  storageHealth: StorageHealth,
  hasRequestedDurableStorage: boolean,
): string {
  if (storageHealth.persisted) {
    return 'Best-effort protection active';
  }

  if (hasRequestedDurableStorage || storageHealth.safari.persistAttempted) {
    return 'Durable storage requested but not granted';
  }

  return 'Durable storage not requested yet';
}

function getReconnectLabel(storageHealth: StorageHealth): string {
  if (storageHealth.safari.reconnectState === 'failed') {
    return 'Reconnect failed';
  }

  if (storageHealth.safari.reconnectState === 'recovering') {
    return 'Recovery in progress';
  }

  if (storageHealth.safari.connectionDropsDetected > 0) {
    return `Recovered ${storageHealth.safari.reconnectSuccesses}/${storageHealth.safari.connectionDropsDetected}`;
  }

  return 'No connection drops detected';
}

function getVerificationLabel(storageHealth: StorageHealth): string {
  switch (storageHealth.safari.lastVerificationResult) {
    case 'verified':
      return 'Last write verified';
    case 'mismatch':
      return 'Last write mismatch detected';
    case 'failed':
      return 'Write verification failed';
    default:
      return 'No write verification recorded yet';
  }
}

function getDurabilityHelperText(storageHealth: StorageHealth): string {
  if (storageHealth.safari.installRecommended) {
    return 'Install to Home Screen, then request durable storage again. On iPhone and iPad, installation is the strongest protection path for local data.';
  }

  if (storageHealth.safari.standaloneMode && !storageHealth.persisted) {
    return 'Installed path active. The browser evaluates durability requests silently in the background based on app usage history.';
  }

  return 'Browser storage is strictly best-effort. Routine JSON export remains the only guaranteed backup.';
}

function getRequestButtonLabel(
  storageHealth: StorageHealth,
  isCoolingDown: boolean,
  hasRequestedDurableStorage: boolean,
): string {
  if (isCoolingDown) {
    return 'Request denied by browser';
  }

  if (hasRequestedDurableStorage || storageHealth.safari.persistAttempted) {
    return 'Retry durable storage request';
  }

  return 'Request durable storage';
}

function getToneClasses(storageHealth: StorageHealth | null): {
  outer: string;
  inner: string;
  text: string;
  muted: string;
  definition: string;
} {
  if (storageHealth?.status === 'warning') {
    return {
      outer:
        'bg-[linear-gradient(180deg,rgba(251,146,60,0.34),rgba(255,255,255,0.04))]',
      inner:
        'bg-[linear-gradient(180deg,rgba(249,115,22,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
      text: 'text-orange-100',
      muted: 'text-orange-100/78',
      definition: 'text-orange-50/88',
    };
  }

  if (storageHealth?.status === 'monitor') {
    return {
      outer:
        'bg-[linear-gradient(180deg,rgba(251,191,36,0.32),rgba(255,255,255,0.04))]',
      inner:
        'bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
      text: 'text-amber-50',
      muted: 'text-amber-100/76',
      definition: 'text-amber-50/88',
    };
  }

  return {
    outer: 'bg-ops-border-struct',
    inner:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%),var(--color-ops-surface-raised)]',
    text: 'text-ops-text-primary',
    muted: 'text-ops-text-muted',
    definition: 'text-ops-text-secondary',
  };
}

export function StorageHealthIndicator({
  storageHealth,
  onRequestStorageProtection,
  isRequestingStorageProtection = false,
}: StorageHealthIndicatorProps) {
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [hasManualRequestAttempted, setHasManualRequestAttempted] =
    useState(false);

  const effectiveCooldownUntilMs = storageHealth?.persisted
    ? null
    : cooldownUntilMs;
  const hasRequestedDurableStorage =
    hasManualRequestAttempted ||
    Boolean(storageHealth?.safari.persistAttempted);

  useEffect(() => {
    if (effectiveCooldownUntilMs === null) {
      return;
    }

    const remainingMs = effectiveCooldownUntilMs - currentTimeMs;

    if (remainingMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(Date.now());
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentTimeMs, effectiveCooldownUntilMs]);

  const isCoolingDown =
    effectiveCooldownUntilMs !== null &&
    effectiveCooldownUntilMs > currentTimeMs;
  const canRequestStorageProtection = Boolean(
    storageHealth &&
    !storageHealth.persisted &&
    storageHealth.persistenceAvailable &&
    onRequestStorageProtection,
  );
  const toneClasses = getToneClasses(storageHealth);

  async function handleRequestStorageProtection() {
    if (
      !canRequestStorageProtection ||
      !onRequestStorageProtection ||
      isRequestingStorageProtection ||
      isCoolingDown
    ) {
      return;
    }

    const nextHealth = await onRequestStorageProtection();

    if (!nextHealth.persisted) {
      const nextCooldownStartMs = Date.now();
      setHasManualRequestAttempted(true);
      setCurrentTimeMs(nextCooldownStartMs);
      setCooldownUntilMs(nextCooldownStartMs + MANUAL_RETRY_COOLDOWN_MS);
    }
  }

  return (
    <NotchedFrame
      outerClassName={toneClasses.outer}
      innerClassName={`p-4 ${toneClasses.inner}`}
    >
      <div role="status" aria-live="polite" aria-atomic="true">
        <p
          className={`text-xs font-semibold tracking-[0.16em] uppercase ${toneClasses.muted}`}
        >
          Storage durability
        </p>
        <p className={`mt-2 text-sm leading-6 ${toneClasses.text}`}>
          {storageHealth?.message ?? 'Assessing local storage posture.'}
        </p>
        <p className={`mt-2 text-xs leading-5 ${toneClasses.muted}`}>
          {storageHealth
            ? getDurabilityHelperText(storageHealth)
            : 'Browser storage is strictly best-effort. Routine JSON export remains the only guaranteed backup.'}
        </p>
        {canRequestStorageProtection && storageHealth ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                void handleRequestStorageProtection();
              }}
              disabled={isRequestingStorageProtection || isCoolingDown}
              className={`${actionButtonClasses} ops-action-button-success`}
            >
              {isRequestingStorageProtection
                ? 'Requesting durable storage'
                : getRequestButtonLabel(
                    storageHealth,
                    isCoolingDown,
                    hasRequestedDurableStorage,
                  )}
            </button>
          </div>
        ) : null}
        {storageHealth ? (
          <dl
            className={`mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2 ${toneClasses.definition}`}
          >
            <div>
              <dt className="font-semibold tracking-[0.12em] uppercase">
                Install path
              </dt>
              <dd className="mt-1">{getInstallStateLabel(storageHealth)}</dd>
            </div>
            <div>
              <dt className="font-semibold tracking-[0.12em] uppercase">
                Persistence
              </dt>
              <dd className="mt-1">
                {getPersistenceLabel(storageHealth, hasRequestedDurableStorage)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold tracking-[0.12em] uppercase">
                Reconnect state
              </dt>
              <dd className="mt-1">{getReconnectLabel(storageHealth)}</dd>
            </div>
            <div>
              <dt className="font-semibold tracking-[0.12em] uppercase">
                Write verify
              </dt>
              <dd className="mt-1">{getVerificationLabel(storageHealth)}</dd>
            </div>
          </dl>
        ) : null}
        <p
          className={`mt-3 text-xs tracking-[0.14em] uppercase ${toneClasses.muted}`}
        >
          {storageHealth
            ? formatStorageSummary(storageHealth)
            : 'Telemetry pending'}
        </p>
      </div>
    </NotchedFrame>
  );
}
