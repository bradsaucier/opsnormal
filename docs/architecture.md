# Architecture Overview

## Goal

OpsNormal exists to provide a sub-10-second daily readiness check that remains usable when the operator is overloaded.

## Design constraints

- local-first only
- deterministic state model
- no backend
- no third-party APIs
- no account system
- minimal cognitive load
- strong verification story

## Runtime shape

1. The Today panel issues writes through `cycleDailyStatus()`.
2. Dexie persists rows in IndexedDB under a compound unique key.
3. `useLiveQuery()` reacts to database changes without separate client-side state orchestration.
4. History and export views consume the same persistence layer.
5. The historical telemetry surface uses a bifurcated render path: wider viewports keep the full 30-column grid, while narrow viewports shift into week-paginated 7-day windows with a daily brief.
6. The PWA service worker is registered through the Vite PWA virtual module path already used by the app.
7. The deployed app performs a guarded low-frequency service worker revalidation loop so long-lived sessions can discover newer builds without noisy churn.

## Storage durability layer

OpsNormal now treats storage durability as a first-class operational concern.
The `src/lib/storage.ts` module requests persistent storage when the platform supports it,
checks browser quota telemetry, distinguishes installed iPhone and iPad Home Screen mode from ordinary Safari tabs, and formats operator-facing durability status.
The `src/hooks/useStorageHealth.ts` hook checks current posture on launch, refreshes on focus,
and uses a low-frequency interval so the UI reflects current browser conditions without noisy churn.
Persistent storage is requested after a meaningful local save instead of at cold start so the request lands in a clearer user-action context.
On Chromium-family browsers, Dexie now pins transaction durability to strict so successful write completion waits on the stronger commit path instead of the relaxed default.

The database layer now watches Dexie close events and version-change events.
If the IndexedDB connection drops, `reopenIfClosed()` re-establishes the handle before the next read or write.
If another tab advances the schema, the current tab closes its handle and reloads so the upgrade does not sit blocked behind stale code. A reload guard prevents tight version-change loops from thrashing the browser if the handoff is unstable.
Write paths route through guarded operations so quota failures and interrupted database connections surface as explicit user-facing errors instead of opaque transaction aborts.

React error boundaries now provide render-fault containment at two levels.
A root boundary keeps the app from collapsing into a white screen and preserves direct export actions on the crash fallback.
A second boundary isolates the 30-day history grid so a panel fault does not take Today, backup, or install controls offline.

The app shell now uses dynamic viewport height plus safe-area inset padding so installed mobile mode keeps the first and last controls clear of the status bar, home indicator, and toolbar transitions. The history shell applies client-side week pagination without duplicating Dexie queries or index work, and narrow-screen history uses native day selection controls instead of desktop grid semantics so dense historical data remains readable without shrinking the interaction model into noise.

## Why this matters

The architecture is intentionally narrow.
The point is not feature count.
The point is reliable daily use under stress.

## Deployment hardening

The Vite build now emits all static assets as files instead of inlining small assets into application bundles. This keeps cache behavior on static hosting explicit and avoids needless bundle churn when a small asset changes.

The Dexie schema now advances through Version 2. The runtime keeps the unique compound key on `[date+sectorId]`, removes redundant standalone indexes that did not provide query coverage, and routes live queries through compound-key prefix scans so the data path matches the actual index layout instead of relying on removed secondary indexes.

JSON export computes its checksum before any database write transaction is involved. Import validates structure and checksum first, computes the expected final state in memory, writes inside one Dexie transaction, then verifies the written rows before that transaction can commit. If verification fails, the transaction aborts and IndexedDB keeps the pre-import state intact. Session-scoped undo remains available after a successful import.

The automated verification posture is split cleanly. Playwright proves Chromium service worker registration. Vitest proves the update banner contract. Real deployed update behavior remains a manual release check.
