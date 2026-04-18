# ADR 0028 - CodeQL source code scanning gate

## Status

Accepted.
Implemented 2026-04-18 through the `verify` aggregator in `Pipeline: Mainline Integrity`. Branch protection requires `verify`.

## Context

The repository already gates dependency audit, CSP drift, build provenance, WebKit compatibility, and integrity-critical coverage in CI.
It does not yet run any source-level static analysis over the JavaScript and TypeScript code that implements import validation, undo invalidation, service-worker registration, cross-tab coordination, crash recovery, and fail-closed persistence paths.

SECURITY.md scopes review to CSP bypass opportunities, service-worker correctness, import-validation bypasses, undo verification bypass, data-integrity failures, and conditions that could silently lose data while reporting success.
Those categories map directly to the JavaScript and TypeScript CodeQL query packs, especially the `security-extended` and `security-and-quality` suites.

## Decision

Add a dedicated `CodeQL` workflow that analyzes `javascript-typescript` on every pull request, every push to `main`, and on a weekly sweep of the default branch.
The workflow runs with least-privilege permissions, installs dependencies, builds the production bundle, initializes CodeQL with `security-extended` and `security-and-quality`, and uploads SARIF through the standard `analyze` step.

Treat `CodeQL / Analyze (javascript-typescript)` as a required mainline gate.
High-severity findings must be fixed before merge unless a finding is proven incorrect and suppressed with a narrowly scoped, query-specific justification.
Medium and low findings must be fixed in the same pull request or tracked immediately with an issue before merge.
The gate is enforced at two points.
Branch protection blocks merge when CodeQL fails on a pull request.
Pipeline: Pages Release blocks publish when CodeQL has not reported completed and success for the release SHA before `release_smoke` runs, so a late-firing finding on push to `main`, including one raised by a query-pack roll-forward, can no longer silently ship.

## Consequences

Source-level static analysis becomes a first-class CI signal beside npm audit, CSP drift testing, provenance attestation, and browser verification.
The repository gains structured findings in the GitHub Security tab without changing runtime code or the shipped bundle.

The workflow adds CI minutes and may surface false positives that require triage.
Because CodeQL analyzes the built project, `npm run build` must stay healthy for scanning to run.
If the repository later becomes private, CodeQL minute consumption will become a costed resource instead of a free public-repository control.
A CodeQL failure on the release SHA now stops Pages publish.
This couples releases to CodeQL availability, matching the existing coupling to Sigstore `gh attestation verify`.
Query packs are version-pinned so the gate evaluates a reproducible rule set, and pack updates flow through the normal dependency review cadence.

## Alternatives Considered

OSV-Scanner was rejected because it strengthens dependency review, not application-source analysis, and overlaps with the existing `npm audit --audit-level=high` gate.
Semgrep was rejected because it would add a second rule-management surface without matching CodeQL's GitHub-native SARIF flow or JavaScript taint coverage.
ESLint security plugins were rejected because they provide lighter lint rules, not the same source-flow and query-pack coverage as CodeQL.

## Failure Model

Workflow execution failure is treated the same way as any other required CI failure: merge stops until the workflow is green again.
High-severity findings block merge.
Medium and low findings may merge only when they are fixed immediately or tracked explicitly for prompt follow-up.

Suppressions must stay minimal, local, and reviewable.
Do not disable whole query suites to quiet noise.
If a suppression is necessary, keep it query-specific, explain why the result is a false positive, and record that rationale in the pull request that introduces it.
