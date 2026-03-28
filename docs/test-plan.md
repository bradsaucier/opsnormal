# Test Plan

## Objectives

Prove that the app:
- stores daily entries reliably
- derives view state correctly
- survives page reloads
- reopens offline after first load
- exports consistent data

## Layers

### Unit tests
- date formatting and parsing
- trailing 30-day range generation
- export formatting
- streak computation

### Integration tests
- Dexie persistence behavior
- compound key uniqueness
- cycle sequence correctness

### End-to-end tests
- daily check-in persists through reload
- production preview can reopen offline after first load

## Coverage posture

Target:
- 70 percent or better on core logic
- 100 percent on date helpers and export helpers


## Chromium-only note

Playwright service worker validation is limited to Chromium. Offline reopen is still worth testing manually on Safari and mobile hardware before release.
