import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InstallBanner } from '../../src/features/install/InstallBanner';
import { useInstallPrompt } from '../../src/features/install/useInstallPrompt';

vi.mock('../../src/features/install/useInstallPrompt', () => ({
  useInstallPrompt: vi.fn()
}));

type InstallPromptState = ReturnType<typeof useInstallPrompt>;

const mockUseInstallPrompt = vi.mocked(useInstallPrompt);

function buildHookState(overrides: Partial<InstallPromptState> = {}): InstallPromptState {
  return {
    isIOS: false,
    isStandalone: false,
    canPromptInstall: false,
    promptInstall: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('InstallBanner', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not render when the app is already installed', () => {
    mockUseInstallPrompt.mockReturnValue(buildHookState({ isStandalone: true }));

    render(<InstallBanner />);

    expect(screen.queryByText('Install the app')).not.toBeInTheDocument();
  });

  it('renders the banner shell even when browser-driven install prompting is unavailable', () => {
    mockUseInstallPrompt.mockReturnValue(buildHookState());

    render(<InstallBanner />);

    expect(screen.getByText('Install the app')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders iPhone and iPad install instructions when the device is iOS', () => {
    mockUseInstallPrompt.mockReturnValue(buildHookState({ isIOS: true }));

    render(<InstallBanner />);

    expect(screen.getByText('Open this page in Safari.')).toBeInTheDocument();
    expect(screen.getByText('Press Share.')).toBeInTheDocument();
    expect(screen.getByText('Select Install or Add to Home Screen.')).toBeInTheDocument();
  });

  it('calls promptInstall when the operator presses Install now', async () => {
    const user = userEvent.setup();
    const promptInstall = vi.fn().mockResolvedValue(undefined);

    mockUseInstallPrompt.mockReturnValue(
      buildHookState({ canPromptInstall: true, promptInstall })
    );

    render(<InstallBanner />);
    await user.click(screen.getByRole('button', { name: 'Install now' }));

    expect(promptInstall).toHaveBeenCalledTimes(1);
  });

  it('hides itself after dismissal without mutating hook state', async () => {
    const user = userEvent.setup();

    mockUseInstallPrompt.mockReturnValue(buildHookState({ canPromptInstall: true }));

    render(<InstallBanner />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(window.localStorage.getItem('opsnormal-install-banner-dismissed')).toBe('true');
    expect(screen.queryByText('Install the app')).not.toBeInTheDocument();
  });

  it('stays dismissed across remounts until the installed path is active', () => {
    window.localStorage.setItem('opsnormal-install-banner-dismissed', 'true');

    mockUseInstallPrompt.mockReturnValue(buildHookState());

    const { rerender } = render(<InstallBanner />);

    expect(screen.queryByText('Install the app')).not.toBeInTheDocument();

    mockUseInstallPrompt.mockReturnValue(buildHookState({ isStandalone: true }));
    rerender(<InstallBanner />);

    expect(window.localStorage.getItem('opsnormal-install-banner-dismissed')).toBeNull();
  });
});
