## Status

Accepted
Amends ADR-0019.

## Context

ADR-0019 established the truthful storage-lifecycle test boundary.
It split proof across unit logic, Chromium harness injection, and a narrow WebKit smoke lane.
That decision kept the WebKit lane non-gating while the suite matured.

The repository now has a deliberately small WebKit surface.
The lane is limited to boot, storage-warning rendering, fresh-backup suppression, and IndexedDB persistence across reload.
Those checks validate engine-level compatibility on WebKit without claiming to simulate Safari's seven-day purge, persistence heuristics, or installed-app behavior on Apple hardware.

Keeping the lane advisory after that narrowing leaves a gap between repository policy and enforcement.
A failing WebKit smoke result signals a real cross-engine regression in shipped code or a test boundary that must be documented explicitly.
That signal should block merge until it is resolved or the boundary is recorded plainly.

## Decision

Promote the narrow Playwright WebKit smoke lane from advisory to merge-blocking CI coverage.

This promotion does not widen what the lane claims to prove.
The lane remains restricted to engine-level compatibility evidence:

1. app boot on a WebKit engine
2. operator-facing Apple WebKit warning rendering
3. IndexedDB persistence across reload for the core check-in path
4. fresh-backup suppression behavior for the shell-level Safari-tab prompt

This promotion does not authorize stronger claims about Safari policy behavior.
Real Safari and installed-PWA storage lifecycle verification on Apple hardware remains in the manual release lane.
Documentation must continue to state that WebKit CI coverage is not a browser-policy oracle.

## Consequences

Positive:

- makes the existing WebKit signal enforceable during pull-request review
- catches cross-engine regressions before merge instead of after release
- preserves a truthful distinction between WebKit engine proof and Safari policy proof

Trade-offs:

- Playwright or runner regressions in the WebKit lane can now block merges
- contributors without local WebKit access may rely on CI to validate the lane
- any accepted platform boundary must be documented clearly so the gate does not drift into silent exception handling
