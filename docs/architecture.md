# Architecture Overview

## Goal

OpsNormal exists to provide a sub-10-second daily readiness check that remains usable when the operator is overloaded.

## Decision anchors

The current release posture and trust boundary are grounded in ADR-0005, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0012, ADR-0014, ADR-0017, ADR-0020, ADR-0021, ADR-0022, and ADR-0023.

## Product boundary

OpsNormal is intentionally narrow.

- Local-only by design
- Static PWA deployment
- No backend
- No account system
- No cloud sync
- No analytics or telemetry path
- Five fixed sectors
- Three states per sector
- 30-day trailing history window

The point is not feature count. The point is a stable daily signal with a recovery path the operator can understand.

## Core runtime shape

1. The Today panel writes directly to IndexedDB through `setDailyStatus()`.
2. Dexie persists rows under a compound unique key on `[date+sectorId]`.
3. `useLiveQuery()` drives reactive reads without a separate sync layer.
4. The app shell recalculates the local day and trailing 30-day window on visibility change, focus, and a low-frequency interval.
5. History and export read from the same persistence layer the Today panel writes to.
6. The app ships as a Vite-built PWA and registers its service worker through `vite-plugin-pwa`.

## Data model

Each persisted entry carries four business fields plus the database id.

- `date` - local day stored as `YYYY-MM-DD`
- `sectorId` - one of the five fixed sectors
- `status` - `nominal` or `degraded`
- `updatedAt` - ISO timestamp of the last write
- `id` - IndexedDB primary key

`unmarked` is a UI state, not a persisted readiness value. Clearing a sector removes the row for that `[date+sectorId]` pair.

The system records local dates as `YYYY-MM-DD` to avoid timezone drift around midnight and cross-zone interpretation.

## UI composition

The main shell is built from a small set of bounded surfaces.

- Header with product boundary and storage posture summary
- Install banner for supported browsers
- PWA update banner with manual recovery path if worker handoff stalls
- Today panel for direct daily entry
- History panel with desktop and mobile render paths
- Export panel for backup, recovery, preview, merge, replace, and undo flows
- Footer boundary statement

The visual system uses a clipped cockpit silhouette, tokenized structural colors, and fixed readiness colors. The goal is clarity under load, not decorative branding.

## History behavior

History uses one data source with two presentation paths.

- Desktop keeps the full 30-day grid with keyboard traversal
- Narrow screens switch to week-paginated 7-day windows with a daily brief
- The mobile path avoids shrinking the desktop matrix into unreadable noise

This keeps the data model stable while changing the operator interface to match the device.

## Persistence model

IndexedDB through Dexie is the system of record.

Important persistence characteristics:

- Compound uniqueness is enforced on `[date+sectorId]`
- Reads and writes route through guarded database operations
- Closed or interrupted handles trigger bounded reopen attempts
- Schema version changes close stale handles and force reload so upgrades do not sit blocked behind old tabs
- Connection-drop and write-verification diagnostics are surfaced through the storage health model

The app does not maintain a parallel client-state shadow store. Dexie is the persistence layer and the source of truth.

## Daily write path

The daily check-in path is designed to fail loudly instead of silently dropping state.

1. `setDailyStatus()` opens a read-write Dexie transaction.
2. The existing `[date+sectorId]` row is read.
3. A new row is written or the existing row is deleted when the operator clears the state.
4. After the transaction completes, the app performs a read-back verification against the expected state.
5. If verification fails, the operator gets an explicit recovery message rather than a false success signal.

This is not a claim of perfect durability. It is a claim that silent local write loss is treated as a defect surface and exposed to the operator.

## Export, import, and recovery model

Export and import are integrity-sensitive paths. The implementation is intentionally conservative.

### Export

- JSON export writes a versioned payload with metadata, entries, and a SHA-256 checksum
- The internal IndexedDB `id` stays local to the browser and is not part of the export contract
- CSV export writes a flat record for review or spreadsheet use
- Crash-state JSON export uses the same checksum envelope and can include crash diagnostics
- The app records the last successful external backup timestamp in local storage for operator awareness
- The save-picker replace checkpoint reads the saved JSON file back before the destructive path unlocks when the browser supports that proof

### Import

- Import preview validates structure before any write can stage
- Large-file preview can move parsing to a worker to keep the main UI responsive
- File size is capped and entry count is bounded
- Rejected files stay staged in a read-only preview with plain-language failure reasons instead of collapsing into a transient status only
- Legacy checksum-free payloads are allowed but flagged as unverified during preview
- Old but otherwise valid checksum-backed payloads are flagged as stale during preview and require explicit operator acknowledgment before import unlocks
- Merge and replace both compute the expected final state before commit
- Replace requires a pre-replace backup checkpoint plus separate arm and execute actions
- If the browser cannot read the saved file back for proof, replace falls back to an explicit manual acknowledgment path instead of claiming a verified write
- Fallback anchor-triggered Blob downloads keep the object URL alive on a conservative delayed-revoke window because browsers do not expose a reliable download-complete signal for this path

### Commit verification

Import writes are verified before the transaction is allowed to commit.

