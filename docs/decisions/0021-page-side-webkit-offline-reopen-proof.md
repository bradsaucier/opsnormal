## Status
Accepted
Amends ADR-0020.

## Context

ADR-0020 made the narrow WebKit smoke lane merge-blocking.
That gate proved boot, Safari-family warning rendering, IndexedDB persistence across reload, and fresh-backup suppression.
The remaining gap was offline reopen.
OpsNormal claims the shell can reopen offline after first load, but the WebKit gate did not yet prove that claim on a WebKit engine.

A naive implementation would use Playwright's service-worker inspection APIs.
That would be incorrect for this lane because those APIs are Chromium-only.
The truthful boundary on WebKit is page-side proof through `navigator.serviceWorker` plus an offline reopen in a fresh page after the page is already controlled by the active worker.
That approach proves shipped browser behavior without implying Safari-policy simulation on Apple hardware.

## Decision

Extend the merge-blocking WebKit smoke lane to prove page-side service-worker readiness and offline reopen after the first controlled load.

The WebKit lane is now allowed to prove:
1. app boot on a WebKit engine
2. Safari-family storage-risk messaging in the shell
3. IndexedDB persistence across reload for the core check-in path
4. fresh-backup suppression for the shell-level Safari-tab prompt
5. offline reopen after first load by waiting for a page-side active registration, reloading under service-worker control, then reopening offline in a fresh page within the same browser context

This decision does not authorize Chromium-only Playwright service-worker instrumentation in the WebKit lane.
It also does not authorize claims about Safari's seven-day purge, Apple persistence heuristics, installed Home Screen behavior, or device-level storage pressure.
Those remain outside the CI proof boundary.

## Consequences

Positive:
- closes the largest remaining gap between the repository's offline-open claim and the merge-blocking WebKit gate
- keeps WebKit proof tied to shipped page behavior instead of Chromium-only harness APIs
- strengthens confidence that the cached shell can recover on a WebKit engine after the first controlled load

Trade-offs:
- adds another asynchronous service-worker checkpoint to the most failure-prone browser lane in CI
- requires the test to distinguish active registration from page control before switching the context offline
- still leaves Safari policy behavior and installed-PWA storage lifecycle verification in the manual release lane
