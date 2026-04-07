# ADR 0015 - PWA update handoff and multi-tab recovery

## Status

Accepted

## Context

IndexedDB is the only working system of record, and schema upgrades must survive open duplicate tabs without silently leaving the operator on stale code.

The repository already carried a 4000 millisecond update-handoff timeout in the PWA hook and a 5000 millisecond schema reload guard in the Dexie layer. Those controls were real, but the proof posture lagged behind the risk register. The app needed a clearer ownership boundary for `controllerchange`, a direct waiting-worker `SKIP_WAITING` message path that does not pretend vite-plugin-pwa will defer reload ownership for us, and a bounded retry when a tab blocks an immediate schema reload inside the guard window.

## Decision

OpsNormal will keep the Vite PWA plugin in prompt mode and will not switch to automatic update application.

The application will:

- send `SKIP_WAITING` directly to the waiting worker when the operator applies an update
- treat `controllerchange` as the decisive handoff event after an operator applies an update
- close the current Dexie handle before the `controllerchange` reload path runs
- keep stalled update guidance pinned until the operator reloads the affected tab
- close the stale Dexie connection immediately on `versionchange`
- return `false` from the custom Dexie `versionchange` handler, which transfers full responsibility for `db.close()` to the application layer
- block tight reload loops with the existing 5000 millisecond session-scoped guard
- schedule one bounded schema-reload retry after the guard window when an immediate reload is blocked
- prove the application-layer handoff in Chromium Playwright with a synthetic lifecycle drill rather than pretending the toolchain can deterministically force a real byte-diff worker replacement in CI

## Consequences

Positive:

- reduces the chance that a tab keeps running stale UI against a newer schema
- keeps recovery guidance visible during the most integrity-sensitive update failure mode
- replaces a critical manual release step with automated proof for the application-controlled portion of the lifecycle

Negative:

- adds small test-only hooks in e2e mode so Playwright can drive the synthetic handoff proof
- still does not claim that CI can fully emulate every browser-level service worker update edge case
- future storage refactors must preserve the explicit `versionchange` close path or risk origin-wide schema deadlock

## Guardrails

This decision does not authorize:

- switching the PWA registration mode to automatic update application
- weakening export or import integrity checks
- introducing cloud sync, telemetry, or backend recovery paths
- making claims about browser storage durability that the repository cannot prove
