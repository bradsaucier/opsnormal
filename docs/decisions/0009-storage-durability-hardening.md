# ADR 0009 - Storage Durability Hardening

## Status
Accepted

## Context

OpsNormal is local-first by design.
IndexedDB is the system of record.
If browser storage is evicted or the database connection drops mid-session,
the operator can lose trust in the only persistence layer that exists.

The project already supported export and validated recovery.
The missing lane was active storage durability posture:
requesting persistent storage, monitoring quota telemetry,
and converting opaque browser storage faults into explicit recovery guidance.

## Decision

Add a storage durability layer that:
- checks current persistence status on launch and requests persistent storage after a meaningful local save
- checks quota and usage telemetry when supported
- surfaces storage posture in both the header and backup panel
- guards write paths so quota failures and dropped IndexedDB connections return direct recovery messages
- reopens the Dexie database after closure before the next operation

## Consequences

Positive:
- lower risk of silent data eviction
- clearer operator awareness of current durability posture
- lower chance of opaque write failures under quota pressure or browser faults
- no schema migration and no backend expansion

Trade-offs:
- persistent storage remains best-effort because browser enforcement differs by platform and the UI must not imply a guarantee
- quota telemetry may be unavailable or approximate on some browsers
- real-device Safari testing remains necessary because simulated IndexedDB environments do not reproduce every storage fault mode
