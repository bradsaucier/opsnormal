# ADR 0034 - canonical export checksum v2

## Status

Accepted

## Context

ADR-0010 requires exported JSON backups to carry a SHA-256 checksum.
ADR-0012 requires checksum validation before import writes reach IndexedDB.
ADR-0033 requires `applyImport` to recheck checksums immediately before the write path opens.

The legacy checksum projection used `JSON.stringify` over a manually built object.
That made the digest depend on JavaScript object insertion order.
The apply-time verifier already carried a `buildCrashDiagnosticsInExportOrder` workaround to recover the export-time order for legacy crash backup diagnostics after schema validation.
That workaround was brittle because every future diagnostics field would need the same manual mirror to keep valid backups importable.

## Decision

New JSON exports use checksum algorithm `sha256-canonical-v1`.
The algorithm serializes the checksum projection through a recursive canonical JSON serializer that sorts object keys lexicographically, preserves array order, omits `undefined` object values, rejects non-finite numbers, rejects sparse arrays, rejects non-plain objects, and emits no whitespace.

New exports include an additive optional envelope field:

```json
"checksumAlgorithm": "sha256-canonical-v1"
```

The verifier dispatches by algorithm tag.
When the tag is present and equals `sha256-canonical-v1`, checksum verification uses one deterministic canonical input built from the validated payload and performs no legacy retry.
When the tag is absent, the verifier treats the file as legacy v1 and preserves the old insertion-order verification path, including the crash-diagnostics order fallback needed for previously issued backups.
Unknown algorithm strings are rejected as incompatible with this build.

`EXPORT_SCHEMA_VERSION` remains `1` because the change is additive for new writers and legacy readers in the current build still accept older files.

## Consequences

Positive:

- new exports verify independently of JavaScript object insertion order
- schema validation, structured clone, IndexedDB read-back, and future diagnostics field additions no longer require hand-maintained checksum key order
- the legacy checksum ambiguity is isolated to files without an algorithm tag
- no dependency, origin, permission, or IndexedDB schema change is introduced

Trade-offs:

- older OpsNormal builds that do not know `checksumAlgorithm` will reject new v2 backups during strict schema validation
- v2 verification does one recursive key sort before SHA-256 digest calculation
- legacy v1 verification code must remain until a future deprecation decision removes it

## Guardrails

- Do not weaken the `checksumAlgorithm` dispatch.
- Do not write legacy v1 checksums from production export paths.
- Do not add fallback canonical forms for v2 verification.
- Keep post-write read-back verification in place.
- Legacy v1 verification removal requires a follow-up ADR after a deprecation window.
- If this change is rolled back, newer backups made with `sha256-canonical-v1` must be re-exported on the rolled-back build before destructive replace workflows rely on them.
