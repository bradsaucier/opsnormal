# ADR 0018 - Database schema versioning and migration framework

## Status

Accepted

## Context

OpsNormal relies on IndexedDB as the only working system of record.
The repository already had Dexie schema versions and multi-tab recovery behavior, but it lacked a formal migration framework.
That gap made future schema changes too easy to handle ad hoc inside feature pull requests.
A local-only product cannot treat schema changes as an afterthought because a failed upgrade has no server-side recovery lane.

The repository also already uses a separate JSON export schema version.
That export contract is part of the recovery boundary, not a mirror of Dexie's internal database version.
Those two version lines must remain independent so database-only changes do not force unnecessary backup format churn.

## Decision

OpsNormal will define database schema changes through an ordered migration registry under `src/db/migrations/`.
Each migration module must declare:

- a strictly increasing database version
- a stable migration name for review and audit
- the Dexie `stores()` schema for that version
- an optional `upgrade()` callback when a change requires data transformation

The migration registry becomes the source of truth for database schema history.
`src/db/schema.ts` remains the compatibility layer that exposes the shared schema application helpers and the derived schema-version list used elsewhere in the repository.

Export payload schema versioning remains separate from the database migration registry.
A database schema bump does not automatically authorize a JSON export schema bump.
Only serialized backup format changes should change `EXPORT_SCHEMA_VERSION`.

The core application database instance must also surface blocked upgrade contention to the operator.
When another tab prevents an upgrade from completing, the active UI must fail closed with a visible instruction to close duplicate tabs or windows instead of hanging silently.

## Consequences

Positive:

- future schema work follows one audited pattern instead of feature-specific Dexie wiring
- isolated Dexie connections reuse the same migration registry and latest schema definition
- reviewers can inspect schema history through discrete migration files
- migration proof becomes explicit in unit, integration, and browser-level tests

Trade-offs:

- every schema change now carries a small documentation and test burden
- old migration modules remain part of the repository history and must not be rewritten casually
- data-transform upgrades still require real browser proof when risk is high

## Guardrails

This decision requires the following discipline:

- never edit a published migration in place once released; append a new migration instead
- keep `upgrade()` callbacks limited to IndexedDB transaction work only
- keep export payload versioning separate from database versioning
- add migration tests before merging any schema change
- execute browser-level upgrade proof for migration changes before merge when the durability boundary is involved
- keep the automated migration upgrade proof green for durability-sensitive changes, per ADR-0031
- do not use this framework to justify backend expansion, sync metadata, or telemetry
