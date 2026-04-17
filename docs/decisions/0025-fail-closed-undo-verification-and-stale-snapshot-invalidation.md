# ADR 0025 - Fail-closed undo verification and stale-snapshot invalidation

## Status

Accepted

## Context

ADR-0012 states that the system must prove the database state matches the intended entry set before commit.
That doctrine was enforced on the forward import path but not on the undo restore path.
Undo also stayed callable after a post-import daily check-in, which turned a session convenience into a silent stale-snapshot overwrite risk.

## Decision

Undo restore now follows two enforcement rules.
First, the undo write runs inside a Dexie transaction, reads the restored entry set back before commit, and throws on any mismatch so IndexedDB rolls the restore back.
Second, any verified post-import daily check-in invalidates the staged undo snapshot, and the UI disables undo instead of allowing a stale restore target to overwrite newer data.

## Consequences

Positive:

- undo now honors the same fail-closed write doctrine as forward import
- a post-import daily check-in disables undo instead of being silently overwritten

Trade-offs:

- undo is stricter than before and can no longer be used after an intervening daily check-in
- the UI must surface invalidation state clearly so operators understand why the control is disabled

Cross-tab invalidation now propagates on the `opsnormal-entry-written-coordination` BroadcastChannel so a verified daily-status write in one tab disables undo in peer tabs of the same origin.
The same-tab `window` event remains in place for local listeners.
If the channel cannot be opened, coordination fails open to today's single-tab behavior, while any tab that does receive the invalidation still fails closed on restore.

## Reference

Extends ADR-0012 - Fail-closed import commit verification.
