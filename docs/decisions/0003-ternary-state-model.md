# ADR 0003 - Ternary state model

## Status

Accepted

## Context

The app must preserve low friction while distinguishing between no check-in and a deliberately degraded state.

## Decision

Represent each sector as Unmarked, Nominal, or Degraded.

## Consequences

Daily interaction stays simple, and analytics remain clear without inflating the scale beyond what the product needs.
