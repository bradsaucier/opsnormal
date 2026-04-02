# ADR 0012 - Fail-closed import commit verification

## Status
Accepted

## Context

Validated JSON import already checked schema shape before write and used a single IndexedDB transaction.
That was necessary but not sufficient.
A corrupted runtime or unexpected browser fault could still leave the operator unsure whether the imported state actually matched the validated plan.

Because OpsNormal has no cloud recovery path,
replace import is a high-consequence operation.
The system must prove that the database state inside the write transaction matches the validated import plan before commit.
Undo remains useful after a successful import,
but undo is not the durability boundary.
The durability boundary is the IndexedDB transaction itself.
Where Chromium supports durability hints, the write path should prefer strict durability over the relaxed default.

## Decision

Harden import into a fail-closed sequence:
- validate JSON structure and checksum before any write
- compute the expected final entry set in memory before the transaction begins
- write the import inside a single Dexie transaction
- read the transaction view back before commit and compare it to the expected final state
- throw on any mismatch so IndexedDB aborts the transaction natively
- keep undo session-scoped and separate from the transaction durability guarantee
- prefer strict transaction durability where the runtime and Dexie expose it
- do not add automatic post-commit restore logic that depends on a second destructive write

## Consequences

Positive:
- replace import no longer trusts transaction success alone
- post-write drift is detected before commit instead of surfacing later as silent corruption
- rollback stays inside IndexedDB's native atomic boundary
- undo still restores the pre-import snapshot for the current session after a successful import

Trade-offs:
- import now performs additional read and compare work inside the transaction
- verification adds latency to import on larger datasets
- undo remains a session-scoped convenience, not a substitute for external backup
