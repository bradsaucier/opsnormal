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
- retries the request automatically when the shared-origin install posture changes in browsers that keep the same storage bucket
- exposes an operator-controlled durable-storage request in the export panel, beside the existing backup boundary
- checks quota and usage telemetry when supported
- surfaces storage posture in both the header and backup panel
- guards write paths so quota failures and dropped IndexedDB connections return direct recovery messages
- reopens the Dexie database after closure with bounded retry and operator-visible diagnostics before the next operation, then schedules a full reload if the handle remains unrecoverable
- verifies the daily check-in write path with a post-commit read-back so silent local write loss becomes explicit
- carries storage durability diagnostics into crash-state JSON exports without changing the local-only product boundary, while keeping those diagnostics inside the checksum envelope

## Consequences

Positive:

- lower risk of sticky persistence denials after a shared-origin install transition
- clearer operator awareness of current durability posture
- lower chance of opaque write failures under quota pressure or browser faults
- import completion can immediately refresh durability posture instead of waiting for another save
- no schema migration and no backend expansion

Trade-offs:

- persistent storage remains best-effort because browser enforcement differs by platform and the UI must not imply a guarantee
- Chromium-family browsers can silently deny repeated durability requests, so the export-panel action enforces a 60-second cooldown after a denied manual retry
- iPhone and iPad Home Screen PWAs launch in a fresh isolated origin container, so browser-tab attempt context does not carry into the installed app; operators still need the explicit export-then-import path when moving into that isolated container
- quota telemetry may be unavailable or approximate on some browsers
- real-device Safari testing remains necessary because simulated IndexedDB environments do not reproduce every storage fault mode
