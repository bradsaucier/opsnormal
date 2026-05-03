# ADR 0035 - Runtime-only release SBOM

## Status

Accepted

## Context

ADR-0032 publishes a Sigstore-backed SBOM attestation for the `dist-ci-verified` release artifact digest.
That attestation is consumed as evidence for the deployed bundle, so the SBOM content should match the dependency boundary of the deployed static app instead of the full CI build environment.

Generating the SBOM from the repository root after `npm ci` with all development dependencies installed overstates the apparent runtime surface.
It includes test, lint, build, and browser automation packages that are not part of the deployed app and can create false-positive vulnerability findings for downstream auditors.

The repository already pins `packageManager` to `npm@10.9.2`.
That npm line includes `npm sbom` and supports SPDX output.
In this repo, the full CI install contains packages that are reachable through both runtime and development edges.
Running `npm sbom --omit=dev` against that full install can omit runtime packages that also appear in development tooling paths.

## Decision

The Node 22 release leg of `Pipeline: Mainline Integrity` will generate `dist-ci-verified.spdx.json` from a clean production-only install.
The workflow will:

1. create a temporary SBOM directory
2. copy `package-lock.json`
3. copy `package.json` after removing `devDependencies`
4. run `npm ci --omit=dev --ignore-scripts`
5. run `npm sbom --sbom-format=spdx`

The production-only manifest keeps root runtime packages such as `react`, `react-dom`, `zod`, and `workbox-window` visible to npm's SBOM generator while excluding build, lint, test, and browser automation packages.

The generated SBOM will be validated before attestation to confirm that:

- the SPDX version is `SPDX-2.3`
- expected runtime packages are present
- known build-only packages are absent

The generated file will be uploaded as the `dist-ci-verified-sbom` artifact and attested to the same `dist-ci-verified.zip` digest used for build provenance.

`Pipeline: Pages Release` will continue verifying the SBOM attestation with:

```bash
--predicate-type https://spdx.dev/Document/v2.3
```

## Consequences

Positive:

- narrows the release SBOM to production runtime dependencies derived from `package-lock.json`
- removes a pinned third-party SBOM-generation action from the mainline workflow
- reduces false-positive vulnerability attribution against the deployed bundle
- keeps the attestation subject, digest source, artifact name, and predicate type unchanged
- fails CI before attestation if npm SBOM output omits required runtime packages or includes known build-only packages

Trade-offs:

- depends on npm CLI SBOM output remaining compatible with SPDX 2.3 attestation verification
- does not describe the full build environment or development toolchain
- uses a temporary production-only manifest so `npm sbom` does not fail on omitted development dependencies
- requires review if future runtime assets are produced outside the npm production dependency graph

## Review triggers

Review this decision when any of the following changes:

1. npm changes `npm sbom` SPDX output semantics
2. the release artifact contents or upload flow changes
3. OpsNormal adds runtime workers, asset bundlers, or package sources not represented in the production dependency tree
4. Pages release verification changes the SBOM predicate type or attestation verifier
5. the project decides to publish a separate build-environment SBOM
