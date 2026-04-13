# Test Plan

## Objectives

Prove that the app:
- stores daily entries reliably
- derives view state correctly
- survives page reloads
- retrieves the shipped shell offline after first controlled load on WebKit CI and reopens offline through manual release checks
- exports consistent data
- verifies export to import round-trip integrity
- blocks accessibility regressions in custom ARIA widgets and critical page flows

## Layers

### Unit tests
- date formatting and parsing
- trailing 30-day range generation
- export formatting
- shared import validation under native SubtleCrypto in a node-environment unit path
- export checksum verification, including crash-state diagnostics when present
- legacy import warning path
- destructive replace arm-disarm path without a timer
- verified save path before full replace when the browser exposes a save picker
- manual backup acknowledgment fallback before full replace when verified save is unavailable
- replace checkpoint resets if the operator leaves replace mode and comes back
- live status and alert regions stay mounted with aria-atomic set
- stalled service worker update handoff surfaces pinned recovery guidance and a direct reload path
- synthetic controllerchange Playwright drill proves the application-managed portion of the prompt-mode update handoff across duplicate tabs
- repeated automatic controllerchange reload bookkeeping escalates to a pinned manual recovery banner instead of continuing the loop
- loop-breaker bookkeeping resets cleanly when the last automatic reload attempt falls outside the active session window
- manual recovery broadcasts a duplicate-tab clear signal so another open tab does not stay pinned on stale loop-breaker state
- recovery alert-region content mutates after mount so assistive technology receives the manual recovery instruction after a hard reload
- unrecoverable IndexedDB reopen failure schedules a full page reload instead of trusting a poisoned handle
- service worker revalidation survives React Strict Mode effect replay after registration is captured
- worker-backed preview path aborts cleanly on replacement selection or component teardown
- export to import round-trip validation
- boot-failure fallback renders without inline handlers or style attributes
- streak computation
- status cycle helpers
- direct-select radio controls expose programmatic checked state
- live-region announcements stay mounted long enough for assistive-technology queues to complete
- notched controls keep visible inset focus indicators instead of clipped external outlines
- desktop history grid keyboard navigation
- mobile history daily brief selection
- viewport-driven history render-path changes
- today-panel write path uses the live local date if a direct selection lands after midnight before the shell refreshes
- today-panel save failures surface an operator-visible error and clear the sector busy state
- targeted vitest-axe checks catch semantic regressions in the direct-select check-in and history surfaces without relying on layout-dependent color contrast rules

### Integration tests
- Dexie persistence behavior
- compound key uniqueness
- cycle sequence correctness
- bounded reopen recovery after forced close
- post-write verification on the daily check-in write path

### End-to-end tests
- daily check-in persists through reload
- synthetic Safari storage warning states drive the correct backup banner, install guidance, and storage-health messaging in Chromium
- narrow WebKit smoke coverage now gates CI for app boot, Safari-family warning rendering, IndexedDB persistence, and offline shell retrieval after first controlled load without claiming eviction simulation
- production preview can reopen offline after first load
- JSON export can be imported into a clean browser context and re-exported without data loss
- import preview and staged merge path hold under the accordion backup panel
- replace stays locked until the backup checkpoint is complete, then requires separate arm and execute actions
- mobile history week pagination, daily brief selection, and week-navigation semantics hold under a narrow viewport
- CSP-sensitive runtime paths do not emit browser refusal errors during normal boot in Chromium, including the narrow mobile history path
- root crash fallback exports valid JSON and CSV after a controlled render fault, the crash-state JSON remains importable in a clean browser context, and the fallback does not emit CSP violations in Chromium
- sectional boundaries are unit-tested for reset-key recovery and retry recovery, and manual release checks verify that Today, history, and backup or recovery faults do not collapse sibling panels
- ExportPanel fallback keeps emergency JSON and CSV export available through the isolated crash-export helper after a controlled render fault
- synthetic PWA update handoff proof covers update prompt application, controller handoff, second-tab schema reload recovery, the session-scoped loop-breaker banner, and duplicate-tab recovery clear propagation in Chromium
- session-scoped 5000 millisecond schema reload guard remains loop-safe and fail-open when storage access is denied
- production-artifact smoke gating reuses an already-built `dist/` bundle and excludes the harness-only crash and fallback specs that require e2e-mode fixture pages
- dedicated WCAG 2.1 A and AA Playwright scans cover the desktop app shell, the direct-select radiogroup pattern, and the mobile history region with service workers blocked for deterministic DOM evaluation
- ARIA snapshot coverage locks the direct-select radiogroup structure without snapshotting time-driven history surfaces

