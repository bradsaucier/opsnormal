# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added

- deterministic SHA-256 canonicalization for JSON export checksums via `sha256-canonical-v1`; legacy backups remain importable, while new backups require builds that understand the additive `checksumAlgorithm` field

### Changed

- re-verified import checksums inside `applyImport` before any IndexedDB write and documented the boundary in ADR-0033
- added explicit workflow job timeouts across the pipeline and locked the invariant in the workflow security shape tests
- added PR-only cancellation to Pipeline: Mainline Integrity and Playwright browser cache restore keys for the WebKit and Firefox smoke lanes
- removed the internal IndexedDB auto-increment `id` from new JSON and crash-JSON exports, while keeping legacy backups that still carry `id` importable
- hardened import commit verification by reading the pre-write snapshot and deriving the undo snapshot inside the rw transaction
- unified focus chrome on DomainCard radios, history grid cells, mobile day buttons, and the history scroll region under shared focus utilities
- added a narrow merge-blocking and release Firefox Playwright smoke lane, documented in ADR-0029, that proves Gecko engine-level compatibility without claiming live Firefox policy simulation
- retired the React Hooks lint canary by moving to stable `eslint-plugin-react-hooks` 7.1.1 and removing the temporary Dependabot ignore

### Security

- pinned the meta CSP directive set with a test gate, added Trusted Types enforcement, and documented the contract in ADR-0026
- pinned the Trusted Types policy contract under a 100% coverage gate per ADR-0024 and ADR-0026
- added CodeQL JavaScript and TypeScript code scanning as a mainline merge gate in ADR-0028
- added SPDX SBOM generation plus Sigstore-backed SBOM attestation and Pages release verification in ADR-0032
- narrowed the release SBOM to production-only dependencies derived from `package-lock.json`, classified `workbox-window` as a runtime dependency, and documented the boundary in ADR-0035

## [1.0.0] - 2026-04-14

### Added

- public release metadata in `package.json`, `public/CNAME`, and `CITATION.cff`
- community health files for pull requests, issue intake, release notes, ownership, and support policy
- canonical, Open Graph, and Twitter metadata for the live custom domain
- documented public-release scope and the temporary React hooks lint canary exception through ADR-0022 and ADR-0023

### Changed

- promoted the repository version to `1.0.0`
- renamed the Pages workflow to `Pipeline: Pages Release` so public workflow labels match what the pipeline actually proves
- pinned GitHub Actions to immutable SHAs and removed the unused Node 24 environment override
- moved the e2e harness entry points under `tests/harness/` and updated the Vite build inputs
- emitted the GitHub Pages SPA `404.html` fallback directly from the Vite build
- tightened the README, release checklist, and architecture docs around custom-domain, browser-compatibility, and release-truth boundaries

### Security

- restored registry-resolved lockfile transparency by removing `omit-lockfile-registry-resolved=true`
- documented the GitHub Actions pinning policy and the current ESLint 10 versus stable React hooks plugin boundary in `SECURITY.md`
