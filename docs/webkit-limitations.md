# WebKit CI coverage boundary

OpsNormal treats the Playwright WebKit lane as a merge-blocking compatibility gate.
That gate is intentionally narrow.
It proves engine-level behavior on a WebKit implementation in CI.
It does not prove Safari storage policy behavior on Apple hardware.

## What the WebKit gate is allowed to prove

1. the shell boots on a WebKit engine
2. Apple WebKit storage-risk messaging still renders in the shell
3. the core Dexie-backed check-in path persists across a page reload
4. a fresh recorded backup suppresses the Safari-tab backup banner

## What the WebKit gate is not allowed to prove

1. Safari's seven-day inactivity purge for script-writable storage
2. Storage API persistence grant heuristics on Apple platforms
3. installed Home Screen app behavior on iPhone or iPad, or Add to Dock behavior on macOS Safari
4. real-device storage pressure, quota eviction, or Safari-only connection-loss faults

## Triage rule for WebKit smoke failures

1. If the failure shows shipped behavior is broken on WebKit, fix the product code before merge.
2. If the failure is test fragility, harden the test without widening the claim.
3. If the failure reflects a real platform boundary that the repository accepts, document the boundary here and in the affected test before merge.

## Manual verification remains required

Real Safari and installed-PWA verification on Apple hardware still belongs in the release checklist.
The CI gate strengthens enforcement.
It does not change the truth boundary.
