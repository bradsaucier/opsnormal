# ADR 0015 - PWA update handoff and multi-tab recovery

## Status

Accepted

## Context

IndexedDB is the only working system of record, and schema upgrades must survive open duplicate tabs without silently leaving the operator on stale code.

The repository already carried a 4000 millisecond update-handoff timeout in the PWA hook and a 5000 millisecond schema reload guard in the Dexie layer. Those controls were real, but the proof posture lagged behind the risk register. The app needed a clearer ownership boundary for `controllerchange`, a direct waiting-worker `SKIP_WAITING` message path that does not pretend vite-plugin-pwa will defer reload ownership for us, and a bounded retry when a tab blocks an immediate schema reload inside the guard window.

The repository also needed explicit containment for repeat `controllerchange` churn in one tab, a way to keep background tabs from staying pinned after another tab starts the manual recovery path, and a clearer phase model so the banner logic stops treating multi-tab update control as a loose bag of booleans.

## Decision

OpsNormal will keep the Vite PWA plugin in prompt mode and will not switch to automatic update application.

The application architecture deliberately bypasses the vite-plugin-pwa provided `updateServiceWorker()` trigger. That helper is documented as a reload path and its `reloadPage` argument is no longer used. OpsNormal must keep explicit ownership of the `SKIP_WAITING` message and the subsequent `controllerchange` teardown so Dexie can close before the forced reload path runs.

The application will:

- send `SKIP_WAITING` directly to the waiting worker when the operator applies an update
- surface an already-waiting worker as soon as the registration becomes available instead of waiting for a later interval tick
- revalidate the registration when the tab returns to the foreground or connectivity resumes so stale code is less likely to stay pinned silently
- re-acquire the active service-worker registration before foreground revalidation or update apply so the hook does not rely solely on the original `onRegisteredSW` callback object
- throttle foreground-triggered revalidation to one check per 60 seconds so repeated focus or visibility churn does not spam update requests
- evaluate the offline guard before consuming the next foreground revalidation window so an offline focus event does not block the first reconnect check
- suppress repeat foreground surfacing for the same waiting worker after an operator dismisses the banner in the same session until the next forced revalidation window
- coordinate update-handoff state across tabs through a same-origin `BroadcastChannel` so only one tab owns the apply path while the others surface pinned guidance instead of racing the handoff
- attach a bounded dead-man's switch to duplicate-tab handoff state so a background tab clears stale external ownership after the primary handoff timeout window plus buffer and then re-checks the live registration
- derive banner behavior from an explicit update-phase model that distinguishes local apply, local stall, duplicate-tab apply, duplicate-tab stall, and loop-breaker recovery states
- treat `controllerchange` as the decisive handoff event after an operator applies an update
- close the current Dexie handle before the `controllerchange` reload path runs
- insert a short reload buffer after the close request so the forced navigation does not fire in the same execution turn as the handoff close
- keep stalled update guidance pinned until the operator reloads the affected tab
- close the stale Dexie connection immediately on `versionchange`
- return `false` from the custom Dexie `versionchange` handler, which transfers full responsibility for `db.close()` to the application layer
- block tight reload loops with the existing 5000 millisecond session-scoped guard
- pin a manual recovery banner when the same tab records repeated automatic controllerchange reloads inside a short session window
- announce the recovery state through a persistent alert region that mutates after mount so screen readers receive the recovery instruction after a hard reload
- broadcast a same-origin manual-recovery clear signal so other open tabs can clear stale loop-breaker state when one tab starts the recovery reload
- schedule one bounded schema-reload retry after the guard window when an immediate reload is blocked
- prove the application-layer handoff in Chromium Playwright with a synthetic lifecycle drill rather than pretending the toolchain can deterministically force a real byte-diff worker replacement in CI

## Consequences

Positive:

- reduces the chance that a tab keeps running stale UI against a newer schema
- keeps recovery guidance visible during the most integrity-sensitive update failure mode
- keeps duplicate tabs from staying pinned on stale loop-breaker state after another tab starts manual recovery
- gives non-owning tabs a deterministic update posture while another tab drives the handoff or stalls it
- clears stale duplicate-tab ownership if the primary tab crashes, suspends, or disappears before it can broadcast completion
- reduces dependence on `workbox-window` event delivery by re-checking the live registration object during revalidation and apply
- replaces a critical manual release step with automated proof for the application-controlled portion of the lifecycle

Negative:

- adds small test-only hooks in e2e mode so Playwright can drive the synthetic handoff proof
- still does not claim that CI can fully emulate every browser-level service worker update edge case
- accepts one more operator-visible recovery branch so repeat controllerchange churn fails closed instead of reloading indefinitely
- relies on `BroadcastChannel` support for the best duplicate-tab cleanup path; tabs in environments without that primitive may still require manual reload
- future storage refactors must preserve the explicit `versionchange` close path or risk origin-wide schema deadlock
- future PWA changes must preserve the update-phase model and the duplicate-tab coordination channel or the banner may regress back into race-prone boolean drift

## Guardrails

This decision does not authorize:

- switching the manual `SKIP_WAITING` handoff to `updateServiceWorker()` or any other helper that owns page reload timing
- switching the PWA registration mode to automatic update application
- weakening export or import integrity checks
- introducing cloud sync, telemetry, or backend recovery paths
- making claims about browser storage durability that the repository cannot prove
