# Architecture Decision Records

OpsNormal uses lightweight ADRs to record constraints that should not drift casually.

## Current ADR set

| ADR  | Decision                                                        |
| ---- | --------------------------------------------------------------- |
| 0001 | PWA over native app                                             |
| 0002 | IndexedDB over localStorage                                     |
| 0003 | Ternary state model                                             |
| 0004 | Local YYYY-MM-DD date storage                                   |
| 0005 | GitHub Pages as initial hosting target                          |
| 0006 | State encoding beyond color                                     |
| 0007 | Local-only and no-cloud trust boundary                          |
| 0008 | Versioned backup and validated recovery                         |
| 0009 | Storage durability hardening                                    |
| 0010 | Export integrity checksum                                       |
| 0011 | React error boundaries for render fault containment             |
| 0012 | Fail-closed import commit verification                          |
| 0013 | Week-paginated mobile history grid                              |
| 0014 | ExportPanel workflow decomposition                              |
| 0015 | PWA update handoff and multi-tab recovery                       |
| 0016 | Expand sectional error boundaries to TodayPanel and ExportPanel |
| 0017 | Risk-driven backup action prompts                               |
| 0018 | Database schema versioning and migration framework              |
| 0019 | Truthful Safari storage lifecycle automation                    |
| 0020 | Promote WebKit smoke to a gating compatibility check            |
| 0021 | Gate release on WebKit smoke and CI-verified artifact           |
| 0022 | Public release scope and repo-surface requirements              |
| 0023 | Temporary React hooks lint canary exception                     |
| 0024 | Coverage gate on integrity-critical modules                     |
| 0025 | Fail-closed undo verification and stale-snapshot invalidation   |
| 0026 | CSP directive contract and Trusted Types                        |
| 0027 | Build provenance attestation for release artifact               |
| 0028 | CodeQL source code scanning gate                                |
| 0029 | Firefox smoke engine compatibility gate                         |
| 0030 | Workflow supply-chain hardening                                 |
| 0031 | Automated browser-level migration upgrade proof                 |

## Operating rule

When a decision materially changes architecture, data shape, security boundary, or recovery posture, record it here before the repo drifts by accident.
