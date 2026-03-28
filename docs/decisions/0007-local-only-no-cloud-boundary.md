# ADR 0007 - Local-only and no-cloud trust boundary

## Status

Accepted

## Context

OpsNormal exists to provide a private daily readiness check without introducing account management, backend infrastructure, or telemetry drift.

## Decision

Keep the application local-only. Do not add cloud sync, analytics, or third-party API dependencies to the core product.

## Consequences

The privacy story remains simple and inspectable. The durability burden stays with local storage and deliberate export discipline. Any future networked feature must clear a much higher justification bar because it would change the product's trust boundary.
