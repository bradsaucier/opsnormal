# ADR 0006 - State encoding beyond color

## Status

Accepted

## Context

The app uses a compact grid. Color-only state encoding would fail accessibility expectations and reduce legibility under stress.

## Decision

Encode status through text plus color: N for nominal, D for degraded, and dash for unmarked.

## Consequences

The interface remains readable for more users and aligns with the project requirement for operational clarity.

## Clarification - 2026-04-04

Implementation labels were later refined for stronger scan clarity in the live grid and legend.
The current shipped markers are OK for nominal, DG for degraded, and UN for unmarked.
The architectural decision itself did not change. The system still encodes status through text plus color rather than color alone.
