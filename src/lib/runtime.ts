const EXTENSION_NOISE_PATTERNS: RegExp[] = [
  /failed to execute 'removeChild' on 'Node'/i,
  /failed to execute 'insertBefore' on 'Node'/i,
  /can't access dead object/i,
  /hydrat/i,
  /extension/i,
];

export function reloadCurrentPage(): void {
  window.location.reload();
}

export function isExtensionNoise(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return EXTENSION_NOISE_PATTERNS.some((pattern) =>
    pattern.test(error.message),
  );
}

function getComponentStack(errorInfo: {
  componentStack?: string | undefined;
}): string | undefined {
  return errorInfo.componentStack;
}

export function onCaughtError(
  error: unknown,
  errorInfo: { componentStack?: string | undefined; errorBoundary?: unknown },
): void {
  console.error(
    '[OpsNormal] Caught error:',
    error,
    getComponentStack(errorInfo),
  );
}

export function onUncaughtError(
  error: unknown,
  errorInfo: { componentStack?: string | undefined },
): void {
  console.error(
    '[OpsNormal] Uncaught error:',
    error,
    getComponentStack(errorInfo),
  );
}

export function onRecoverableError(
  error: unknown,
  errorInfo: { componentStack?: string | undefined },
): void {
  if (isExtensionNoise(error)) {
    return;
  }

  console.warn(
    '[OpsNormal] Recoverable error:',
    error,
    getComponentStack(errorInfo),
  );
}
