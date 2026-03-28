# ADR 0001 - PWA over native app

## Status

Accepted

## Context

The app must be executable by non-programmers, deployable quickly, and maintainable by a small team without mobile store overhead.

## Decision

Build OpsNormal as a Progressive Web App using Vite and vite-plugin-pwa.

## Consequences

This keeps deployment simple, preserves installability, enables offline support, and avoids native build complexity.
