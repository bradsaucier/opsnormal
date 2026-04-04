# OpsNormal

Local-only daily readiness tracking for fast use under load.

[![CI](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-36476F?style=flat-square)](./LICENSE)
[![Data: Local Only](https://img.shields.io/badge/Data-Local--Only-36476F?style=flat-square)](#administration-and-logistics)

Live app - https://opsnormal.app

## BLUF

OpsNormal is a deliberately narrow readiness tracker for daily use when attention is limited.

It runs as a static Progressive Web App, keeps working data on the local device, and avoids the usual cloud stack entirely. The operating model is fixed on five sectors, three states, and a trailing 30-day view so the signal stays fast and readable instead of turning into quantified-self overhead.

> [!IMPORTANT]
> No account. No backend. No cloud sync. No third-party APIs. No telemetry.
>
> Working data stays in IndexedDB on the local device unless you explicitly export it.

## Situation

Most personal tracking tools fail in one of two ways.

They either demand too much time, or they push routine personal data into infrastructure the user never asked for.

OpsNormal takes the opposite path. The interaction is intentionally coarse, intentionally fast, and intentionally local. The objective is not feature sprawl. The objective is to keep a daily signal available when life gets noisy.

## Mission capabilities

| Capability | What it does |
| --- | --- |
| Fast daily check-in | Records a daily state across five fixed sectors with one-click cycling. |
| Clear historical picture | Shows a trailing 30-day readiness view for rapid pattern recognition. |
| Mobile-ready history | Shifts narrow screens into week-paginated history with a daily brief instead of forcing a 30-column wall onto a phone. |
| Local-only persistence | Stores working data in IndexedDB through Dexie with no account model and no backend service. |
| Backup and recovery | Supports JSON export, CSV export, validated JSON import, undo after import, and crash-path export access. |
| Fail-closed replace import | Holds destructive replace behind a pre-replace backup checkpoint, explicit arming, and transactional post-write verification. |
| Durability awareness | Checks storage posture, requests persistent storage when supported, and surfaces user-facing durability status. |
| Offline-capable deployment | Ships as an installable PWA with offline reopen after first successful load. |
| Update recovery discipline | Surfaces service worker update status and escalates to manual recovery guidance if the waiting-worker handoff stalls. |
| Verification posture | Enforces lint, typecheck, unit, integration, end-to-end, and build validation in CI. |

### Core model

#### Sectors

| Fixed sectors |
| --- |
| Work or School |
| Household |
| Relationships |
| Body |
| Rest |

#### States

| State | Meaning |
| --- | --- |
| Unmarked | No status recorded for that sector on that day. |
| Nominal | Holding together. |
| Degraded | Needs attention. |

## Execution

### Use the deployed app

1. Open `https://opsnormal.app`
2. Add it to the device from the browser if you want tighter app-like use and better offline reopen behavior
3. Start using the daily check-in immediately

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

## Administration and logistics

### Data posture

Privacy here is an architectural fact, not a slogan.

> [!IMPORTANT]
> OpsNormal does not contain an account model, a backend service, analytics hooks, telemetry calls, or a cloud sync path.
>
> Data leaves the device only when the user explicitly exports it.

### Recovery posture

| Recovery surface | Current posture |
| --- | --- |
| JSON export | Writes a versioned backup payload with metadata, entries, and a SHA-256 checksum. |
| CSV export | Produces a flat external record for spreadsheet work or review. |
| JSON import | Validates structure before write and recomputes checksum when present. |
| Legacy imports | Allows older checksum-free exports, but flags them as unverified in preview. |
| Replace import | Requires a pre-replace backup checkpoint, explicit arm state, and separate execute action. |
| Post-write verification | Verifies the written state inside the same IndexedDB transaction so mismatches abort before commit. |
| Undo | Restores the pre-import snapshot for the current session after a successful import. |
| Crash fallback | Keeps export actions available if the main React shell faults. |

### Storage and local durability

OpsNormal treats durability as part of the operating model, not as an afterthought.

- Checks storage posture on launch and refreshes it over time
- Requests persistent storage after meaningful local saves when the platform supports it
- Distinguishes installed iPhone and iPad Home Screen mode from ordinary Safari tabs in the durability summary
- Reopens the IndexedDB handle if it closes unexpectedly
- Reloads when another tab advances the schema so stale code does not block an upgrade

> [!WARNING]
> Browser-local storage is working storage, not guaranteed backup storage.
>
> Manual browser data clearing, profile deletion, device loss, or storage eviction can still destroy records. Export routinely.

### Offline and update posture

| Surface | Current posture |
| --- | --- |
| Offline reopen | The app shell is cached for offline reopen after first successful load. |
| Installability | Supported browsers can install the app as a PWA. |
| Mobile shell discipline | The shell respects dynamic viewport height and safe-area constraints in installed mobile mode. |
| Update discovery | The app performs a guarded low-frequency service worker revalidation loop during long-lived sessions. |
| Offline revalidation guard | Update checks pause while the browser reports the device offline. |
| Update recovery | If the waiting-worker handoff stalls, the UI surfaces explicit manual recovery guidance instead of pretending the update completed. |

### Boundary

OpsNormal is a personal status tracking tool.

It is not a medical device. It does not diagnose, treat, cure, or prevent any disease or condition. It does not provide medical or psychological advice.

## Command and signal

This README is the executive brief. Deeper technical material lives under `./docs`.

> [!NOTE]
> Use the README to understand the product boundary, quick start path, and operating posture.
>
> Use the docs directory for deeper implementation detail.

- [Architecture overview](./docs/architecture.md)
- [Architecture Decision Records](./docs/decisions/README.md)
- [Risk register](./docs/risk-register.md)
- [Test plan](./docs/test-plan.md)
- [Release checklist](./docs/release-checklist.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## Contributing

If you want to contribute, stay inside the current operating boundary.

- Read [CONTRIBUTING.md](./CONTRIBUTING.md)
- Report security issues through [SECURITY.md](./SECURITY.md)
- Follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## License

See [LICENSE](./LICENSE).

```text
// END TRANSMISSION
```
