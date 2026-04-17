# ADR 0027 - Build provenance attestation for release artifact

## Status

Accepted
Amends ADR-0021.

## Context

README.md line 31 states that the release pipeline "publishes only the exact CI-verified production artifact."
README.md line 96 states that release publication reuses the exact `dist-ci-verified` artifact that passed mainline integrity instead of rebuilding a new deploy bundle.
SECURITY.md lines 27 through 34 identify "Dependency supply chain risk" and "Static hosting configuration and build integrity" as primary concerns.
ADR-0021 already moved Pages release onto the exact upstream artifact by run ID, but that handoff still depended on GitHub artifact storage without a cryptographic proof that outside parties could verify independently.

For a local-only static PWA, the shipped bundle is the full product boundary.
If the release workflow cannot prove that the deployed bundle came from the expected commit and workflow run, the repository's strongest release-integrity claim remains an operational convention instead of a cryptographically verifiable property.

## Decision

`Pipeline: Mainline Integrity` produces a Sigstore-backed SLSA build-provenance attestation for the uploaded `dist-ci-verified` artifact only on push to `main` and only on the Node 22 matrix leg.
`Pipeline: Pages Release` resolves that same artifact archive by upstream run ID, verifies the attestation with `gh attestation verify`, and fails closed in both `release_smoke` and `deploy` if the attestation is missing or does not match the expected repository, signer workflow, branch ref, or triggering commit SHA.

The verification contract is:

1. The signer workflow must be `bradsaucier/opsnormal/.github/workflows/ci.yml`.
2. The source ref must be `refs/heads/main`.
3. The source digest must equal `github.event.workflow_run.head_sha`.
4. No smoke run or Pages upload proceeds until verification succeeds.

## Consequences

Positive:

- extends ADR-0021 from run-id artifact reuse to cryptographic artifact identity
- gives third parties a public `gh attestation verify` recipe for the release artifact
- strengthens the repository's published release-integrity claim without changing runtime code, the local-only trust boundary, or the deployed asset bytes

Trade-offs:

- attestation is a build-time integrity claim, not a runtime guarantee
- verification now depends on GitHub Actions attestation services and the GitHub CLI in the release workflow
- attestations for this public repository are logged through Sigstore and are therefore publicly visible in transparency data

## Reference

Amends ADR-0021 - Gate release on WebKit smoke and CI-verified artifact.
Extends ADR-0007 only at the build pipeline boundary. It does not alter the local-only runtime trust boundary.
