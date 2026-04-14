# ADR 0010 - Export integrity checksum

## Status

Accepted

## Context

OpsNormal treats JSON export as the external backup path and validated import as the recovery path. Schema validation catches malformed files, but it cannot detect a backup file that was truncated, partially overwritten, or modified while still remaining valid JSON.

That gap matters most during replace import. A structurally valid but corrupted file could overwrite the only good browser copy.

## Decision

Add a SHA-256 checksum to every JSON export and verify it during import when present.

The checksum is computed over a canonical payload that includes:

- `app`
- `schemaVersion`
- `exportedAt`
- `entries`

The checksum field itself is excluded from the hash input.

When the browser exposes a save picker for the pre-replace backup checkpoint, the saved JSON file is read back after close and must match the expected payload before the destructive replace path can claim a verified disk write. If the browser cannot provide read-back proof, the workflow must drop to explicit manual acknowledgment instead of overstating verification.

Imports remain backward-compatible. Legacy export files without a checksum still pass validation and import normally, but the UI now flags them as unverified before the operator commits the write.

The implementation uses the platform `SubtleCrypto` API instead of adding a hashing dependency.

## Consequences

Positive:

- Detects corruption or modification before any import write reaches IndexedDB.
- Tightens the pre-replace backup checkpoint so a save-picker path does not claim a verified disk write without read-back proof.
- Preserves fallback Blob downloads on a conservative delayed-revoke cleanup window because anchor-triggered downloads do not expose a reliable completion signal.
- Strengthens the trust claim behind backup and recovery.
- Adds no dependency or architecture drift.
- Preserves compatibility with existing backup files.

Trade-offs:

- JSON export becomes async.
- Import validation gains an async checksum verification step.
- Legacy exports remain valid but do not benefit from integrity verification.