## Coverage posture

Target:
- 70 percent or better on core logic
- 100 percent on date helpers and export helpers


## Accessibility automation note

Vitest accessibility checks run in JSDOM and validate semantic markup only. The shared `axe` helper disables `color-contrast` because JSDOM cannot compute real browser layout or CSS color stacks. Browser-level accessibility enforcement runs in Playwright with `@axe-core/playwright`, filtered to `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`, and the dedicated accessibility project blocks service workers so cached assets cannot taint the scan target.

## Storage lifecycle automation note

Safari storage lifecycle coverage is intentionally split across three layers. Unit tests prove storage-health and backup-prompt decision logic. Chromium e2e harness tests inject synthetic storage states and verify the exact operator-facing warning surfaces. A narrow WebKit smoke lane now gates CI for rendering, page-side service-worker readiness, offline shell retrieval after first controlled load, and IndexedDB I-O on a WebKit engine, but it does not claim to reproduce Safari's seven-day purge behavior. The exact proof boundary and triage rule live in docs/webkit-limitations.md.

No automated lane in this repository simulates Safari's seven-day script-writable-storage purge. That browser behavior depends on real Safari use over time and still requires manual verification on Apple hardware before release. If WebKit purges the app after inactivity, it can erase both IndexedDB and the browser-side timestamp that recorded the last export, so the shell can reopen looking like a clean install. Recovery guidance must direct the operator to restore from the latest JSON export immediately when that blank return occurs.

## Chromium-only note

Playwright service-worker context instrumentation is limited to Chromium. The WebKit smoke lane uses page-side `navigator.serviceWorker` proof plus offline shell retrieval from an already controlled document instead of Chromium-only service-worker APIs or offline navigation paths that are unstable in Linux WebKit CI. Offline reopen is still worth testing manually on Safari and mobile hardware before release because Apple policy behavior and installed-PWA behavior remain outside CI. The mobile history E2E spec also uses Chromium viewport emulation rather than a real mobile browser, so WebKit and installed-PWA behavior still require manual verification. Full local and CI coverage uses the e2e-mode harness build. The deployment lane runs a narrower production-artifact smoke pass so GitHub Pages is blocked on the real shipped bundle without publishing the harness pages.

## Manual release checks

- verify the desktop history grid keeps free horizontal scroll and does not snap to week boundaries
- verify the desktop history grid still honors keyboard traversal, including Control plus Home and Control plus End
- verify the installed PWA on physical iPhone hardware keeps the header, footer, and history controls clear of the dynamic island and home indicator
- verify the installed PWA on physical Android hardware keeps the shell stable through address-bar collapse and software-keyboard transitions
- verify the mobile history surface snaps cleanly to week boundaries, updates the daily brief after day selection, and does not leak horizontal overscroll into document navigation
- verify a deployed service worker update either hands off cleanly or escalates to the pinned manual recovery path when another OpsNormal tab holds the active worker
- verify repeated controllerchange churn in one tab pins the loop-breaker banner instead of continuing automatic reloads
- verify manual recovery in one tab clears stale loop-breaker state in another open tab
- verify the recovery announcement is spoken after a hard reload into the pinned manual recovery state with at least one screen reader and browser pair
- verify Chrome DevTools "Update on reload" is disabled before manual service-worker handoff checks so the smoke test reflects normal operator behavior
- expect up to a 5000 millisecond guard-window delay before a blocked duplicate tab finishes schema-recovery reload

- Backup checkpoint tests should assert explicit result-state handling so verified save, fallback download trigger, user cancellation, and hard failure cannot collapse into the same control path.
