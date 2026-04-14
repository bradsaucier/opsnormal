## Status

Accepted

## Context

OpsNormal uses ESLint 10 in the flat-config toolchain.

At the time of the `1.0.0` release preparation on 2026-04-14, the latest stable `eslint-plugin-react-hooks` release still declared peer support only through ESLint 9.
The repository therefore faced a choice:

1. downgrade the lint stack away from the current ESLint 10 baseline
2. hold the public release until stable peer support lands
3. carry the React canary build temporarily and document the exception explicitly

For this release window, downgrading the lint stack would create wider tooling churn than the repo needed, and blocking the full public-release hardening set on upstream peer metadata would not improve the shipped application bytes.

## Decision

Keep `eslint-plugin-react-hooks` on the React canary line temporarily and document that choice as an explicit exception to the repo's otherwise conservative dependency posture.

Guardrails:

1. keep the Dependabot ignore targeted to `eslint-plugin-react-hooks` only
2. record the exception in `SECURITY.md`
3. reevaluate the dependency as soon as a stable release line supports ESLint 10 cleanly
4. do not generalize this exception into a broader policy for other dependencies

## Consequences

Positive:

- keeps the current ESLint 10 toolchain intact
- avoids release churn unrelated to shipped product behavior
- makes the canary dependency a visible, reviewable decision instead of an undocumented surprise

Trade-offs:

- the repo carries one intentional canary dependency into the public `1.0.0` release surface
- maintainers must revisit the exception when stable peer support catches up
