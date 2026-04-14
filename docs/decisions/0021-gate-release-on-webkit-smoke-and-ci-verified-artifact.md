## Status

Accepted
Amends ADR-0020.

## Context

ADR-0020 made the narrow WebKit smoke lane merge-blocking CI coverage.
That closed the review-time gap for cross-engine regressions, but it did not yet bind the release path to the same evidence.

The previous Pages workflow still rebuilt from source on `push` to `main` and published from that independent build path.
That left two release-integrity gaps:

1. Pages could publish without rerunning WebKit smoke against the artifact being shipped.
2. The artifact released to operators was not guaranteed to be the same `dist/` that the upstream integration pipeline verified.

For a local-only PWA, that distinction matters.
The shipped static bundle is the full product boundary.
If release rebuilds diverge from the verified build, the repository can satisfy merge policy while still publishing different bytes.

## Decision

Gate Pages release on the successful completion of the main integration pipeline for the same `main` branch SHA.

Release now follows this sequence:

1. `Pipeline: Mainline Integrity` builds the production artifact on `push` to `main` and uploads `dist-ci-verified`.
2. `Pipeline: Release Provenance` triggers from `workflow_run` only when that upstream workflow completes successfully on `main`.
3. The release workflow downloads the exact CI-produced artifact by upstream run ID, serves that artifact locally, reruns Chromium smoke and a production-valid WebKit release smoke lane against it, and only then publishes to Pages.
4. The release workflow does not rebuild application assets.

The release WebKit lane remains an engine-level compatibility check, not a browser-policy oracle.
It proves that the shipped production artifact still boots, renders the natural Apple WebKit warning path, persists the core IndexedDB check-in path across reload, and suppresses the Safari-tab backup banner when a fresh browser-side backup timestamp already exists.
It does not claim to simulate Safari's seven-day purge policy or installed-app lifecycle behavior on Apple hardware.

## Consequences

Positive:

- extends ADR-0020 enforcement from merge time to release time
- ensures Pages publishes the same application bytes CI verified instead of a fresh deploy-time rebuild
- closes the most direct policy-to-enforcement gap on the release path
- keeps WebKit release evidence truthful by testing the shipped production artifact without widening runtime behavior claims

Trade-offs:

- release starts after upstream integration completes instead of racing it
- release smoke adds another Chromium and WebKit verification pass before publish
- release-specific smoke coverage must stay disciplined and limited to assertions that remain valid against the production artifact
