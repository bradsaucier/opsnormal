import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isExtensionNoise,
  onCaughtError,
  onRecoverableError,
  onUncaughtError,
} from '../../src/lib/runtime';

describe('runtime helpers', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('identifies common extension-noise signatures', () => {
    expect(
      isExtensionNoise(new Error("Failed to execute 'removeChild' on 'Node'")),
    ).toBe(true);
    expect(
      isExtensionNoise(new Error("Failed to execute 'insertBefore' on 'Node'")),
    ).toBe(true);
    expect(
      isExtensionNoise(new Error('Hydration failed after extension mutation')),
    ).toBe(true);
    expect(isExtensionNoise(new Error('Deliberate application fault'))).toBe(
      false,
    );
    expect(isExtensionNoise('not-an-error')).toBe(false);
  });

  it('logs caught errors with the component stack', () => {
    const error = new Error('Caught boundary fault');
    const errorInfo = { componentStack: '\n    in BoundaryProbe' };

    onCaughtError(error, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpsNormal] Caught error:',
      error,
      errorInfo.componentStack,
    );
  });

  it('logs uncaught errors with the component stack', () => {
    const error = new Error('Uncaught shell fault');
    const errorInfo = { componentStack: '\n    in ShellProbe' };

    onUncaughtError(error, errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OpsNormal] Uncaught error:',
      error,
      errorInfo.componentStack,
    );
  });

  it('suppresses recoverable extension noise but reports real recoverable faults', () => {
    onRecoverableError(new Error('Extension injected a duplicate node'), {
      componentStack: '\n    in NoiseProbe',
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    const error = new Error('Recoverable render mismatch');
    const errorInfo = { componentStack: '\n    in RecoveryProbe' };

    onRecoverableError(error, errorInfo);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[OpsNormal] Recoverable error:',
      error,
      errorInfo.componentStack,
    );
  });
});
