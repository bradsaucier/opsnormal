# Contributing to OpsNormal

Thank you for contributing.

## Operating constraints

OpsNormal is intentionally small.
Every change should preserve these boundaries:

1. Keep the app local-only.
2. Do not add accounts, analytics, cloud sync, or background services.
3. Preserve the fixed five-sector model in the current product scope.
4. Preserve offline-first behavior and export as the recovery path.
5. Do not rely on color alone to communicate state.

## Local setup

```bash
npm ci
npm run dev
```

## Quality gates

Run these before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:webkit
npm run build
```

## Pull requests

1. Keep changes scoped and explain the operational reason for the change.
2. Update tests and docs when behavior changes.
3. Do not commit build output, coverage output, or local tooling artifacts.
4. Keep language clinical and professional throughout the repo.
5. Any database schema change must add or update the migration registry, migration tests, and the relevant ADR before merge.
6. Any durability-sensitive migration change must include browser-level upgrade proof before merge, not just unit coverage.
7. The narrow WebKit smoke lane now gates CI. Keep it scoped to engine-level compatibility proof, not Safari policy simulation.
8. If a WebKit smoke failure is accepted as a platform boundary instead of a product bug, document that boundary in docs/webkit-limitations.md before merge.
