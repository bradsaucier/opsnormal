# ADR 0014 - ExportPanel workflow decomposition

## Status

Accepted

## Context

ExportPanel owns the app's backup and restore surface.
That surface is not a cosmetic panel.
It controls the highest-consequence local workflow in the repo:
previewing a backup,
choosing merge or replace,
checkpointing a pre-replace backup,
arming the destructive path,
executing the write,
and exposing session-scoped undo.

The implementation stayed correct,
but too much workflow state accumulated inside one component.
Preview staging,
replace checkpoint gating,
undo handling,
and export actions were interleaved with the rendered shell.
That made routine edits harder to reason about and increased the chance that a future change to one path would disturb another.

OpsNormal already uses narrow hooks where the lifecycle boundary is clear.
This decision applies that same discipline to the export feature without changing product scope,
user-facing behavior,
or persistence semantics.

## Decision

Decompose ExportPanel into a rendering shell backed by focused co-located hooks:

- useExportWorkflow owns JSON and CSV export actions and backup-posture refresh
- useImportWorkflow owns file selection, preview staging, mode selection reset, and confirmed import execution
- useReplaceCheckpoint owns pre-replace backup gating, manual acknowledgment, destructive arm-disarm state, and replace unlock conditions
- useUndoImport owns the session-scoped undo handle and restore action

Keep the hooks inside src/features/export/.
Do not move the import correctness engine out of importService.
The hooks orchestrate workflow state and delegate data validation and IndexedDB write semantics to the existing service layer.

Keep ExportPanel responsible for composing the hooks and rendering the existing UI contract.
Hooks inside one feature must communicate through the ExportPanel composition layer.
Use parent-orchestrated callbacks or ordinary React state transitions.
Do not use mutable ref bridges for cross-hook function invocation.
No user-facing copy,
ARIA contract,
recovery behavior,
or data shape changes as part of this decomposition.

## Consequences

Positive:

- the highest-risk panel now has explicit workflow boundaries
- future edits can target export, import staging, replace gating, or undo in isolation
- direct unit tests can validate workflow state machines without mounting the full panel
- the rendering shell is easier to scan and less likely to hide workflow coupling

Trade-offs:

- the export feature now spans more files
- contributors must follow the hook boundaries instead of re-consolidating logic into the component shell
- the component depends on a small composition layer to connect adjacent workflow hooks