1. The app builds the expected final entry set in memory
2. The write transaction stages the replace or merge operation
3. The transaction reads the resulting entry set back from IndexedDB
4. If any mismatch exists, the transaction throws and IndexedDB keeps the pre-import state intact

This is the repo's strongest integrity proof surface. It should be described precisely and without exaggeration.

### Undo

A successful import returns a session-scoped undo closure that restores the pre-import snapshot. This is a convenience recovery path for the current browser session. It is not a durable backup boundary.

## Crash containment

OpsNormal uses layered fault containment.

- A root error boundary keeps the app from collapsing into a blank screen and preserves export access on the crash fallback, which renders from a same-origin recovery stylesheet instead of React inline styles
- Section-level boundaries isolate Today, the history grid, and backup or recovery so one panel fault does not collapse the rest of the shell
- The backup or recovery fallback keeps emergency JSON and CSV export online through the isolated crash-export path backed by a temporary Dexie connection even if ExportPanel fails to render
- The crash fallback includes a gated database reset path for malformed persistent data that causes repeat render faults

The design goal is graceful degradation with user-visible recovery actions.

## Storage durability model

Browser-managed storage is treated as an operational risk, especially on Apple WebKit browser-tab paths.

The storage layer currently:

- Requests persistent storage when supported
- Checks quota posture and persistence status
- Distinguishes installed iPhone and iPad Home Screen mode from ordinary Safari tabs
- Tracks connection drops, reconnect attempts, and write-verification results
- Pins Chromium-family transactions to strict durability
- Surfaces operator-facing durability messages in the UI
- Escalates a shell-level backup action prompt when storage diagnostics or Safari-tab risk make the JSON backup urgent
- Renders that prompt with alert semantics so assistive technology receives the same immediate durability warning as sighted operators

This is mitigation, not a guarantee. Browser eviction, manual site-data clearing, profile deletion, quota pressure, or device loss can still destroy local records.

## PWA and deployment truth

OpsNormal is built with Vite, React 19, TypeScript, Tailwind CSS 4, Dexie 4, and `vite-plugin-pwa`.

Deployment posture:

- Static hosting on GitHub Pages
- The production build emits `dist/404.html` from the shipped `dist/index.html` so GitHub Pages preserves the SPA fallback without a second build path
- PWA manifest and service worker generated at build time
- App shell cached for offline reopen after first successful load
- Service worker update checks performed during long-lived sessions, on foreground return, and when connectivity resumes
- Existing waiting workers are surfaced immediately when the registration becomes available so update prompts do not depend on a later interval tick
- Foreground and reconnect revalidation are throttled to at most once per 60 seconds so repeated focus churn does not spam update checks
- Offline guard prevents pointless update checks while the browser reports the device offline, and offline focus events do not consume the next online revalidation window
- Update banner escalates to pinned manual recovery guidance if waiting-worker handoff stalls
- Service worker controller handoff closes the Dexie handle before reload so schema upgrades do not compete with stale connections
- Session-scoped reload guard suppresses tight repeat reloads for both schema recovery and immediate post-handoff controllerchange churn

The app is local-only, but it is not network-absent. Same-origin static hosting and service worker update traffic still exist.

## Security posture

The repo ships with a restrictive Content Security Policy in `index.html`.

Current policy highlights:

- `default-src 'none'`
- `script-src 'self'`
- `style-src 'self'`
- `img-src 'self' data:`
- `worker-src 'self'`
- `connect-src 'self'`
- `form-action 'none'`
- `object-src 'none'`

This supports the local-only trust boundary while still allowing same-origin PWA behavior.

## Accessibility posture

Accessibility is built into the UI contract.

- Skip link to main content
- Live regions that stay mounted with `aria-atomic`
- Direct-select status controls with programmatic checked state
- Desktop history keyboard navigation
- Mobile history day selection and daily brief
- Focus indicators designed to survive clipped control geometry
- State encoding that does not rely on color alone

## Verification posture

The repo carries a stronger proof layer than most projects of this size.

- CI runs lint, typecheck, unit and integration tests, the full Playwright Chromium suite, and build validation
- GitHub Pages deployment is gated on a production-artifact Playwright smoke pass that reuses the built `dist/` output rather than rebuilding inside the deploy lane
- Automated coverage spans unit, integration, Playwright end-to-end, accessibility, and production-artifact smoke verification without relying on fragile README counts
- ADRs document architecture and trust-boundary decisions
- The docs set includes a risk register, test plan, release checklist, and design token guide
- CSP-sensitive runtime paths, crash export, import round-trip, PWA registration, mobile history, and storage behavior all have direct test coverage or explicit manual release checks

## Known limits

These are real limits, not marketing omissions.

- Browser-local storage is not a backup system
- Safari on macOS and browser tabs on iPhone or iPad are subject to WebKit's seven-day inactivity cap on script-writable storage, and private browsing does not provide durable storage beyond the session
- Exported JSON and CSV files are user-managed files and should be treated as sensitive
- The five-sector model is fixed in current scope
- The history window is intentionally limited to the trailing 30 days
- There is no cross-device sync
- The app is not a medical device and does not provide medical or psychological advice
