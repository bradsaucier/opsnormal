## Status
Accepted
Amended by ADR-0020.

## Context

OpsNormal already models Apple WebKit browser-tab storage risk explicitly in the shell.
The unresolved gap was automated proof.
The repo had strong manual guidance, but no automated path that proved the backup prompt, install guidance, and storage-health messaging stayed correct as the code changed.

A naive answer would have been to label Playwright WebKit coverage as Safari storage-lifecycle proof.
That would be inaccurate.
The repository cannot simulate WebKit's seven-day purge in CI because that behavior depends on real Safari use over time and browser-managed policies outside the app boundary.

## Decision

Adopt a three-layer storage-lifecycle verification model.

1. Unit tests prove the storage-health and backup-prompt decision tree.
2. Chromium harness tests inject synthetic storage states and verify the exact operator-facing warning surfaces.
3. A narrow WebKit smoke lane proves app boot, warning rendering, and IndexedDB I-O on a WebKit engine without claiming eviction simulation.

At adoption time, the WebKit lane remained non-gating. ADR-0020 later promoted that lane to a merge-blocking compatibility gate while keeping the truth boundary unchanged.
It is a compatibility gate, not a browser-policy oracle.
Documentation, CI, and release checklists must state that boundary plainly.

## Consequences

Positive:
- closes the automated-proof gap around app-controlled Safari risk messaging
- adds truthful WebKit coverage without inflating confidence beyond what the lane can prove
- reduces the chance that storage warning regressions slip past CI

Trade-offs:
- adds another Playwright project and CI artifact lane
- requires synthetic test APIs to drive storage states deterministically
- still leaves real Safari purge behavior in the manual verification lane
- cannot preserve browser-side backup metadata through a real WebKit purge, so operator guidance must cover blank-return restore from the latest JSON export
