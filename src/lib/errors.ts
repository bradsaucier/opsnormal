import type { ErrorInfo } from 'react';

export interface ErrorInfoLike {
  componentStack?: string;
  errorBoundary?: unknown;
}

const RECOVERABLE_EXTENSION_MARKERS = ['cz-shortcut-listen'];

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function reportRuntimeError(
  scope: string,
  error: unknown,
  errorInfo?: ErrorInfo | ErrorInfoLike
): void {
  const stack = errorInfo?.componentStack?.trim();

  if (stack) {
    console.error(`[OpsNormal] ${scope}`, error, stack);
    return;
  }

  console.error(`[OpsNormal] ${scope}`, error);
}

export function shouldSuppressRecoverableError(
  error: unknown,
  errorInfo?: ErrorInfo | ErrorInfoLike
): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const stack = errorInfo?.componentStack ?? '';
  const haystack = `${message}\n${stack}`.toLowerCase();

  return RECOVERABLE_EXTENSION_MARKERS.some((marker) => haystack.includes(marker));
}
