import { CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE } from './pwaUpdateConstants';

export interface PwaUpdateController {
  needRefresh: boolean;
  offlineReady: boolean;
  isApplyingUpdate: boolean;
  updateStalled: boolean;
  reloadRecoveryRequired: boolean;
  externalUpdateInProgress: boolean;
  externalUpdateStalled: boolean;
  handleApplyUpdate: () => void;
  handleDismissBanner: () => void;
  handleReloadPage: () => void;
}

export interface ControllerReloadState {
  count: number;
  lastAt: number | null;
}

export interface ControllerReloadRecoveryMessage {
  type: typeof CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE;
}

declare global {
  interface Window {
    __opsNormalPwaTestApi__?: {
      markUpdateReady: () => void;
      queueForegroundUpdateReady: () => void;
      getForegroundRevalidationCount: () => number;
      dispatchControllerChange: () => void;
    };
  }
}
