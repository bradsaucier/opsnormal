# Release Checklist

Before tagging a release:

- [ ] lint passes
- [ ] typecheck passes
- [ ] unit and integration tests pass
- [ ] Playwright tests pass
- [ ] Vitest accessibility assertions pass on the direct-select check-in and history surfaces
- [ ] WCAG 2.1 A and AA Playwright accessibility scans pass with service workers blocked in the dedicated accessibility project
- [ ] direct-select radiogroup ARIA snapshot passes and only changes when the intended accessibility tree changes
- [ ] production build passes
- [ ] service worker registration smoke test passes in Chromium
- [ ] synthetic service worker update lifecycle Playwright proof passes in Chromium
- [ ] deployed service worker update smoke check verified manually after a worker change with Chrome DevTools "Update on reload" disabled
- [ ] with Chrome DevTools open, stage a waiting worker, background the tab, return to the app, and confirm the update banner appears without waiting for the hourly revalidation interval
- [ ] repeated focus or visibility churn inside 60 seconds does not trigger repeated update checks or repeated banner surfacing for the same dismissed waiting worker
- [ ] offline foreground return does not consume the first reconnect-triggered update check when connectivity resumes
- [ ] stalled multi-tab update handoff escalates to pinned recovery guidance instead of silently failing
- [ ] repeated automatic controllerchange reloads escalate to pinned loop-breaker guidance instead of continuing reload churn
- [ ] manual recovery in one tab clears stale loop-breaker state in another open tab
- [ ] blocked duplicate-tab schema recovery completes after the 5000 millisecond guard window without entering a reload loop
- [ ] offline reopen verified manually
- [ ] export verified manually
- [ ] root crash fallback verified manually where browser-specific behavior still matters
- [ ] history grid crash containment verified manually
- [ ] mobile history region no longer announces a custom carousel role and is verified with at least one mobile screen reader path
- [ ] iOS install guidance reviewed
- [ ] README reflects current behavior
- [ ] ADR index reflects current architecture
- [ ] persistent storage request verified after a meaningful local save
- [ ] storage durability indicator verified for install path, reconnect state, and write verification state
- [ ] forced close recovery verified with bounded reopen and operator-visible guidance
- [ ] crash-state JSON export includes storage durability diagnostics inside the verified checksum envelope and remains importable
- [ ] JSON and CSV export verified on live build
- [ ] replace import verified with pre-import undo restore
- [ ] replace import verified with transactional post-write validation and pre-import state preserved on forced failure
- [ ] manifest icons verified after build

- [ ] error boundary crash fallback renders correctly when a component throws
- [ ] crash-state JSON and CSV export works from the root fallback outside the automated Chromium coverage path
- [ ] sectional boundary shows fallback when history grid is artificially faulted
- [ ] retry from crash fallback recovers cleanly
- [ ] reload from crash fallback performs a full page reload
- [ ] clear-data reset remains locked until export or explicit destructive acknowledgment
- [ ] clear-data reset deletes IndexedDB and reboots cleanly after a forced crash-state recovery drill
- [ ] unrecoverable storage reconnect failure schedules a full page reload after diagnostics are surfaced
