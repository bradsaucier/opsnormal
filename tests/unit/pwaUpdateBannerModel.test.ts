import { describe, expect, it } from 'vitest';

import {
  derivePwaUpdateBannerViewModel,
  type PwaUpdateBannerDerivationInput,
  type PwaUpdateBannerMode,
} from '../../src/features/pwa/pwaUpdateBannerModel';

function buildInput(
  overrides: Partial<PwaUpdateBannerDerivationInput> = {},
): PwaUpdateBannerDerivationInput {
  return {
    needRefresh: false,
    offlineReady: false,
    isApplyingUpdate: false,
    updateStalled: false,
    reloadRecoveryRequired: false,
    externalUpdateInProgress: false,
    externalUpdateStalled: false,
    ...overrides,
  };
}

describe('derivePwaUpdateBannerViewModel', () => {
  it.each<
    [string, Partial<PwaUpdateBannerDerivationInput>, PwaUpdateBannerMode]
  >([
    ['hidden when no banner state is active', {}, 'hidden'],
    [
      'offline ready when only the service worker is ready',
      { offlineReady: true },
      'offline-ready',
    ],
    [
      'update ready when a waiting worker is present',
      { needRefresh: true },
      'update-ready',
    ],
    [
      'applying when the handoff is in progress',
      { needRefresh: true, isApplyingUpdate: true },
      'applying',
    ],
    [
      'stalled when the local handoff times out',
      { needRefresh: true, updateStalled: true },
      'stalled',
    ],
    [
      'reload recovery when a reload loop was intercepted',
      { reloadRecoveryRequired: true },
      'reload-recovery',
    ],
    [
      'external applying when another tab owns the handoff',
      { externalUpdateInProgress: true },
      'external-applying',
    ],
    [
      'external stalled when another tab failed to complete the handoff',
      { externalUpdateStalled: true },
      'external-stalled',
    ],
  ])('returns %s', (_label, overrides, expectedMode) => {
    const viewModel = derivePwaUpdateBannerViewModel(buildInput(overrides));

    expect(viewModel.mode).toBe(expectedMode);
  });

  it('prioritizes local stalled recovery over external stalled messaging', () => {
    const viewModel = derivePwaUpdateBannerViewModel(
      buildInput({
        needRefresh: true,
        updateStalled: true,
        externalUpdateStalled: true,
      }),
    );

    expect(viewModel.mode).toBe('stalled');
    expect(viewModel.recoveryMessage).toMatch(
      /update handoff did not complete/i,
    );
  });

  it('prioritizes reload recovery over every other banner state', () => {
    const viewModel = derivePwaUpdateBannerViewModel(
      buildInput({
        needRefresh: true,
        offlineReady: true,
        isApplyingUpdate: true,
        updateStalled: true,
        reloadRecoveryRequired: true,
        externalUpdateInProgress: true,
        externalUpdateStalled: true,
      }),
    );

    expect(viewModel.mode).toBe('reload-recovery');
  });

  it('pins the banner during apply so the stall path cannot be dismissed', () => {
    const viewModel = derivePwaUpdateBannerViewModel(
      buildInput({
        needRefresh: true,
        isApplyingUpdate: true,
      }),
    );

    expect(viewModel.mode).toBe('applying');
    expect(viewModel.showDismissButton).toBe(false);
    expect(viewModel.showApplyButton).toBe(true);
    expect(viewModel.applyButtonLabel).toBe('Applying');
  });
});
