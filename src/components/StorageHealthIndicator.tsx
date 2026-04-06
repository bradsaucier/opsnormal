import { formatStorageSummary, type StorageHealth } from '../lib/storage';

interface StorageHealthIndicatorProps {
  storageHealth: StorageHealth | null;
}

function getInstallStateLabel(storageHealth: StorageHealth): string {
  if (storageHealth.safari.standaloneMode) {
    return 'Installed path active';
  }

  return storageHealth.safari.installRecommended ? 'Browser tab - install recommended' : 'Browser tab';
}

function getPersistenceLabel(storageHealth: StorageHealth): string {
  if (storageHealth.persisted) {
    return 'Best-effort protection active';
  }

  if (storageHealth.safari.persistAttempted) {
    return 'Protection requested but not granted';
  }

  return 'Protection not requested yet';
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

export function StorageHealthIndicator({ storageHealth }: StorageHealthIndicatorProps) {
  const toneClasses =
    storageHealth?.status === 'warning'
      ? 'border-orange-400/35 bg-orange-400/10 text-orange-100'
      : storageHealth?.status === 'monitor'
        ? 'border-amber-400/25 bg-amber-400/8 text-amber-50'
        : 'border-ops-border-struct bg-ops-surface-1/75 text-ops-text-secondary';

  return (
    <div
      className={`rounded-xl border p-4 ${toneClasses}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-xs font-semibold tracking-[0.16em] uppercase text-ops-text-muted">
        Storage durability
      </p>
      <p className="mt-2 text-sm leading-6">
        {storageHealth?.message ?? 'Assessing local storage posture.'}
      </p>
      <p className="mt-2 text-xs leading-5 text-ops-text-muted">
        Your data stays on this device until you export it. Browser storage is not backup storage.
      </p>
      {storageHealth ? (
        <dl className="mt-3 grid gap-2 text-xs leading-5 text-ops-text-muted sm:grid-cols-2">
          <div>
            <dt className="font-semibold tracking-[0.12em] uppercase text-ops-text-secondary">
              Install path
            </dt>
            <dd className="mt-1">{getInstallStateLabel(storageHealth)}</dd>
          </div>
          <div>
            <dt className="font-semibold tracking-[0.12em] uppercase text-ops-text-secondary">
              Persistence
            </dt>
            <dd className="mt-1">{getPersistenceLabel(storageHealth)}</dd>
          </div>
          <div>
            <dt className="font-semibold tracking-[0.12em] uppercase text-ops-text-secondary">
              Reconnect state
            </dt>
            <dd className="mt-1">{getReconnectLabel(storageHealth)}</dd>
          </div>
          <div>
            <dt className="font-semibold tracking-[0.12em] uppercase text-ops-text-secondary">
              Write verify
            </dt>
            <dd className="mt-1">{getVerificationLabel(storageHealth)}</dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-3 text-xs tracking-[0.14em] uppercase text-ops-text-muted">
        {storageHealth ? formatStorageSummary(storageHealth) : 'Telemetry pending'}
      </p>
    </div>
  );
}
