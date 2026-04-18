# ADR 0031 - Automated browser-level migration upgrade proof

## Status

Accepted

## Context

ADR-0018 requires browser-level upgrade proof before merging durability-sensitive migration work.
ADR-0009 and ADR-0012 already treat IndexedDB transactions as a fail-closed durability boundary, but that boundary stayed partially manual for schema upgrades.
The repository had registry-order tests and a narrow integration check, yet it did not mechanically seed a legacy database, open the current bundle in real browsers, and prove that entries survive upgrade with the compound-unique invariant intact.
That left a documented guardrail as reviewer diligence instead of a release gate.

## Decision

OpsNormal will keep a deterministic version 1 database fixture under `tests/helpers/dbMigrationFixture.ts`.
That fixture seeds the public `DailyEntry` shape, exercises multiple sectors and dates, includes an overwrite on the same `[date+sectorId]` pair, and becomes the shared proof input for migration testing.

The proof runs in two automated layers.
A Vitest integration test reopens a seeded version 1 Dexie database through the real migration registry and asserts preserved entries, intact compound uniqueness, and removal of legacy secondary indexes.
A Playwright migration drill seeds the same legacy schema through native IndexedDB, loads the application bundle, and asserts the same preservation contract in Chromium, WebKit, and Firefox release-browser lanes.

The WebKit and Firefox smoke jobs will execute the drill on pull requests.
The Pages release smoke phase will execute the drill against the CI-verified production artifact before publish.
Per ADR-0024, `src/db/migrations/index.ts` joins the targeted coverage gate with thresholds calibrated from the first passing measurement run.

## Consequences

Positive:

- browser-level migration proof becomes an enforced gate instead of a checklist item
- every future schema change inherits the same seeded upgrade contract
- release smoke now proves the shipped artifact can upgrade a seeded legacy database before Pages publish

Trade-offs:

- the WebKit and Firefox smoke lanes take slightly longer
- the shared seed fixture must stay aligned to the public `DailyEntry` contract
- Chromium keeps the migration drill off the fast default end-to-end lane and runs it in the release-artifact path instead
