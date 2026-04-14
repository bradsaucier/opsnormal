import { useEffect, useState } from 'react';

import { formatStorageSummary, type StorageHealth } from '../lib/storage';

import { AlertSurface } from './AlertSurface';
import {
  getAlertSurfaceActionToneClass,
  getAlertSurfaceTonePalette,
  type AlertSurfaceTone,
} from './alertSurfaceTone';

const MANUAL_RETRY_COOLDOWN_MS = 60 * 1000;

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

function getStorageHealthTone(
  storageHealth: StorageHealth | null,
): AlertSurfaceTone {
  if (storageHealth?.status === 'warning') {
    return 'warning';
  }

  if (storageHealth?.status === 'monitor') {
    return 'attention';
  }

  return 'neutral';
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
  const tone = getStorageHealthTone(storageHealth);
  const tonePalette = getAlertSurfaceTonePalette(tone);

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
    <AlertSurface
      tone={tone}
      title="Storage durability"
      description={storageHealth?.message ?? 'Assessing local storage posture.'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-3">
        <p className={`text-xs leading-5 ${tonePalette.subduedClassName}`}>
          {storageHealth
            ? getDurabilityHelperText(storageHealth)
            : 'Browser storage is strictly best-effort. Routine JSON export remains the only guaranteed backup.'}
        </p>
        {canRequestStorageProtection && storageHealth ? (
          <div>
            <button
              type="button"
              onClick={() => {
                void handleRequestStorageProtection();
              }}
              disabled={isRequestingStorageProtection || isCoolingDown}
              className={getAlertSurfaceActionToneClass(tone)}
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
            className={`grid gap-2 text-xs leading-5 sm:grid-cols-2 ${tonePalette.definitionClassName}`}
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
          className={`text-xs tracking-[0.16em] uppercase ${tonePalette.subduedClassName}`}
        >
          {storageHealth
            ? formatStorageSummary(storageHealth)
            : 'Telemetry pending'}
        </p>
      </div>
    </AlertSurface>
  );
}
