# ADR 0008 - Versioned backup and validated recovery

## Status

Accepted

## Context

Export without import is not a recovery strategy. A local-only application needs a deliberate path to validate and restore backups when browser storage is lost.

## Decision

Use versioned JSON exports and a validated import pipeline with merge, replace, and undo. Validate imports before opening the write transaction.

## Consequences

The backup story becomes honest instead of aspirational. Recovery remains local and inspectable. The repo also gains a repeatable validation boundary for future data migrations.
