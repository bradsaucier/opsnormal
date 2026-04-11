# Risk Register

## High severity

### iOS and Safari-family storage eviction
- Risk: ordinary Safari-family browser tabs are subject to WebKit's seven-day inactivity cap on script-writable storage. After seven days of Safari use without user interaction on the site, IndexedDB, service-worker state, cache data, and browser-side backup metadata can be purged together. Private or incognito sessions also do not provide durable storage beyond the session.
- Mitigation: surface the exact platform risk explicitly, recommend Home Screen installation on Apple devices, request persistent storage without implying a guarantee, keep export available, raise a fresh-backup prompt before the seven-day window is likely to close, unit-test the storage-health decision tree, and cover the warning UI through the synthetic Chromium harness. WebKit smoke coverage is compatibility-only and does not claim to simulate eviction.
- Residual limitation: if WebKit purges the app after inactivity, it can erase both IndexedDB and the browser-side timestamp that recorded the last successful export. The app can reopen looking like a clean install. Operator guidance must instruct immediate restore from the latest JSON export when a previously used app returns blank.

### Local quota exhaustion during write operations
- Risk: browser quota pressure can abort IndexedDB writes and leave the operator without a saved check-in. Chromium now defaults ordinary IndexedDB commits to relaxed durability, which widens the crash window after write completion.
- Mitigation: guarded write paths detect quota failures, surface a clear recovery message, direct the operator to export before retry, and pin Dexie transaction durability to strict on Chromium-family browsers.

### Service worker update drift
- Risk: users stay on stale cached code.
- Mitigation: explicit update banner, cache versioning, stale cache cleanup, waiting-worker discovery when the registration becomes available, and foreground or reconnect revalidation throttled to one check per 60 seconds. Offline focus events do not consume the next online revalidation window, and manual recovery guidance stays pinned when the waiting-worker handoff stalls. Repeated controllerchange reload churn now escalates to a pinned loop-breaker banner in one tab, and manual recovery broadcasts a duplicate-tab clear signal so stale loop-breaker state does not stay pinned elsewhere.

### Uncontained React render fault
- Risk: an uncaught render error can collapse the full UI into a blank screen at the worst possible moment.
- Mitigation: root and section-level error boundaries contain faults, keep Today, history, and backup or recovery isolated where possible, keep recovery actions visible, preserve export access from the crash screen, and keep the backup or recovery fallback on the isolated crash-export helper backed by a temporary Dexie connection.
- Residual limitation: if malformed or corrupted IndexedDB data crashes the app again during initial mount, the boundary now exposes a self-service reset path. Database deletion can still fail when another tab keeps the store locked, so some cases may still require closing duplicate tabs or using browser site-data controls.

## Medium severity

### Safari IndexedDB connection interruption
- Risk: browser or WebKit faults can close the IndexedDB connection mid-session.
- Mitigation: monitor Dexie close events, retry bounded reopen with operator-visible diagnostics, verify the next critical write, schedule a full reload if the connection cannot be restored cleanly, and prompt for a fresh JSON backup after instability is detected.

### Multi-tab schema upgrade blocking
- Risk: one tab can hold an old IndexedDB connection open and block a schema upgrade in a newer tab.
- Mitigation: listen for Dexie version-change events, close the stale handle, reload so the new schema can open cleanly, and block tight reload loops if the handoff is unstable.

### Date drift bugs
- Risk: timezone shifts break daily boundaries.
- Mitigation: store local dates as YYYY-MM-DD only.

### Circular React state loops
- Risk: unnecessary effects or circular render logic degrade quality.
- Mitigation: database-driven reactivity through Dexie live queries instead of manual sync layers.

### Render-fault crash loops from malformed persistent data
- Risk: if IndexedDB contains data that causes a render error on every mount, the error boundary will fire on every retry and keep the app in a crash loop.
- Mitigation: the crash fallback preserves export, reload, and a gated self-service database reset path. If deletion is blocked by another open tab or browser-level storage failure, the operator may still need browser site-data controls before restoring from backup.

### Accessibility regressions
- Risk: visual polish reduces contrast or state clarity.
- Mitigation: treat state text markers and contrast as release blockers.
