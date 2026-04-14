# OpsNormal

```yaml
tagline: 'Local-only readiness tracking with deliberate constraints and operator-controlled recovery.'
```

[![Pipeline: Mainline Integrity](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![Pipeline: Pages Release](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)
[![Data posture: Local only](https://img.shields.io/badge/Data_Posture-Local_Only-36476F?style=flat-square)](#trust-and-transparency)

<p align="center">
  <img src="./docs/images/desktop-readiness-grid.png" width="920" alt="Desktop interface displaying a 30-day readiness grid across five sectors and a detailed daily summary.">
</p>
<p align="center">Desktop view: 30-day trailing grid and daily summary.</p>
<p align="center">
  <img src="./docs/images/desktop-daily-checkin.png" width="920" alt="Desktop interface displaying the direct daily check-in surface across the five fixed readiness sectors.">
</p>
<p align="center">Today panel: direct daily check-in across the five fixed sectors.</p>

OpsNormal is a local-only Progressive Web App for fast daily readiness tracking across five fixed sectors: Work or School, Household, Relationships, Body, and Rest.

No backend. No account. No cloud sync. No analytics. After the first successful load, the app can reopen offline. Readiness records stay in browser-managed storage until you export them to a file you control.

## BLUF

> [!IMPORTANT]
> **OpsNormal is built for one job: preserve a usable daily readiness signal with a local-only operating model and explicit recovery discipline.**
>
> Five sectors. Three states. One trailing 30-day picture.
>
> No account system, no backend data plane, no analytics path, and no cloud-sync layer.
>
> The trade is deliberate: control stays with the operator, and backup responsibility stays there too.

## What this is

- Static PWA with same-origin asset and service-worker behavior
- Local-only readiness tracking backed by IndexedDB through Dexie
- Desktop 30-day history plus a narrow-screen mobile history path
- JSON and CSV export, validated import, explicit replace gating, and undo support

## Why we chose these constraints

These are not missing features. They are deliberate choices that protect the operating model.

- No accounts or cloud sync keeps the readiness signal under operator control and removes the platform risk that comes with a hosted data plane
- Five fixed sectors and three states keep the model legible under stress and preserve day-to-day comparability
- Local-only storage with export as the durable boundary keeps recovery deliberate instead of pretending browser storage is permanent
- Static PWA delivery keeps deployment simple, same-origin, and usable anywhere a standards-compliant browser exists
- Explicit operational boundaries keep storage risk, export responsibility, crash recovery, and accessibility requirements visible instead of implied

### What this is not

- Not an account-based product
- Not a cloud-sync tool
- Not a free-form journal or custom-category tracker
- Not a permanent archive unless you export
- Not a medical device or source of medical or psychological advice

## Quick start

### Use the deployed app

1. Open `https://opsnormal.app`
2. If you are validating a Pages rollout or DNS cutover, the fallback deployment URL is `https://bradsaucier.github.io/opsnormal/`
3. On Apple devices, decide first where you will rely on the app. Ordinary Safari tabs are subject to WebKit's seven-day storage purge after seven days of Safari use without user interaction on the site.
4. If you plan to rely on the app on iPhone or iPad, install it to Home Screen before entering data. Safari browser tabs and installed Home Screen apps keep isolated website data on Apple platforms.
5. If you already entered data in Safari on an Apple device, run a JSON export there first. Then install to Home Screen, open the installed app, and import that JSON file. Installation does not migrate Safari-tab data into the installed app automatically.
6. Record an initial status across the five fixed sectors in the environment you intend to keep using
7. Run a test JSON export and keep the file somewhere you control
8. Export routinely, especially before browser maintenance, profile changes, device transitions, or long periods of inactivity

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
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:webkit
npm run build
npm run test:e2e:smoke
```

`npm run format:check` verifies repository formatting with Prettier, and `npm run format` applies the repository formatting baseline locally. `npm run test:e2e` builds the e2e-mode harness bundle and runs the full Chromium suite. `npm run test:e2e:webkit` runs the narrow WebKit smoke gate that verifies rendering and IndexedDB I/O on a WebKit engine without claiming to reproduce Safari eviction behavior. Run `npm run build` before `npm run test:e2e:smoke` so the smoke command reuses a real production `dist/` build and skips the harness-only specs. That is the same production-artifact gate used by the GitHub Pages deployment workflow.

</details>

<a id="local-only-and-trust-boundary"></a>

## Trust and transparency

Local-only means no server can lose your readiness record. It also means no server can save it. Browser-managed storage remains a best-effort environment, not a durable archive.

### Storage model

- Readiness data is stored in IndexedDB through Dexie
- The shell requests persistent storage through the Storage API when the browser exposes it, but grant behavior is browser-managed, not guaranteed, and does not override Safari-tab inactivity policy
- Same-origin asset fetches and service-worker lifecycle traffic still exist
- There is no backend data plane for readiness records

### What the repo can promise

- Core use stays local to the device after the first successful load
- Export creates operator-controlled JSON and CSV files
- Import validates structure before commit and fails closed on malformed or unsafe data
- Root-level and section-level error boundaries preserve recovery surfaces and keep export reachable during localized render failures
- Backup action prompts escalate when storage diagnostics or Safari-tab risk make a fresh JSON export urgent

### What the repo will not promise

- Browser-managed storage is not a backup system
- Private, incognito, and other ephemeral browsing modes do not provide persistent storage guarantees. IndexedDB can be blocked there, or data can exist only for that private session and is destroyed when the session ends
- In Safari on macOS and browser tabs on iPhone or iPad, WebKit can purge script-writable storage after seven days of Safari use without user interaction on the site. IndexedDB, service-worker state, and cached assets can be purged together
- On Apple devices, Safari browser tabs and installed Home Screen apps keep isolated website data. Installing after entering data in Safari does not migrate that data automatically
- If Safari purges the app after inactivity, it can erase both the readiness database and the browser-side timestamp that recorded the last export. The app may reopen looking like a clean install. Restore from the latest JSON export immediately
- On all platforms, clearing site data, switching profiles, quota pressure, browser eviction, browser updates, or device loss can destroy records

You are responsible for exporting and backing up the data you intend to keep. Run a test export early. Export routinely. Keep important JSON exports in more than one location you control. When the shell raises a backup action prompt, treat it as a direct order to refresh the JSON export.

## Core views

- Today panel for direct daily entry
- Desktop 30-day history grid for pattern recognition
- Week-paginated mobile history with a daily brief on narrow screens
- Export and import surface for backup, recovery, preview, merge, replace, and undo flows

## Browser compatibility

OpsNormal keeps browser claims narrow and tied to actual repo evidence.

| Browser surface             | Current posture        | Verification truth                                                                  |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| Chromium-based browsers     | Supported              | Full Playwright Chromium coverage, production-artifact smoke, and release gating    |
| Safari and other WebKit UIs | Supported with caveats | Merge-blocking and release WebKit smoke lanes prove engine compatibility only       |
| Firefox current release     | Expected to work       | Manual verification recommended because there is no dedicated Firefox CI lane today |

Read [WebKit CI coverage boundary](./docs/webkit-limitations.md) before making stronger Safari claims than the repo proves.

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

| Sector         | Purpose                                  |
| -------------- | ---------------------------------------- |
| Work or School | Daily load from the main duty lane       |
| Household      | Home and admin pressure                  |
| Relationships  | Family, social, and close-support strain |
| Body           | Physical state and recovery              |
| Rest           | Sleep, decompression, and reset quality  |

### States

| State    | Meaning                                        |
| -------- | ---------------------------------------------- |
| Unmarked | No status recorded for that sector on that day |
| Nominal  | Holding together                               |
| Degraded | Needs attention                                |

## Built for reliability and accessibility

Accessibility is architectural. Recovery is preserved even when part of the interface fails.

Accessibility posture:

- Skip link to the main surface
- Persistent live regions for state changes
- Radio-style direct selection controls with programmatic checked state
- Desktop history keyboard navigation and mobile day selection with a daily brief
- Focus treatment designed to stay visible on the clipped cockpit geometry
- State encoding that does not rely on color alone

Recovery posture:

- Root-level and section-level error boundaries contain render faults instead of allowing full-application unmount and blank-screen failure
- Recovery surfaces keep JSON and CSV export reachable, including the crash-state export path
- Backup action prompts escalate when Safari-tab risk, quota pressure, or storage instability make a fresh JSON export urgent
- Import validation, replace gating, and fail-closed commit verification prevent silent corruption
- Undo support remains available for data correction and pre-replace recovery drills

## How we ensure quality

Quality is enforced through release gates, test coverage, and explicit design constraints.

- GitHub Actions runs lint, typecheck, Vitest coverage, Playwright Chromium verification, a merge-blocking Playwright WebKit smoke lane, and build validation
- GitHub Pages deployment is gated on a production-artifact smoke pass
- JSON export carries versioning and integrity checks
- Save-picker pre-replace backups are read back before the app claims a verified disk write, and fallback Blob downloads keep a conservative delayed-revoke cleanup window
- Import fails closed on malformed or unsafe data
- Root-level and section-level error boundaries preserve recovery and export paths
- ADRs, the risk register, the test plan, and the release checklist keep constraints visible so the repo cannot drift quietly

## Learn more

This README stays focused on orientation and first use. Deeper proof, limits, and design constraints live in the repo docs.

| Document                                                    | What it covers                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Architecture overview](./docs/architecture.md)             | Runtime shape, persistence model, recovery posture, PWA behavior, and known limits                   |
| [Risk register](./docs/risk-register.md)                    | Known operational risks, browser-storage hazards, and current mitigations                            |
| [WebKit CI coverage boundary](./docs/webkit-limitations.md) | What the merge-blocking WebKit lane proves, what it cannot prove, and how to triage failures         |
| [Architecture Decision Records](./docs/decisions/README.md) | Why the repo chose IndexedDB, local-only boundaries, export integrity rules, and related constraints |
| [Test plan](./docs/test-plan.md)                            | Verification strategy, release checks, and coverage priorities                                       |
| [Release checklist](./docs/release-checklist.md)            | Pre-release validation and operator-facing quality gates                                             |
| [Changelog](./CHANGELOG.md)                                 | Public release history                                                                               |
| [Security policy](./SECURITY.md)                            | Security model, trust boundaries, and accurate claim limits                                          |
| [Design tokens](./docs/design-tokens.md)                    | Visual language, structural colors, state colors, and clipped geometry                               |
| [Contributing guide](./CONTRIBUTING.md)                     | Contribution rules that preserve repo scope                                                          |
| [Support policy](./SUPPORT.md)                              | Question paths, vulnerability reporting, and funding posture                                         |
| [Code of conduct](./CODE_OF_CONDUCT.md)                     | Expected project conduct                                                                             |

These docs exist because the constraints are part of the product and should stay visible.

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
