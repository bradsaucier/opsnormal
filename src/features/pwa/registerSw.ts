import { useRegisterSW } from 'virtual:pwa-register/react';

// Architecture: ADR-0015 keeps service-worker registration on the prompt-mode path.
// Do not bypass this wrapper with an auto-apply flow that skips waiting-worker coordination.
export { useRegisterSW };
