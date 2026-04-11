# OpsNormal

```yaml
tagline: "Local-only readiness tracking for fast use under load."
```

[![CI](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)
[![Data posture: Local only](https://img.shields.io/badge/Data_Posture-Local_Only-36476F?style=flat-square)](#local-only-and-trust-boundary)

<p align="center">
  <img src="./docs/images/desktop-readiness-grid.png" width="920" alt="Desktop interface displaying a 30-day readiness grid across five sectors and a detailed daily summary.">
</p>
<p align="center">Desktop view: 30-day trailing grid and daily summary.</p>

OpsNormal is a local-only Progressive Web App for fast daily readiness tracking across five fixed sectors: Work or School, Household, Relationships, Body, and Rest.

No backend. No account. No cloud sync. No analytics. After the first successful load, the app can reopen offline. Readiness records stay in browser-managed storage until you export them to a file you control.

## BLUF

> [!IMPORTANT]
> **OpsNormal is built for one job: preserve a usable daily readiness signal when life gets noisy.**
>
> The user model stays intentionally small. Five sectors. Three states. One trailing 30-day picture.
>
> Simplicity lives in the daily workflow. Rigor lives in validation, export, recovery, accessibility, and update handling.

## What this is

- Static PWA with same-origin asset and service-worker behavior
- Local-only readiness tracking backed by IndexedDB through Dexie
- Desktop 30-day history plus a narrow-screen mobile history path
- JSON and CSV export, validated import, replace gating, and undo support

## What this is not

- Not an account-based product
- Not a cloud-sync tool
- Not a free-form journal or custom-category tracker
- Not a permanent archive unless you export
- Not a medical device or source of medical or psychological advice

## Quick start

### Use the deployed app

1. Open `https://opsnormal.app`
2. On Apple devices, install it to Home Screen if you plan to rely on it there. Ordinary Safari tabs are subject to WebKit's seven-day storage purge after seven days of Safari use without user interaction on the site.
3. Record an initial status across the five fixed sectors
4. Run a test JSON export and keep the file somewhere you control
5. Export routinely, especially before browser maintenance, profile changes, device transitions, or long periods of inactivity

### Run locally

Prerequisites: Ensure the local environment meets the engine contract defined in `package.json`. `devEngines` enforces the local Node and npm baseline before install, ci, and run commands.

```bash
npm ci
npm run dev
```

Local verification and CI are aligned to supported LTS lines. GitHub Actions verifies the application across multiple current Node environments.

<details>
<summary>Run the full local verification stack</summary>

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:webkit
npm run build
npm run test:e2e:smoke
```

`npm run test:e2e` builds the e2e-mode harness bundle and runs the full Chromium suite. `npm run test:e2e:webkit` adds the narrow WebKit smoke lane that verifies rendering and IndexedDB I/O without claiming to reproduce Safari eviction behavior. Run `npm run build` before `npm run test:e2e:smoke` so the smoke command reuses a real production `dist/` build and skips the harness-only specs. That is the same production-artifact gate used by the GitHub Pages deployment workflow.

</details>

## Core views

- Today panel for direct daily entry
- Desktop 30-day history grid for pattern recognition
- Week-paginated mobile history with a daily brief on narrow screens
- Export and import surface for backup, recovery, preview, merge, replace, and undo flows

## Responsive history proof

Narrow screens switch from the 30-day grid to week groups with a daily brief so the history surface stays readable on phone-sized viewports.

<p align="center">
  <img src="./docs/images/mobile-history-week-brief.png" width="300" alt="Mobile interface displaying week-paginated readiness cards and a focused daily brief.">
</p>
<p align="center">Mobile view: Week-paginated cards and daily brief.</p>

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

<a id="local-only-and-trust-boundary"></a>
## Local-only and trust boundary

### Storage model

- Readiness data is stored in IndexedDB through Dexie
- Same-origin asset fetches and service-worker lifecycle traffic still exist
- There is no backend data plane for readiness records

### What the repo can promise

- Core use stays local to the device after the first successful load
- Export creates operator-controlled JSON and CSV files
- Import validates structure before commit
- Crash containment preserves recovery options instead of dropping the user into a blank failure state
- Backup action prompts escalate when storage diagnostics or Safari-tab risk make a fresh JSON export urgent

### What the repo will not promise

- Browser-managed storage is not a backup system
- Private, incognito, and other ephemeral browsing modes do not provide durable storage. Data can be discarded when the session ends
- On Safari-family browsers, ordinary browser tabs are subject to WebKit's seven-day purge for script-writable storage. After seven days of Safari use without user interaction on the site, IndexedDB, service-worker state, and cached assets can be purged
- On Apple devices, install to Home Screen if you plan to rely on the app there. Home Screen mode avoids the standard Safari browser-tab counter, but export is still the only durable boundary you control
- If Safari purges the app after inactivity, it can erase both the readiness database and the browser-side timestamp that recorded the last export. The app may reopen looking like a clean install. Restore from the latest JSON export immediately
- On all platforms, clearing site data, switching profiles, quota pressure, browser eviction, or device loss can destroy records

Export is the durable boundary the operator controls. Run a test export early. Export routinely. When the shell raises a backup action prompt, treat it as a direct order to refresh the JSON export.

## Proof of rigor

- GitHub Actions runs lint, typecheck, Vitest coverage, Playwright Chromium verification, a non-gating Playwright WebKit smoke lane, and build validation
- GitHub Pages deployment is gated on a production-artifact smoke pass
- JSON export carries versioning and integrity checks
- Import fails closed on malformed or unsafe data
- Root and section-level crash containment preserve recovery and export paths
- ADRs, the risk register, the test plan, and the release checklist keep constraints visible

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
