## Status

Accepted

## Context

ADR-0027 established build provenance for the `dist-ci-verified` release artifact.
That control is only meaningful if the workflow that produces and verifies the artifact is itself constrained.

`SECURITY.md` already states: "Treat workflow changes as supply-chain changes and review them with the same discipline as application dependencies."
Before this decision, that rule existed as policy text but not as a merge-blocking control.

The repository already pins third-party actions, verifies provenance before Pages publish, enforces CSP drift checks, and runs CodeQL over the application source.
The remaining trust gap was the workflow surface itself:

1. `actions/checkout` still defaulted to persisted credentials across the repository workflows
2. workflow token permissions were broader than they needed to be in a few jobs
3. no static analysis lane reviewed workflow misconfiguration on pull requests
4. installed npm tarballs were not verified against registry signatures before build

That left a path where workflow or dependency compromise could invalidate the repository's provenance story at the point where it matters most.

## Decision

Add four workflow-supply-chain controls and treat them as the default repository posture:

1. Every `actions/checkout` invocation in repository workflows must set `persist-credentials: false` unless a future ADR and an in-file workflow-security justification explicitly permit an exception.
2. Every workflow must declare top-level `permissions`, and every job must stay on the minimum read and write scopes it requires.
3. `Workflow Lint` must run pinned `zizmor` analysis on workflow changes, upload SARIF results to code scanning, and block the run on high-severity findings.
4. `Pipeline: Mainline Integrity` must run `npm audit signatures` before build so unsigned or mismatched npm artifacts fail the lane.
5. Every workflow job must declare an explicit `timeout-minutes`, and Mainline Integrity pull request runs must cancel stale attempts without cancelling push-to-main release artifact runs.

These controls are enforced through workflow definitions, the `workflow-security-shape` test suite, and the repository policy documents.

## Consequences

Positive:

- closes the workflow-level gap that could otherwise undermine artifact provenance
- removes reusable checkout credentials from runner state across the repository workflows
- turns workflow review guidance into an automated merge gate instead of relying on memory
- adds npm package signature verification without changing application runtime code

Trade-offs:

- adds one more workflow lane and a second `zizmor` pass to workflow-touching pull requests
- can block unrelated workflow edits when `npm audit signatures` or workflow analysis finds a real upstream issue
- requires any future `contents: write` or persisted-credentials exception to be documented instead of handled informally

## Review triggers

Review this decision when any of the following changes:

1. a new workflow, composite action, or release-signing step is added
2. a job permission block gains a new write scope or requests `contents: write`
3. a workflow needs persisted checkout credentials
4. `zizmor` or npm signature verification introduces sustained false positives or operational friction that the repository cannot absorb
5. workflow timeouts, cache restore strategy, or pull request concurrency behavior no longer match observed runner behavior
