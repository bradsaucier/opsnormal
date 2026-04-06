# Release Checklist

Before tagging a release:

- [ ] lint passes
- [ ] typecheck passes
- [ ] unit and integration tests pass
- [ ] Playwright tests pass
- [ ] production build passes
- [ ] service worker registration smoke test passes in Chromium
- [ ] service worker update banner verified manually after a deployed worker change
- [ ] stalled multi-tab update handoff surfaces manual recovery guidance instead of silently failing
- [ ] offline reopen verified manually
- [ ] export verified manually
- [ ] root crash fallback verified manually where browser-specific behavior still matters
- [ ] history grid crash containment verified manually
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
- [ ] unrecoverable storage reconnect failure schedules a full page reload after diagnostics are surfaced
