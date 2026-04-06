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

1. The Today panel issues writes through `setDailyStatus()` via direct-select status controls.
2. Dexie persists rows in IndexedDB under a compound unique key.
3. `useLiveQuery()` reacts to database changes without separate client-side state orchestration.
4. History and export views consume the same persistence layer.
5. The historical telemetry surface uses a bifurcated render path: wider viewports keep the full 30-column grid, while narrow viewports shift into week-paginated 7-day windows with a daily brief.
6. The PWA service worker is registered through the Vite PWA virtual module path already used by the app.
7. The deployed app performs a guarded low-frequency service worker revalidation loop so long-lived sessions can discover newer builds without noisy churn. The loop pauses while the browser reports the device offline so it does not burn battery or radio work when update checks cannot succeed.
8. The update path must fail closed. If the waiting worker handoff stalls, the UI surfaces explicit manual recovery guidance instead of silently pretending the update completed.

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

The app shell also keeps a persistent status live region for announced state changes without timer-based clearing and exposes a skip link that lands directly on the main operational surface. Notched interactive controls use inset focus rings so the tactical clip geometry does not shear off the visible keyboard indicator.

The app shell now uses dynamic viewport height plus safe-area inset padding so installed mobile mode keeps the first and last controls clear of the status bar, home indicator, and toolbar transitions. The history shell applies client-side week pagination without duplicating Dexie queries or index work, and narrow-screen history uses native day selection controls instead of desktop grid semantics so dense historical data remains readable without shrinking the interaction model into noise.

## Why this matters

The architecture is intentionally narrow.
The point is not feature count.
The point is reliable daily use under stress.

## Deployment hardening

The Vite build now emits all static assets as files instead of inlining small assets into application bundles. This keeps cache behavior on static hosting explicit and avoids needless bundle churn when a small asset changes.

The Dexie schema now advances through Version 2. The runtime keeps the unique compound key on `[date+sectorId]`, removes redundant standalone indexes that did not provide query coverage, and routes live queries through compound-key prefix scans so the data path matches the actual index layout instead of relying on removed secondary indexes.

JSON export computes its checksum before any database write transaction is involved. The backup panel is organized as an ARIA accordion so safe export stays forward while destructive restore paths stay collapsed until deliberately opened. Import preview parsing stays off the main UI thread for larger files and the import service still validates structure and checksum before any write can stage. For worker-backed preview, the main thread transfers the file ArrayBuffer into the worker so large payloads do not pay a structured-clone penalty before parsing begins, and the preview worker is explicitly terminated on completion, error, cancel, or component teardown. The preview remains bounded by the existing 5 MB file cap and the schema-level 10,000 entry ceiling. Import computes the expected final state in memory, writes inside one Dexie transaction in bounded bulkPut batches, then verifies the written rows before that transaction can commit. If verification fails, the transaction aborts and IndexedDB keeps the pre-import state intact. Replace import now uses a two-stage destructive flow. First, the operator must complete a pre-replace backup checkpoint. When the browser exposes a verified file save path from a secure context, the app waits for the save picker writer to close before replace can unlock. The export helper reports explicit checkpoint result states so the panel can distinguish verified save success, fallback download trigger, user cancellation, and hard failure without guessing from a boolean. When that browser capability is unavailable, the app falls back to a manual acknowledgment step after a standard export trigger and requires the operator to confirm the backup file exists on local disk before replace can arm. Second, the operator must arm replace and then execute it through a separate click with no timer-based expiry. Session-scoped undo remains available after a successful import, but it is not a durable backup boundary.

The automated verification posture is split cleanly. Playwright proves Chromium service worker registration. Vitest proves the update banner contract, including the always-mounted status region and the stalled-handoff recovery path. Real deployed update behavior remains a manual release check.
