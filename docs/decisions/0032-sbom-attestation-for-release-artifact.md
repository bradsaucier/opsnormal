# ADR 0032 - SBOM attestation for release artifact

## Status

Accepted

## Context

ADR-0027 established build provenance for the `dist-ci-verified` release artifact.
ADR-0030 hardened the workflows that produce and verify that artifact.

Those controls prove where the deployed bundle came from, but they do not publish a machine-readable bill of materials for the dependency set used to produce it.
OpsNormal is a local-only static PWA, so the highest-value remaining supply-chain control is to make release composition visible and verifiable without adding runtime services.

GitHub artifact attestations support SBOM predicates through `actions/attest` with `sbom-path`.
GitHub CLI verification requires the SPDX predicate type when checking an SBOM attestation.

## Decision

On every push to `main`, the Node 22 leg of `Pipeline: Mainline Integrity` will:

1. upload the `dist-ci-verified` production artifact
2. attest build provenance for that artifact digest
3. generate an SPDX JSON SBOM with `anchore/sbom-action`
4. upload the SBOM as `dist-ci-verified-sbom`
5. attest the SBOM to the same `dist-ci-verified.zip` artifact digest with `actions/attest`

`Pipeline: Pages Release` must verify both the build-provenance attestation and the SPDX SBOM attestation before extracting, smoking, or publishing the artifact.

The SBOM attestation verification command must include:

```bash
--predicate-type https://spdx.dev/Document/v2.3
```

The workflow shape is enforced by `tests/ci/sbom-attestation-workflow-shape.test.ts`.

## Consequences

Positive:

- publishes a verifiable dependency inventory for each main-branch release artifact
- ties the SBOM to the same artifact digest already used for build provenance
- fails Pages release closed if the SBOM attestation is missing or signed by an unexpected workflow
- keeps the control in CI and release workflows without adding runtime code or telemetry

Trade-offs:

- adds another pinned third-party action to the mainline workflow
- increases main-branch CI time on the Node 22 leg
- couples Pages release to GitHub's SBOM attestation predicate support and GitHub CLI verification behavior
- the SBOM is a dependency inventory and integrity signal, not a claim that bundled code is vulnerability-free

## Review triggers

Review this decision when any of the following changes:

1. GitHub changes the supported SBOM predicate types for `actions/attest`
2. `anchore/sbom-action` changes output semantics or action runtime requirements
3. the release artifact name, digest source, or upload flow changes
4. Pages release verification moves away from `gh attestation verify`
5. OpsNormal adds a backend, container image, npm publishing path, or other release artifact type
