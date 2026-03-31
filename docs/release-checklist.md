# Release Checklist

Before tagging a release:

- [ ] lint passes
- [ ] typecheck passes
- [ ] unit and integration tests pass
- [ ] Playwright tests pass
- [ ] production build passes
- [ ] service worker update banner works after a deployed service worker change
- [ ] offline reopen verified manually
- [ ] reconnect or refocus triggers a clean service worker update check without console errors
- [ ] export verified manually
- [ ] iOS install guidance reviewed
- [ ] README reflects current behavior
- [ ] ADR index reflects current architecture
- [ ] persistent storage request verified on launch
- [ ] JSON and CSV export verified on live build
- [ ] manifest icons verified after build
