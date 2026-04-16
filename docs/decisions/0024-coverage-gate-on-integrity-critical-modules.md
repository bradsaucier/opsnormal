# ADR 0024 - Coverage gate on integrity-critical modules

## Status

Accepted

## Context

ADR-0009 commits OpsNormal to read-back verification on the daily write path.
ADR-0012 commits OpsNormal to fail-closed import commit verification inside the IndexedDB transaction.
Those guarantees live in `src/db/appDb.ts` and `src/services/importService.ts`,
but the targeted Vitest gate only enforced narrower modules.

The repository already uses targeted per-file coverage thresholds to keep the highest-risk logic from drifting.
Leaving these two modules outside that gate created a direct gap between documented integrity claims and automated enforcement.
After targeted test backfill, the first calibration run measured `src/services/importService.ts` at 95.00 percent statements, 81.81 percent branches, 100.00 percent functions, and 94.92 percent lines.
The same run measured `src/db/appDb.ts` at 89.09 percent statements, 79.56 percent branches, 90.38 percent functions, and 89.04 percent lines.

## Decision

Add `src/services/importService.ts` and `src/db/appDb.ts` to the targeted coverage module list in `vitest.config.ts` and enforce per-file thresholds derived from the measured post-backfill baseline.
`src/services/importService.ts` is gated at 95 percent statements, 80 percent branches, 100 percent functions, and 94 percent lines.
`src/db/appDb.ts` is gated at 89 percent statements, 78 percent branches, 90 percent functions, and 89 percent lines.
This follows the calibration rule for newly promoted integrity-critical modules: floor(measured) for lines, functions, and statements, and floor(measured) minus one for branches.

## Consequences

Positive:

- the repository's strongest integrity claims now sit inside the targeted coverage gate instead of outside it
- refactors that weaken fail-closed import verification or daily write read-back verification now have to explain a coverage regression in review

Trade-offs:

- `src/db/appDb.ts` keeps a lower branch floor than `src/services/importService.ts` because browser-runtime recovery paths and the e2e-only test hook are still harder to reach in the normal jsdom lane
- future test additions should ratchet these thresholds upward instead of relying on the aggregate floor to protect integrity-critical code
