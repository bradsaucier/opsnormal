# Risk Register

## High severity

### iOS storage eviction for non-installed PWAs
- Risk: Safari can clear script-writable storage for non-installed origins after inactivity.
- Mitigation: push Home Screen installation, request persistent storage, surface durability posture, and keep export available.

### Local quota exhaustion during write operations
- Risk: browser quota pressure can abort IndexedDB writes and leave the operator without a saved check-in.
- Mitigation: guarded write paths detect quota failures, surface a clear recovery message, and direct the operator to export before retry.

### Service worker update drift
- Risk: users stay on stale cached code.
- Mitigation: explicit update banner, cache versioning, and stale cache cleanup.

## Medium severity

### Safari IndexedDB connection interruption
- Risk: browser or WebKit faults can close the IndexedDB connection mid-session.
- Mitigation: monitor Dexie close events, reopen the database before the next operation, and return a direct recovery message if the connection cannot be restored cleanly.

### Date drift bugs
- Risk: timezone shifts break daily boundaries.
- Mitigation: store local dates as YYYY-MM-DD only.

### Circular React state loops
- Risk: unnecessary effects or circular render logic degrade quality.
- Mitigation: database-driven reactivity through Dexie live queries instead of manual sync layers.

### Accessibility regressions
- Risk: visual polish reduces contrast or state clarity.
- Mitigation: treat state text markers and contrast as release blockers.
