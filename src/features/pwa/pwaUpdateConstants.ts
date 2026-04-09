export const UPDATE_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;
export const UPDATE_HANDOFF_TIMEOUT_MS = 4000;
export const CONTROLLER_RELOAD_WINDOW_MS = 15 * 1000;
export const FOREGROUND_REVALIDATION_THROTTLE_MS = 60 * 1000;
export const CONTROLLER_RELOAD_COUNT_KEY = 'opsnormal-sw-controller-reload-count';
export const CONTROLLER_RELOAD_LAST_AT_KEY = 'opsnormal-sw-controller-reload-last-at';
export const CONTROLLER_RELOAD_MAX_AUTOMATIC_RELOADS = 2;
export const CONTROLLER_RELOAD_RECOVERY_CHANNEL_NAME = 'opsnormal-pwa-update-recovery';
export const CONTROLLER_RELOAD_RECOVERY_CLEAR_MESSAGE = 'controller-reload-recovery-cleared';
// Best-effort separation from the Dexie close request before forcing navigation.
// This delay reduces same-turn reload churn but is not a formal ordering guarantee.
export const CONTROLLER_RELOAD_DELAY_MS = 50;
