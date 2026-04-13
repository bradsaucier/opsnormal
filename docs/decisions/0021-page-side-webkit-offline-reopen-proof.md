# Status
Accepted
Amends ADR-0020.

## Context

ADR-0020 made the narrow WebKit smoke lane merge-blocking.
That gate proved boot, Safari-family warning rendering, IndexedDB persistence across reload, and fresh-backup suppression.
The remaining desired gap was automated offline reopen on a WebKit engine.

A naive implementation would use Playwright's service-worker inspection APIs.
That would be incorrect for this lane because those APIs are Chromium-only.
A second naive implementation would drive an offline `page.reload()` or offline `page.goto('/')` after the page is already controlled by the active worker.
That also proved unsuitable for this gate because the Linux WebKit engine used by Playwright CI can fail with internal browser errors on that offline navigation path even when the product code is sound.

The truthful boundary on WebKit is therefore page-side proof through `navigator.serviceWorker`, page control through `navigator.serviceWorker.controller`, and offline retrieval of the shipped shell asset from the already controlled document.
That approach proves shipped browser behavior without implying Safari-policy simulation on Apple hardware and without depending on a known-fragile offline navigation path in CI WebKit.

## Decision

Extend the merge-blocking WebKit smoke lane to prove page-side service-worker readiness and offline shell retrieval after the first controlled load.

The WebKit lane is now allowed to prove:
1. app boot on a WebKit engine
2. Safari-family storage-risk messaging in the shell
3. IndexedDB persistence across reload for the core check-in path
4. fresh-backup suppression for the shell-level Safari-tab prompt
5. after a page-side active registration is observed and the page reloads under service-worker control, the already controlled document can retrieve the shipped shell asset offline and preserve IndexedDB-backed UI state

This decision does not authorize Chromium-only Playwright service-worker instrumentation in the WebKit lane.
It also does not authorize claims about Safari's seven-day purge, Apple persistence heuristics, installed Home Screen behavior, or device-level storage pressure.
Cold-start offline reopen remains a manual release check on physical Apple hardware.

## Consequences

Positive:
- removes the CI-fatal offline navigation edge from the most failure-prone browser lane
- keeps WebKit proof tied to shipped page behavior instead of Chromium-only harness APIs
- still proves that a controlled WebKit page can retrieve the shipped shell offline and preserve IndexedDB-backed state

Trade-offs:
- stops short of claiming automated cold-start offline reopen on CI WebKit
- keeps physical Safari and installed-PWA reopen behavior in the manual release lane
- requires the repository docs to state the narrower proof boundary precisely
