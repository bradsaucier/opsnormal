import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useInstallPrompt } from '../../src/features/install/useInstallPrompt';

function InstallPromptProbe() {
  const { isIOS, isStandalone, canPromptInstall } = useInstallPrompt();

  return (
    <div>
      <span data-testid="ios">{String(isIOS)}</span>
      <span data-testid="standalone">{String(isStandalone)}</span>
      <span data-testid="promptable">{String(canPromptInstall)}</span>
    </div>
  );
}

describe('useInstallPrompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts cleanly when matchMedia is unavailable', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
    });

    render(<InstallPromptProbe />);

    expect(screen.getByTestId('ios')).toHaveTextContent('true');
    expect(screen.getByTestId('standalone')).toHaveTextContent('false');
    expect(screen.getByTestId('promptable')).toHaveTextContent('false');
  });
});
