# OpsNormal

Offline-first daily readiness tracking that runs entirely in your browser.

```yaml
STATUS  : OPERATIONALLY READY
AUTHOR  : Bradley Saucier, SMSgt, USAF (Ret.)
LICENSE : MIT
```

[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![CI](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-v0.1.0-2F6F63?style=flat-square)](./package.json)
[![Data](https://img.shields.io/badge/Data-Local--Only-36476F?style=flat-square)](#privacy-and-data)
[![PWA](https://img.shields.io/badge/PWA-Offline--Capable-2F6F63?style=flat-square)](#offline-and-pwa)

OpsNormal is a deliberately narrow personal readiness tracker built for fast daily use, not feature sprawl. Five sectors. Three states. Thirty trailing days. No account system, no backend, no cloud sync, and no telemetry.

Live app: https://opsnormal.app

## Bottom Line Up Front (BLUF)

> [!IMPORTANT]
> **OpsNormal is a local-first Progressive Web App for sub-10-second daily readiness tracking.**
>
> It tracks five core sectors with a three-state model and a 30-day trailing grid to show whether the main sectors of life are holding together or quietly degrading. After the app loads, the working data path stays local in IndexedDB unless you explicitly export it. Recovery is real because export, validated import, undo, and storage durability checks are part of the operating model.

## Why this exists

Most personal tracking tools miss the mark in one of two ways. They either demand too much attention, or they push routine personal data into a cloud stack the operator never asked for.

OpsNormal takes the opposite path. The interaction is intentionally coarse, intentionally fast, and intentionally local. The objective is not quantified-self theater. The objective is to maintain a simple daily signal that still works when life gets noisy.

## Core model

### Sectors

- Work or School
- Household
- Relationships
- Body
- Rest

### States

- Unmarked
- Nominal
- Degraded

### Operating boundaries

- No accounts
- No backend
- No cloud sync
- No third-party APIs
- No telemetry
- No journaling requirement
- No automated coaching layer
- No medical or psychological claims

## Operational capabilities

- Single-click daily check-in across five fixed sectors
- 30-day readiness grid for fast pattern recognition
- Local-only persistence through Dexie on top of IndexedDB
- Installable PWA with offline app-shell support after first successful load
- JSON export for backup and validated JSON import for recovery
- CSV export for external review and spreadsheet work
- Storage durability checks with persistent storage requests when supported
- Root and sectional crash containment so render faults do not degrade into a blank screen
- Lint, typecheck, unit, integration, and end-to-end verification in CI

## Quick start

### Use the app

Open the live deployment:

```text
https://opsnormal.app
```

Install it from your browser if you want a tighter app-like workflow and stronger local durability posture.

### Run locally

Prerequisites:

- Node.js 20.19.0 or newer
- npm 10 or newer

Start the app:

```bash
npm ci
npm run dev
```

Run the full local verification stack:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Privacy and data

Privacy in OpsNormal is an architectural fact, not a marketing slogan.

- Working data is stored in IndexedDB through Dexie
- There is no account model
- There is no backend service handling user records
- There are no analytics or telemetry calls
- There is no cloud sync path
- Data leaves the device only when the operator explicitly exports it

### Backup and recovery posture

Local-first only works if recovery is real.

- JSON export writes a versioned backup payload with app metadata, schema version, export timestamp, entries, and a SHA-256 checksum
- CSV export provides a flat external record for review or spreadsheet work
- Import validates payload structure before any write reaches IndexedDB
- When a checksum is present, import recomputes integrity and rejects mismatches before write
- Import validates payload structure and checksum before write, then verifies the written state inside the same IndexedDB transaction so a mismatch aborts before commit
- Legacy JSON exports without a checksum can still import, but they are flagged as unverified
- Import supports merge and replace modes
- Undo restores the pre-import snapshot for the current session
- Crash fallback keeps export actions available if the main React shell faults

### Honest limits

Browser-local storage is not backup storage.

- Manual browser data clearing can destroy records
- Profile deletion can destroy records
- Device loss can destroy records
- Some browser eviction policies can destroy records
- On iPhone and iPad, install to Home Screen and export routinely
- Safari-family browser sessions can still evict local data even when persistence signals look favorable
- On iPhone and iPad, Home Screen mode avoids the standard Safari inactivity path but still does not replace routine export discipline
- Operator guidance: Treat browser-local data as local working storage, not your only copy. Export routinely.

## Offline and PWA

OpsNormal is built as a Progressive Web App, but it stays disciplined about scope.

- The app shell is cached for offline reopen after first successful load
- The app is installable from supported browsers
- A reload banner appears when an updated service worker is ready
- GitHub Pages serves the static deployment
- `index.html` is copied to `404.html` so direct navigation on GitHub Pages still resolves cleanly for the SPA shell

This is not a sync engine pretending to be offline. It is a local-first static deployment with explicit export and recovery.

## Verification posture

OpsNormal is designed to prove reliability, not just feature count.

- Unit tests cover date handling, export formatting, validation helpers, and storage logic
- Integration tests cover Dexie persistence, compound key behavior, and import workflows with fake IndexedDB
- End-to-end tests cover daily check-in flow, export and import behavior, and the operator-facing path through the application
- GitHub Actions enforces lint, typecheck, tests, and build on the main verification path

## Tech stack

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Dexie 4 with IndexedDB
- Zod for runtime validation
- vite-plugin-pwa for installability and offline shell support
- Vitest for unit and integration testing
- Playwright for end-to-end testing
- GitHub Actions and GitHub Pages for verification and deployment

## Docs and repository standards

The README is the landing page. Deeper material lives in `/docs`.

- [Architecture overview](./docs/architecture.md)
- [Architecture Decision Records](./docs/decisions/README.md)
- [Risk register](./docs/risk-register.md)
- [Test plan](./docs/test-plan.md)
- [Release checklist](./docs/release-checklist.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## Contributing

If you want to contribute, start with the standards files and keep changes inside the existing operating boundary.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md)
- Report security issues through [SECURITY.md](./SECURITY.md)
- Follow the baseline in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## License

See [LICENSE](./LICENSE).

```text
// END TRANSMISSION
```
