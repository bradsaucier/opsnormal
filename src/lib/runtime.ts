import type { ErrorInfo } from 'react';

const EXTENSION_NOISE_PATTERNS: RegExp[] = [
  /failed to execute 'removeChild' on 'Node'/i,
  /failed to execute 'insertBefore' on 'Node'/i,
  /can't access dead object/i,
  /hydrat/i,
  /extension/i
];

export function reloadCurrentPage(): void {
  window.location.reload();
}

export function isExtensionNoise(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return EXTENSION_NOISE_PATTERNS.some((pattern) => pattern.test(error.message));
}

export function onCaughtError(error: Error, errorInfo: ErrorInfo): void {
  console.error('[OpsNormal] Caught error:', error, errorInfo.componentStack);
}

export function onUncaughtError(error: Error, errorInfo: ErrorInfo): void {
  console.error('[OpsNormal] Uncaught error:', error, errorInfo.componentStack);
}

export function onRecoverableError(error: unknown, errorInfo: ErrorInfo): void {
  if (isExtensionNoise(error)) {
    return;
  }

  console.warn('[OpsNormal] Recoverable error:', error, errorInfo.componentStack);
}
