# Test Plan

## Objectives

Prove that the app:

- stores daily entries reliably
- derives view state correctly
- survives page reloads
- reopens offline after first load
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
- stale verified import warning and acknowledgment gate
- incompatible and checksum-failed import preview rejection states
- destructive replace arm-disarm path without a timer
- read-back verified save path before full replace when the browser exposes a save picker
- manual backup acknowledgment fallback before full replace when verified save is unavailable or cannot be read back for proof
- picker read-back permission failure preserves the underlying DOMException cause for local debugging
- fallback Blob download keeps the object URL alive on a conservative delayed-revoke path before cleanup
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
- narrow WebKit smoke coverage now gates CI for app boot, Apple WebKit warning rendering, and IndexedDB persistence without claiming eviction simulation
- production preview can reopen offline after first load
- JSON export can be imported into a clean browser context and re-exported without data loss
- import preview and staged merge path hold under the accordion backup panel
- stale verified backups stay locked until the operator acknowledges the staged file risk
- incompatible and checksum-failed backups stay in read-only preview mode with no write path
- replace stays locked until the backup checkpoint is complete, then requires separate arm and execute actions
- mobile history week pagination, daily brief selection, and week-navigation semantics hold under a narrow viewport
- CSP-sensitive runtime paths do not emit browser refusal errors during normal boot in Chromium, including the narrow mobile history path
- root crash fallback exports valid JSON and CSV after a controlled render fault, the crash-state JSON remains importable in a clean browser context, and the fallback does not emit CSP violations in Chromium
- sectional boundaries are unit-tested for reset-key recovery and retry recovery, and manual release checks verify that Today, history, and backup or recovery faults do not collapse sibling panels
- ExportPanel fallback keeps emergency JSON and CSV export available through the isolated crash-export helper after a controlled render fault
- synthetic PWA update handoff proof covers update prompt application, controller handoff, second-tab schema reload recovery, the session-scoped loop-breaker banner, and duplicate-tab recovery clear propagation in Chromium
- session-scoped 5000 millisecond schema reload guard remains loop-safe and fail-open when storage access is denied
- production-artifact smoke gating reuses an already-built `dist/` bundle and excludes the harness-only crash and fallback specs that require e2e-mode fixture pages
- dedicated WCAG 2.1 A and AA Playwright scans cover the desktop app shell, the direct-select radiogroup pattern, the mobile history region, the Import and Restore, Undo and Recovery, and Storage Health recovery sections, the Backup Action Banner warning state, the database-upgrade-blocked alert, and the boot-fallback and crash-fallback harness pages, all with service workers blocked for deterministic DOM evaluation
- ARIA snapshot coverage locks the direct-select radiogroup structure without snapshotting time-driven history surfaces

## Coverage posture

Targeted coverage gate:

- aggregate floor of 70 percent for lines, functions, and statements across the critical modules named in `vitest.config.ts`
- aggregate floor of 65 percent for branches across that same targeted module set
- explicit 100 percent gates for `src/lib/date.ts` and `src/lib/exportSerialization.ts`

The coverage gate is intentionally incremental, not repository-wide. The `coverage.include` list in `vitest.config.ts` forces Vitest to count the critical modules targeted by this PR even when a file is not imported by a test path yet, and `reportOnFailure` keeps the coverage report available when CI blocks the change.

The jsdom-backed unit path uses controlled stubs for APIs such as `BroadcastChannel`, `URL.createObjectURL`, and service-worker registration lookups where the test environment cannot provide a live browser engine. Those tests prove application logic and failure handling, not full browser IPC or background-thread execution.

Formatting gate:

- Prettier runs as a standalone repository-wide formatter
- `npm run format:check` is required locally and in CI before merge
- Husky plus lint-staged auto-fix staged formatting drift before commit

## Accessibility automation note

Vitest accessibility checks run in JSDOM and validate semantic markup only. The shared `axe` helper disables `color-contrast` because JSDOM cannot compute real browser layout or CSS color stacks. Browser-level accessibility enforcement runs in Playwright with `@axe-core/playwright`, filtered to `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`, and the dedicated accessibility project blocks service workers so cached assets cannot taint the scan target.

The recovery-surface scan set drives the `accessibility-recovery.a11y.spec.ts` file and injects synthetic storage-health state through the e2e-only `__opsNormalStorageTestApi__` hook so the warning-tone Backup Action Banner and the Storage Health signals render through their production code paths during the scan.

## Storage lifecycle automation note

Safari storage lifecycle coverage is intentionally split across three layers. Unit tests prove storage-health and backup-prompt decision logic. Chromium e2e harness tests inject synthetic storage states and verify the exact operator-facing warning surfaces. A narrow WebKit smoke lane now gates CI for rendering and IndexedDB I-O on a WebKit engine, but it does not claim to reproduce Safari's seven-day purge behavior. The exact proof boundary and triage rule live in docs/webkit-limitations.md.

No automated lane in this repository simulates Safari's seven-day script-writable-storage purge. That browser behavior depends on real Safari use over time and still requires manual verification on Apple hardware before release, including any installed Home Screen or Add to Dock path. If WebKit purges the app after inactivity, it can erase both IndexedDB and the browser-side timestamp that recorded the last export, so the shell can reopen looking like a clean install. Recovery guidance must direct the operator to restore from the latest JSON export immediately when that blank return occurs.

## Chromium-only note

Playwright service worker validation is limited to Chromium. Offline reopen is still worth testing manually on Safari and mobile hardware before release. The mobile history E2E spec also uses Chromium viewport emulation rather than a real mobile browser, so WebKit and installed-PWA behavior still require manual verification. Full local and CI coverage uses the e2e-mode harness build. The deployment lane runs a narrower production-artifact smoke pass so GitHub Pages is blocked on the real shipped bundle without publishing the harness pages.

## Manual release checks

- verify the desktop history grid keeps free horizontal scroll and does not snap to week boundaries
- verify the desktop history grid still honors keyboard traversal, including Control plus Home and Control plus End
- verify the installed PWA on physical iPhone hardware keeps the header, footer, and history controls clear of the dynamic island and home indicator
- verify the installed PWA on physical Android hardware keeps the shell stable through address-bar collapse and software-keyboard transitions
- verify the mobile history surface snaps cleanly to week boundaries, updates the daily brief after day selection, and does not leak horizontal overscroll into document navigation
- verify nested support surfaces remain visually distinct from parent shells on desktop and mobile, especially the Today direct-select tray, history detail brief, week-status chip, and footer boundary card
- verify a deployed service worker update either hands off cleanly or escalates to the pinned manual recovery path when another OpsNormal tab holds the active worker
- verify repeated controllerchange churn in one tab pins the loop-breaker banner instead of continuing automatic reloads
- verify manual recovery in one tab clears stale loop-breaker state in another open tab
- verify the recovery announcement is spoken after a hard reload into the pinned manual recovery state with at least one screen reader and browser pair
- verify Chrome DevTools "Update on reload" is disabled before manual service-worker handoff checks so the smoke test reflects normal operator behavior
- expect up to a 5000 millisecond guard-window delay before a blocked duplicate tab finishes schema-recovery reload

- Backup checkpoint tests should assert explicit result-state handling so read-back verified save, manual-verification fallback, download fallback, user cancellation, and hard failure cannot collapse into the same control path.
