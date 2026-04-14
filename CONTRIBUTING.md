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
6. New alert-like surfaces must compose `AlertSurface`; do not inline clip-notched banner scaffolding.
7. Field-level validation should stay inline. Reserve `AlertSurface` for page-level, section-level, and support-banner surfaces.

## Local setup

```bash
npm ci
npm run dev
```

A pre-commit hook runs `lint-staged` automatically after install. It fixes staged formatting drift before commit and blocks the commit if ESLint leaves unresolved errors. Use `npm run format` for a full local rewrite and `npm run format:check` for the non-mutating gate.

`npm run build` emits `dist/404.html` from the built `dist/index.html` so GitHub Pages keeps the SPA route fallback aligned to the exact shipped artifact without a second build step.

## Quality gates

Run these before opening a pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:webkit
npm run build
```

`npm run test` enforces the targeted Vitest coverage gate defined in `vitest.config.ts`. That gate is incremental on purpose. It tracks the critical modules named in `coverage.include`, counts those files even when a test path forgets to import one, and keeps the report available on failure so the next edit can close the exact gap instead of guessing.

## Pull requests

1. Keep changes scoped and explain the operational reason for the change.
2. Update tests and docs when behavior changes.
3. Do not commit build output, coverage output, or local tooling artifacts.
4. Keep language clinical and professional throughout the repo.
5. Any database schema change must add or update the migration registry, migration tests, and the relevant ADR before merge.
6. Any durability-sensitive migration change must include browser-level upgrade proof before merge, not just unit coverage.
7. The narrow WebKit smoke lane now gates CI. Keep it scoped to engine-level compatibility proof, not Safari policy simulation.
8. If a WebKit smoke failure is accepted as a platform boundary instead of a product bug, document that boundary in docs/webkit-limitations.md before merge.
9. When a module encodes a non-obvious architectural constraint, keep a short `// Architecture:` ADR reference comment near that boundary so future changes do not have to rediscover the rationale.
