# ADR 0002 - IndexedDB over localStorage

## Status

Accepted

## Context

The app needs structured local persistence, future-safe querying, and reactive updates without a backend.

## Decision

Use IndexedDB through Dexie.js as the single persistence layer.

## Consequences

The code remains local-first and queryable. Complexity is contained by Dexie instead of the raw browser API.
