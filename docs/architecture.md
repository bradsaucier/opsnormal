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
5. The PWA service worker is registered through the Vite PWA virtual module path already used by the app.
6. The deployed app performs a guarded low-frequency service worker revalidation loop so long-lived sessions can discover newer builds without noisy churn.

## Storage durability layer

OpsNormal now treats storage durability as a first-class operational concern.
The `src/lib/storage.ts` module requests persistent storage when the platform supports it,
checks browser quota telemetry, and formats operator-facing durability status.
The `src/hooks/useStorageHealth.ts` hook checks current posture on launch, refreshes on focus,
and uses a low-frequency interval so the UI reflects current browser conditions without noisy churn.
Persistent storage is requested after a meaningful local save instead of at cold start so the request lands in a clearer user-action context.

The database layer now watches Dexie close events.
If the IndexedDB connection drops, `reopenIfClosed()` re-establishes the handle before the next read or write.
Write paths route through guarded operations so quota failures and interrupted database connections surface as explicit user-facing errors instead of opaque transaction aborts.

## Why this matters

The architecture is intentionally narrow.
The point is not feature count.
The point is reliable daily use under stress.

## Deployment hardening

The Vite build now emits all static assets as files instead of inlining small assets into application bundles. This keeps cache behavior on static hosting explicit and avoids needless bundle churn when a small asset changes.

The Dexie schema now advances through Version 2. The runtime keeps the unique compound key on `[date+sectorId]`, removes redundant standalone indexes that did not provide query coverage, and orders full export reads from the compound key so storage and export paths stay aligned.

The automated verification posture is split cleanly. Playwright proves Chromium service worker registration. Vitest proves the update banner contract. Real deployed update behavior remains a manual release check.
