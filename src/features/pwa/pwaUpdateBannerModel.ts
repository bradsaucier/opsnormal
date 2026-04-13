export type PwaUpdateBannerMode =
  | 'hidden'
  | 'offline-ready'
  | 'update-ready'
  | 'applying'
  | 'stalled'
  | 'reload-recovery'
  | 'external-applying'
  | 'external-stalled';

export interface PwaUpdateBannerDerivationInput {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  reloadRecoveryRequired: boolean;
  externalUpdateInProgress: boolean;
  externalUpdateStalled: boolean;
}

export interface PwaUpdateBannerViewModel {
  mode: PwaUpdateBannerMode;
  isBannerActive: boolean;
  heading: string;
  primaryMessage: string;
  recoveryMessage: string | null;
  showApplyButton: boolean;
  applyButtonLabel: string;
  showReloadButton: boolean;
  showDismissButton: boolean;
  statusAnnouncement: string;
  recoveryAnnouncement: string;
}

const LOOP_RECOVERY_ANNOUNCEMENT =
  'Update loop intercepted. Close other OpsNormal tabs, then reload this tab to complete recovery.';
const EXTERNAL_STALL_ANNOUNCEMENT =
  'Another OpsNormal tab started an update handoff, but this tab did not receive the new worker. Close the other tabs, then reload here.';

export function derivePwaUpdateBannerViewModel(
  input: PwaUpdateBannerDerivationInput,
): PwaUpdateBannerViewModel {
  const mode = resolveBannerMode(input);

  switch (mode) {
    case 'offline-ready':
      return {
        mode,
        isBannerActive: true,
        heading: 'Offline Ready',
        primaryMessage:
          'The service worker is active. OpsNormal can now reopen offline after first load.',
        recoveryMessage: null,
        showApplyButton: false,
        applyButtonLabel: 'Apply update',
        showReloadButton: false,
        showDismissButton: true,
        statusAnnouncement:
          'Offline Ready. The service worker is active. OpsNormal can now reopen offline after first load.',
        recoveryAnnouncement: '',
      };
    case 'update-ready':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update Ready',
        primaryMessage:
          'A newer build is available. Apply the update to hand control to the waiting service worker.',
        recoveryMessage: null,
        showApplyButton: true,
        applyButtonLabel: 'Apply update',
        showReloadButton: false,
        showDismissButton: true,
        statusAnnouncement:
          'Update Ready. A newer build is available. Apply the update to hand control to the waiting service worker.',
        recoveryAnnouncement: '',
      };
    case 'applying':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update Ready',
        primaryMessage:
          'A newer build is available. Apply the update to hand control to the waiting service worker.',
        recoveryMessage: null,
        showApplyButton: true,
        applyButtonLabel: 'Applying',
        showReloadButton: false,
        showDismissButton: false,
        statusAnnouncement:
          'Update Ready. A newer build is available. Apply the update to hand control to the waiting service worker.',
        recoveryAnnouncement: '',
      };
    case 'stalled':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update Ready',
        primaryMessage:
          'A newer build is available. Apply the update to hand control to the waiting service worker.',
        recoveryMessage:
          'Update handoff did not complete. Another OpsNormal tab may still be holding the active worker. Close the other OpsNormal tabs, then reload this tab and apply the update again.',
        showApplyButton: true,
        applyButtonLabel: 'Apply update',
        showReloadButton: true,
        showDismissButton: false,
        statusAnnouncement:
          'Update Ready. A newer build is available. Apply the update to hand control to the waiting service worker. Update handoff did not complete. Another OpsNormal tab may still be holding the active worker. Close the other OpsNormal tabs, then reload this tab and apply the update again.',
        recoveryAnnouncement: '',
      };
    case 'reload-recovery':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update Recovery Required',
        primaryMessage: LOOP_RECOVERY_ANNOUNCEMENT,
        recoveryMessage:
          'If this happened during local testing, disable Chrome DevTools Update on reload before another handoff drill.',
        showApplyButton: false,
        applyButtonLabel: 'Apply update',
        showReloadButton: true,
        showDismissButton: false,
        statusAnnouncement: '',
        recoveryAnnouncement: LOOP_RECOVERY_ANNOUNCEMENT,
      };
    case 'external-applying':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update In Progress',
        primaryMessage:
          'Another OpsNormal tab initiated the update handoff. This tab will reload when the new worker takes control.',
        recoveryMessage:
          'Keep one tab driving the handoff. If the update stalls, close the other OpsNormal tabs and reload here.',
        showApplyButton: false,
        applyButtonLabel: 'Apply update',
        showReloadButton: false,
        showDismissButton: false,
        statusAnnouncement:
          'Update In Progress. Another OpsNormal tab initiated the update handoff. This tab will reload when the new worker takes control. Keep one tab driving the handoff. If the update stalls, close the other OpsNormal tabs and reload here.',
        recoveryAnnouncement: '',
      };
    case 'external-stalled':
      return {
        mode,
        isBannerActive: true,
        heading: 'Update Recovery Required',
        primaryMessage:
          'Another OpsNormal tab started an update handoff, but this tab has not received the new worker.',
        recoveryMessage:
          'Close the other OpsNormal tabs, then reload this tab to recover and re-check for the waiting worker.',
        showApplyButton: false,
        applyButtonLabel: 'Apply update',
        showReloadButton: true,
        showDismissButton: false,
        statusAnnouncement: '',
        recoveryAnnouncement: EXTERNAL_STALL_ANNOUNCEMENT,
      };
    case 'hidden':
    default:
      return {
        mode: 'hidden',
        isBannerActive: false,
        heading: '',
        primaryMessage: '',
        recoveryMessage: null,
        showApplyButton: false,
        applyButtonLabel: 'Apply update',
        showReloadButton: false,
        showDismissButton: false,
        statusAnnouncement: '',
        recoveryAnnouncement: '',
      };
  }
}

function resolveBannerMode(
  input: PwaUpdateBannerDerivationInput,
): PwaUpdateBannerMode {
  if (input.reloadRecoveryRequired) {
    return 'reload-recovery';
  }

  if (input.updateStalled && input.needRefresh) {
    return 'stalled';
  }

  if (input.externalUpdateStalled) {
    return 'external-stalled';
  }

  if (input.externalUpdateInProgress) {
    return 'external-applying';
  }

  if (input.needRefresh && input.isApplyingUpdate) {
    return 'applying';
  }

  if (input.needRefresh) {
    return 'update-ready';
  }

  if (input.offlineReady) {
    return 'offline-ready';
  }

  return 'hidden';
}
