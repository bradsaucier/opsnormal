# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Changed

- removed the internal IndexedDB auto-increment `id` from new JSON and crash-JSON exports, while keeping legacy backups that still carry `id` importable
- hardened import commit verification by reading the pre-write snapshot and deriving the undo snapshot inside the rw transaction
- unified focus chrome on DomainCard radios, history grid cells, mobile day buttons, and the history scroll region under shared focus utilities

### Security

- pinned the meta CSP directive set with a test gate, added Trusted Types enforcement, and documented the contract in ADR-0026

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
