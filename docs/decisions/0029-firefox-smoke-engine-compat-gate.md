## Status

Accepted
Amends ADR-0020 and ADR-0021.

## Context

ADR-0020 made the narrow WebKit smoke lane merge-blocking CI coverage.
ADR-0021 extended that enforcement to the signed release artifact.
That closed the repository's cross-engine gap for WebKit, but Firefox still remained a README-declared browser surface without dedicated CI evidence.

That remaining Firefox row was materially weaker than the rest of the repository's posture.
The application depends on Gecko-sensitive browser behavior for IndexedDB persistence, service worker registration, fallback Blob-download export when `showSaveFilePicker` is unavailable, and normal boot under the pinned CSP and Trusted Types contract.
Leaving Firefox on manual-only verification preserved a truthful caveat, but it also left the final supported engine family outside enforced merge and release evidence.

## Decision

Add a narrow Playwright Firefox smoke lane that runs both at merge time and at release time against the same `dist-ci-verified` artifact.

This lane is allowed to prove only these engine-level behaviors on Gecko:

1. app boot on a Gecko engine without CSP refusal events during normal startup
2. the non-WebKit storage-health path still renders in the shell
3. IndexedDB persistence across reload for the core check-in path
4. service worker registration reaches `activated`
5. the fallback Blob-download export path still triggers when `showSaveFilePicker` is unavailable

This decision does not authorize stronger claims about live Firefox policy behavior.
The lane is not a browser-policy oracle.
It does not prove OS-level storage persistence policy, live-hardware behavior, privacy-mode persistence differences, or file-manager handoff after the fallback download leaves the browser.
Manual verification on a current Firefox release remains in the release checklist.

## Triage rule for Firefox smoke failures

1. If the failure shows shipped behavior is broken on Firefox, fix the product code before merge.
2. If the failure is test fragility, harden the test without widening the claim.
3. If the failure reflects a real platform boundary that the repository accepts, document the boundary here and in `docs/firefox-limitations.md` before merge.

## Consequences

Positive:

- closes the last README compatibility row that lacked automated evidence
- extends the existing engine-compat gate pattern from WebKit to Gecko without changing application code
- blocks merge and release when Firefox-specific regressions hit IndexedDB persistence, service worker registration, or the fallback export path

Trade-offs:

- adds another Playwright lane that can block merge or release on real Gecko regressions or runner instability
- increases release latency by one more smoke pass against the shipped artifact
- requires accepted Firefox platform boundaries to be documented explicitly instead of handled silently
