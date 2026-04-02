# Test Plan

## Objectives

Prove that the app:
- stores daily entries reliably
- derives view state correctly
- survives page reloads
- reopens offline after first load
- exports consistent data
- verifies export to import round-trip integrity

## Layers

### Unit tests
- date formatting and parsing
- trailing 30-day range generation
- export formatting
- export checksum verification
- legacy import warning path
- export to import round-trip validation
- streak computation
- status cycle helpers
- desktop history grid keyboard navigation
- mobile history daily brief selection
- viewport-driven history render-path changes

### Integration tests
- Dexie persistence behavior
- compound key uniqueness
- cycle sequence correctness

### End-to-end tests
- daily check-in persists through reload
- production preview can reopen offline after first load
- JSON export can be imported into a clean browser context and re-exported without data loss
- mobile history week pagination and daily brief selection hold under a narrow viewport

## Coverage posture

Target:
- 70 percent or better on core logic
- 100 percent on date helpers and export helpers


## Chromium-only note

Playwright service worker validation is limited to Chromium. Offline reopen is still worth testing manually on Safari and mobile hardware before release. The mobile history E2E spec also uses Chromium viewport emulation rather than a real mobile browser, so WebKit and installed-PWA behavior still require manual verification.

## Manual release checks

- verify the desktop history grid keeps free horizontal scroll and does not snap to week boundaries
- verify the desktop history grid still honors keyboard traversal, including Control plus Home and Control plus End
- verify the installed PWA on physical iPhone hardware keeps the header, footer, and history controls clear of the dynamic island and home indicator
- verify the installed PWA on physical Android hardware keeps the shell stable through address-bar collapse and software-keyboard transitions
- verify the mobile history surface snaps cleanly to week boundaries, updates the daily brief after day selection, and does not leak horizontal overscroll into document navigation
