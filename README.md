# OpsNormal

Local-only daily readiness tracking for fast use under load.

[![CI](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)

Live app - https://opsnormal.app

## BLUF

OpsNormal is a static Progressive Web App for daily readiness tracking across five fixed sectors.

It stores working data in browser-managed IndexedDB through Dexie, uses three coarse states to keep daily entry fast under load, and maintains a trailing 30-day view without a backend. Recovery is manual by design. Exports are the durable boundary the operator controls.

## Quick start

### Use the deployed app

1. Open `https://opsnormal.app`
2. Install it from the browser if you want tighter app-like use, better offline reopen behavior, and stronger storage posture on some platforms
3. Record an initial status across the five fixed sectors
4. Run a test JSON export and keep the file somewhere you control
5. Export routinely, especially before browser maintenance, profile changes, or device transitions

### Run locally

Prerequisites:

- Node.js 20.19.0 or newer
- npm 10 or newer

```bash
npm ci
npm run dev
```

<details>
<summary>Run the full local verification stack</summary>

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

</details>

## What it is not

- No backend API
- No account model
- No cloud sync
- No analytics
- No telemetry
- No third-party APIs

The application code contains no network logic that transmits readiness data to a backend, analytics endpoint, telemetry pipeline, or third-party API.

Static assets and routine service worker update checks are served from the published origin. There is no separate application data plane moving personal readiness data off device.

Independent verification is encouraged. Inspect the source code and monitor the browser Network tab. In a clean browser profile, you should see same-origin asset fetches and service worker lifecycle traffic, not a user-data backend or third-party tracking stack.

## Operating model

OpsNormal records one of three states for each of five fixed sectors.

The model is intentionally coarse. The point is a usable signal, not exhaustive journaling.

### Sectors

| Sector | Purpose |
| --- | --- |
| Work or School | Daily load from the main duty lane |
| Household | Home and admin pressure |
| Relationships | Family, social, and close-support strain |
| Body | Physical state and recovery |
| Rest | Sleep, decompression, and reset quality |

### States

| State | Meaning |
| --- | --- |
| Unmarked | No status recorded for that sector on that day |
| Nominal | Holding together |
| Degraded | Needs attention |

### Views

- Today panel for direct daily entry
- Desktop 30-day history grid for pattern recognition
- Week-paginated mobile history with a daily brief on narrow screens
- Export and import surface for backup, recovery, and controlled replace operations

## Data integrity and manual recovery

This repo does not ask for blind trust. It names its safeguards and its limits.

- Versioned JSON export with SHA-256 checksum
- CSV export for external review and spreadsheet work
- Validated JSON import with checksum recomputation when present
- Legacy checksum-free import allowed, but flagged as unverified during preview
- Replace import held behind a pre-replace backup checkpoint
- Verified file save when the browser supports it, with a fallback path when it does not
- Separate arm and execute steps for destructive replace
- Import post-write verification inside the same IndexedDB transaction so mismatches abort before commit
- Daily check-in read-back verification after write so silent local write loss becomes visible
- Session-scoped undo after successful import
- Root crash fallback that preserves JSON and CSV export access if the main React shell faults, using a same-origin recovery stylesheet that stays compatible with the repo CSP posture
- Section-level error boundaries so a panel failure does not take the whole app offline

There is no backend recovery path. If you need a durable copy, export it.

## Durability and honest limits

OpsNormal treats browser-managed storage as working storage, not permanent archive storage.

- Storage posture is checked on launch and refreshed over time
- The app requests persistent storage when the platform supports it
- Safari-family risk and Home Screen posture are surfaced in the durability summary
- Dexie connection drops are monitored and bounded reopen is attempted before the app trusts the handle again
- Schema version changes force stale tabs to close their handle and reload
- Chromium-family writes are pinned to strict transaction durability

What this does not mean:

- Browser storage is still best-effort, not backup
- Manual site-data clearing, profile deletion, device loss, quota failure, or browser eviction can still destroy records
- Safari-family browsers carry higher storage risk, especially when the app is not installed to Home Screen
- Session undo is a convenience after import, not a durable recovery boundary
- Install can improve posture on some platforms, but it is not a guarantee

Run a test export early. Export routinely. That is the durable boundary the operator controls.

## Accessibility

Accessibility is part of the implementation, not a label added after the fact.

Current repo surfaces include:

- Skip link to the main operational surface
- Persistent live regions for announced state changes
- Radio-style direct selection controls with programmatic checked state
- Desktop history keyboard navigation
- Mobile history day selection with a daily brief
- Focus treatment designed to stay visible on the clipped cockpit geometry
- State encoding that does not rely on color alone

## Engineering proof

The repo backs its claims with process and verification, not slogans.

- GitHub Actions CI runs lint, typecheck, unit and integration tests, and Playwright end-to-end tests
- The current test tree contains 19 unit suites, 2 integration suites, and 7 end-to-end specs
- Architecture Decision Records lock in trust boundaries, data model choices, storage durability hardening, export checksum rules, error containment, and mobile history behavior
- The repo carries a risk register, test plan, release checklist, and design token document alongside the source
- The app ships with a restrictive Content Security Policy and same-origin static hosting posture

## Why this exists

Most tracking tools fail one of two tests.

They either ask too much from the operator, or they push routine personal data into infrastructure the operator never asked for.

OpsNormal takes the opposite path. Scope is fixed. Inputs are coarse. Daily use is fast. The app is built to keep a signal available when life gets noisy, not to turn the operator into a full-time bookkeeper.

## Read this next

The README is the executive brief. The deeper proof lives in the repo.

- [Architecture overview](./docs/architecture.md)
- [Architecture Decision Records](./docs/decisions/README.md)
- [Risk register](./docs/risk-register.md)
- [Test plan](./docs/test-plan.md)
- [Release checklist](./docs/release-checklist.md)
- [Design tokens](./docs/design-tokens.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Security policy and security model](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## Boundary

OpsNormal is a personal status tracking tool.

It is not a medical device. It does not diagnose, treat, cure, or prevent any disease or condition. It does not provide medical or psychological advice.

## Contributing

If you want to contribute, stay inside the operating boundary.

- Keep the app local-only
- Do not add accounts, analytics, cloud sync, or background services
- Preserve the fixed five-sector model in the current product scope
- Update tests and docs when behavior changes

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

See [LICENSE](./LICENSE).

```text
// END TRANSMISSION
```
