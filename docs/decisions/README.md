# Architecture Decision Records

OpsNormal uses lightweight ADRs to record constraints that should not drift casually.

## Current ADR set

| ADR | Decision |
| --- | --- |
| 0001 | PWA over native app |
| 0002 | IndexedDB over localStorage |
| 0003 | Ternary state model |
| 0004 | Local YYYY-MM-DD date storage |
| 0005 | GitHub Pages as initial hosting target |
| 0006 | State encoding beyond color |
| 0007 | Local-only and no-cloud trust boundary |
| 0008 | Versioned backup and validated recovery |
| 0009 | Storage durability hardening |
| 0010 | Export integrity checksum |
| 0011 | React error boundaries for render fault containment |

## Operating rule

When a decision materially changes architecture, data shape, security boundary, or recovery posture, record it here before the repo drifts by accident.
