# ADR 0033 - applyImport checksum recheck

## Status

Accepted

## Context

ADR-0010 requires backup corruption or modification to be detected before any import write reaches IndexedDB.
ADR-0012 requires JSON structure and checksum validation before any write.

The import preview path already validated checksums before staging a payload for the UI.
The destructive write path in `applyImport` still trusted that staged object and did not re-verify integrity at the point where the database transaction could clear and rewrite local entries.

That left the trust contract dependent on call-site discipline.
A future caller could preview through a test helper, hold a parsed object across a long UI boundary, or call `applyImport` directly without preserving the original checksum guarantee.

## Decision

`applyImport` must re-verify the SHA-256 checksum on the parsed payload immediately before opening the IndexedDB rw transaction.

Checksum-less payloads are treated as legacy-unverified and are rejected unless the caller passes an explicit `allowUnverified: true` option.
The UI sets that option only after the operator acknowledges the legacy-unverified import risk.

The checksum-skip preview helper is retained only as an internal test entry point and is no longer exported under a production-sounding name.

## Consequences

Positive:

- the destructive import write path now enforces the ADR-0010 and ADR-0012 integrity boundary directly
- a checksummed payload cannot be mutated between preview and apply without being rejected before the transaction opens
- direct or future callers cannot import checksum-less payloads without an explicit legacy opt-in
- existing verified import behavior and export format stay unchanged

Trade-offs:

- import performs one additional SHA-256 digest before opening the write transaction
- tests that intentionally use checksum-less fixtures must opt in to the legacy-unverified path
- the apply API now carries an options object for legacy compatibility control

## Guardrails

- Do not run Web Crypto digest work inside the Dexie rw transaction.
- Do not restore a public checksum-skip preview API without checksum verification.
- Keep the legacy-unverified opt-in scoped to operator-acknowledged legacy backups.
- Keep post-write read-back verification in place. The pre-write checksum gate and transaction commit proof cover different failure modes.
