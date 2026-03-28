# OpsNormal

```yaml
STATUS  : OPERATIONALLY READY
AUTHOR  : Bradley Saucier, SMSgt, USAF (Ret.)
SCOPE   : Offline-first personal readiness tracker for daily balance
LICENSE : MIT
```

[![Deploy Pages](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bradsaucier/opsnormal/actions/workflows/deploy.yml)

---

## Executive Summary

OpsNormal is a deliberately small Progressive Web App built to solve one specific failure mode:

High-performing people can keep pushing work or school until the rest of life degrades quietly in the background.

This app does not try to manage your life.
It gives you a fast, honest operating picture.

The daily interaction is simple:
1. Open the app.
2. Check five sectors.
3. Close the app.

No account.
No cloud sync.
No journaling requirement.
No analytics.

## Product Scope

### Fixed sectors
1. Work or School
2. Household
3. Relationships
4. Body
5. Rest

### Daily states
1. Unmarked
2. Nominal
3. Degraded

### MVP features
1. Five-sector daily check-in.
2. Thirty-day trailing readiness grid.
3. Local-only IndexedDB persistence.
4. Offline-capable PWA install.
5. JSON and CSV export.
6. Install guidance for iOS.
7. Typed codebase, tests, CI, and deployment.

### Explicit non-goals
1. Accounts.
2. Cloud sync.
3. Automated coaching.
4. Calendar, email, or health integrations.
5. Custom sectors in MVP.
6. Medical or psychological interpretation.

## Accessibility and Safety Commitments

1. State is never conveyed by color alone.
2. Controls maintain accessible labels and clear state transitions.
3. Buttons meet touch target expectations.
4. Reduced-motion users get instant transitions.
5. The app is a personal status tracker, not a medical device.

## Security and durability posture

1. Local-only storage through IndexedDB.
2. Export remains the recovery path.
3. Content Security Policy is enforced through a meta tag for static hosting.
4. The app requests more durable storage after the first meaningful save.
5. GitHub Pages deployment copies `index.html` to `404.html` so the SPA can recover on first navigation before the service worker is active.

## Local development

### Prerequisites
1. Node.js 24 recommended.
2. Node.js 20.19.0 minimum.
3. npm 10 or newer.

### Install
```bash
npm ci
```

### Run
```bash
npm run dev
```

### Quality gates
```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Repository standards

1. `CONTRIBUTING.md` defines contribution boundaries and quality gates.
2. `SECURITY.md` defines vulnerability reporting.
3. `CODE_OF_CONDUCT.md` establishes baseline community behavior.
4. `docs/decisions/` records key architectural constraints.

## License

MIT
