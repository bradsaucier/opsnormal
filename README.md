# OpsNormal

```yaml
tagline: "Local-only readiness tracking for fast use under load."
```

[![CI](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)
[![Data posture: Local only](https://img.shields.io/badge/Data_Posture-Local_Only-36476F?style=flat-square)](#local-only-by-design)
[![Telemetry: None](https://img.shields.io/badge/Telemetry-None-36476F?style=flat-square)](#local-only-by-design)

Live app - [opsnormal.app](https://opsnormal.app)

---

<p align="center">
  <img src="./docs/images/desktop-readiness-grid.png" width="920" alt="Desktop 30-day readiness grid showing five sectors across recent days with a selected day summary for quick pattern recognition.">
</p>
<p align="center"><em>Desktop view - 30-day history kept visible for quick pattern recognition and daily context.</em></p>

---

OpsNormal is a static Progressive Web App for personal daily readiness tracking across five fixed sectors: Work or School, Household, Relationships, Body, and Rest.

It runs in the browser, stores working data in IndexedDB through Dexie, and keeps the product boundary hard: no backend, no account system, no cloud sync path for readiness data, and no analytics or telemetry pipeline moving personal status off device. After the first successful load, the app can reopen offline. Browser storage is working storage, not backup. Export is the durable boundary the operator controls.

<a id="bluf"></a>
## Bottom Line Up Front (BLUF)

> [!IMPORTANT]
> **OpsNormal is built for one job: preserve a usable daily readiness signal when life gets noisy.**
>
> The model is intentionally coarse. Five fixed sectors. Three states. One trailing 30-day picture. The point is fast signal, not endless bookkeeping.
>
> Recovery posture, storage limits, import and export controls, crash containment, and update handling are visible in the source and docs.


---

## Quick start

### Use the deployed app

1. Open `https://opsnormal.app`
2. Install it from the browser when supported if you want stronger app-like use, better offline reopen behavior, and a better storage posture on some platforms
3. Record an initial status across the five fixed sectors
4. Run a test JSON export and keep the file somewhere you control
5. Export routinely, especially before browser maintenance, profile changes, device transitions, or long periods of inactivity

### Run locally

Prerequisites:

- Node.js 22.13.0 or newer
- npm 10.9.2 or newer

```bash
npm ci
npm run dev
```

Local verification and CI are aligned to supported LTS lines. The project baseline is Node 22.13.0 or newer, and GitHub Actions verifies Node 22 and Node 24. `devEngines` enforces the local Node and npm contract before install, ci, and run commands.

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

## Core views

The app keeps the workflow narrow on purpose.

- Today panel for direct daily entry
- Desktop 30-day history grid for pattern recognition
- Week-paginated mobile history with a daily brief on narrow screens
- Export and import surface for backup, recovery, preview, merge, replace, and undo flows

---

The screenshots in this README show the desktop product. Mobile history uses a different layout so the 30-day grid does not collapse into noise on narrow screens.

<p align="center">
  <img src="./docs/images/desktop-daily-checkin.png" width="860" alt="Desktop Today panel showing five sector cards with direct-select readiness controls for a fast daily entry.">
</p>
<p align="center"><em>Desktop view - Today panel optimized for fast daily entry across the fixed five-sector model.</em></p>

---

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

## Local-only by design

OpsNormal is a static web app with no backend data plane for readiness records.

What that means:

- No account required
- No cloud sync path for readiness data
- No analytics or telemetry pipeline for personal status
- No third-party API dependency for core operation
- Same-origin static hosting and same-origin PWA update behavior only

What that does not mean:

- The app is not network-absent - same-origin asset fetches and service-worker lifecycle traffic still exist
- Browser-managed storage is not a backup system
- Offline reopen is available after the first successful load, not before

## Recovery and storage limits

OpsNormal treats browser-managed storage as working storage, not permanent archive storage.

The repo hardens that posture with versioned JSON export, CSV export, validated import, replace gating, import undo, crash fallback export access, section-level fault containment, storage posture checks, persistent-storage requests where the platform supports them, guarded Dexie reopen logic after connection interruption, and strict Chromium-family transaction durability.

The limits stay real:

- Manual site-data clearing, profile deletion, quota failure, browser eviction, or device loss can still destroy records
- Safari-family browsers carry materially higher storage risk, especially when the app is not installed to Home Screen
- Install can improve posture on some platforms, but it is not a guarantee
- Session undo after import is a convenience, not a durable recovery boundary

Run a test export early. Export routinely. If you need a durable copy, keep the exported file.

## Accessibility

Accessibility is built into the operational surface.

- Skip link to the main surface
- Persistent live regions for state changes
- Radio-style direct selection controls with programmatic checked state
- Desktop history keyboard navigation and mobile day selection with a daily brief
- Focus treatment designed to stay visible on the clipped cockpit geometry
- State encoding that does not rely on color alone

## Documentation and verification

The README stays short on purpose. Deeper proof, limits, and design constraints live in the repo docs.

| Document | What it covers |
| --- | --- |
| [Architecture overview](./docs/architecture.md) | Runtime shape, persistence model, recovery posture, PWA behavior, and known limits |
| [Risk register](./docs/risk-register.md) | Known operational risks, browser-storage hazards, and current mitigations |
| [Architecture Decision Records](./docs/decisions/README.md) | Why the repo chose IndexedDB, local-only boundaries, export integrity rules, and related constraints |
| [Test plan](./docs/test-plan.md) | Verification strategy, release checks, and coverage priorities |
| [Release checklist](./docs/release-checklist.md) | Pre-release validation and operator-facing quality gates |
| [Security policy](./SECURITY.md) | Security model, trust boundaries, and accurate claim limits |
| [Design tokens](./docs/design-tokens.md) | Visual language, structural colors, state colors, and clipped geometry |
| [Contributing guide](./CONTRIBUTING.md) | Contribution rules that preserve repo scope |
| [Code of conduct](./CODE_OF_CONDUCT.md) | Expected project conduct |

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
