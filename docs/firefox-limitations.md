# Firefox CI coverage boundary

OpsNormal treats the Playwright Firefox lane as a merge-blocking and release-blocking compatibility gate.
That gate is intentionally narrow.
It proves engine-level behavior on a Gecko implementation in CI.
It does not prove live Firefox storage-policy behavior on real hardware.

## What the Firefox gate is allowed to prove

1. the shell boots on a Gecko engine without CSP refusal events during normal startup
2. the non-WebKit storage-health path still renders in the shell
3. the core Dexie-backed check-in path persists across a page reload
4. service worker registration reaches an activated state on Firefox
5. the fallback Blob-download export path still works when `showSaveFilePicker` is unavailable

## What the Firefox gate is not allowed to prove

1. Firefox storage persistence policy or quota behavior on a real operating system profile
2. private-browsing persistence differences or profile-isolation behavior
3. live-device service-worker lifecycle behavior outside the narrow activation check
4. file-manager handoff behavior after the browser launches the fallback download on a real system

## Triage rule for Firefox smoke failures

1. If the failure shows shipped behavior is broken on Firefox, fix the product code before merge.
2. If the failure is test fragility, harden the test without widening the claim.
3. If the failure reflects a real platform boundary that the repository accepts, document the boundary here and in the affected test before merge.

## Manual verification remains required

Current Firefox release verification still belongs in the release checklist.
The CI gates strengthen enforcement.
They do not change the truth boundary.
