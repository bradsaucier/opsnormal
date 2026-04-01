# Release Checklist

Before tagging a release:

- [ ] lint passes
- [ ] typecheck passes
- [ ] unit and integration tests pass
- [ ] Playwright tests pass
- [ ] production build passes
- [ ] service worker registration smoke test passes in Chromium
- [ ] service worker update banner verified manually after a deployed worker change
- [ ] offline reopen verified manually
- [ ] export verified manually
- [ ] root crash fallback verified manually
- [ ] history grid crash containment verified manually
- [ ] iOS install guidance reviewed
- [ ] README reflects current behavior
- [ ] ADR index reflects current architecture
- [ ] persistent storage request verified on launch
- [ ] JSON and CSV export verified on live build
- [ ] manifest icons verified after build

- [ ] error boundary crash fallback renders correctly when a component throws
- [ ] crash-state JSON and CSV export works from the root fallback
- [ ] sectional boundary shows fallback when history grid is artificially faulted
- [ ] retry from crash fallback recovers cleanly
- [ ] reload from crash fallback performs a full page reload
