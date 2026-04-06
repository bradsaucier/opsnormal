# Security Policy

## Supported versions

OpsNormal is maintained on the `main` branch. Security fixes are applied there first.

## Reporting a vulnerability

Use GitHub private vulnerability reporting for issues that could affect user safety, data integrity, or the published build.

Include:

1. A clear description of the issue
2. Reproduction steps
3. Browser and platform details
4. Impact assessment if known
5. Any proof-of-concept material needed to reproduce the issue safely

## Security model

OpsNormal is a client-side application with no backend, no account system, and no cloud data plane.

That changes the threat model.

The primary security concerns are not account takeover or server breach. They are:

- Dependency supply chain risk
- Browser storage handling and storage eviction behavior
- Service worker correctness and update handoff
- Exported user data files once they leave the browser sandbox
- Static hosting configuration and build integrity
- Content Security Policy drift

## Trust boundaries

Current repo truth establishes these boundaries.

- Personal readiness data is stored in browser-managed IndexedDB on the local device
- The app uses same-origin static hosting and same-origin PWA update behavior
- The repo does not contain a backend API, account model, analytics SDK, telemetry pipeline, or cloud sync path
- Exported JSON and CSV files are ordinary user-managed files once written to disk

The local-only posture reduces one class of risk and concentrates others.

It reduces:

- Server-side breach exposure for day-to-day readiness data
- Account compromise risk inside the application itself
- Third-party tracking surface

It does not remove:

- Device compromise risk
- Browser storage eviction risk
- User-managed export-file exposure after export
- Supply chain risk in dependencies and GitHub Actions
- Service worker caching and update-handling defects

## What the app does to reduce risk

Current repo controls include:

- Restrictive Content Security Policy in `index.html`
- Same-origin-only runtime policy through CSP directives such as `script-src 'self'`, `worker-src 'self'`, and `connect-src 'self'`
- Guarded IndexedDB operations with bounded reopen logic after connection interruption
- Storage durability checks and persistent-storage requests where supported
- JSON export with SHA-256 checksum
- Import validation with checksum recomputation when present
- Import post-write verification before commit
- Root and section-level React error boundaries
- Crash fallback that preserves export access after a render fault
- CI validation across lint, typecheck, unit and integration tests, end-to-end tests, and build
- Dependabot coverage for npm and GitHub Actions dependencies

## Honest limits

OpsNormal should not be described in stronger terms than the repo proves.

Accurate statements:

- The app is local-only by design
- There is no backend data plane in the application
- The app uses a restrictive CSP
- Import and export integrity paths are verified more carefully than a typical small PWA

Inaccurate or overstated statements:

- "Your data is safe" as an absolute claim
- "Encrypted" or "secure" without qualification
- Any claim that browser storage is durable backup storage
- Any claim that export files are protected after they are written to disk

## Export-file handling

JSON and CSV exports are explicit user-controlled recovery paths. They are also plain user files.

Treat exported files as sensitive.

- Store them where you would store any other personal record
- Do not assume device-level encryption is present unless you configured it
- Do not leave exports in shared folders or uncontrolled sync targets unless that is your deliberate choice

## Browser and platform note

Safari-family storage behavior carries elevated risk for local-only apps, especially when the app is not installed to Home Screen. OpsNormal surfaces this risk in the UI and requests stronger storage posture where supported, but no browser API can turn browser-managed storage into a guaranteed archive.

## Scope note

Security review is most valuable when it covers:

- CSP bypass opportunities
- Service worker cache poisoning or update-handling defects
- Import validation bypasses
- Data-integrity failures during write, import, replace, or crash-export paths
- Conditions that could silently lose data while reporting success
- Static hosting misconfiguration

Reports that depend on architecture not present in the repo, such as backend endpoints or account workflows, are out of scope because those surfaces do not exist here.
