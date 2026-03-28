# Risk Register

## High severity

### iOS storage eviction for non-installed PWAs
- Risk: Safari can clear script-writable storage for non-installed origins after inactivity.
- Mitigation: push Home Screen installation, request persistent storage, and keep export available.

### Service worker update drift
- Risk: users stay on stale cached code.
- Mitigation: explicit update banner, cache versioning, and stale cache cleanup.

## Medium severity

### Date drift bugs
- Risk: timezone shifts break daily boundaries.
- Mitigation: store local dates as YYYY-MM-DD only.

### Circular React state loops
- Risk: unnecessary effects or circular render logic degrade quality.
- Mitigation: database-driven reactivity through Dexie live queries instead of manual sync layers.

### Accessibility regressions
- Risk: visual polish reduces contrast or state clarity.
- Mitigation: treat state text markers and contrast as release blockers.
