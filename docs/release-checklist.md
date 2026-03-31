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
- [ ] iOS install guidance reviewed
- [ ] README reflects current behavior
- [ ] ADR index reflects current architecture
- [ ] persistent storage request verified on launch
- [ ] JSON and CSV export verified on live build
- [ ] manifest icons verified after build
