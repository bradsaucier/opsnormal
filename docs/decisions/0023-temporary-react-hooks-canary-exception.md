# ADR 0023 - Temporary React hooks lint canary exception

## Status

Closed

## Context

OpsNormal uses ESLint 10 in the flat-config toolchain.

At the time of the `1.0.0` release preparation on 2026-04-14, the latest stable `eslint-plugin-react-hooks` release still declared peer support only through ESLint 9.
The repository therefore faced a choice:

1. downgrade the lint stack away from the current ESLint 10 baseline
2. hold the public release until stable peer support lands
3. carry the React canary build temporarily and document the exception explicitly

For this release window, downgrading the lint stack would create wider tooling churn than the repo needed, and blocking the full public-release hardening set on upstream peer metadata would not improve the shipped application bytes.

## Original decision

Keep `eslint-plugin-react-hooks` on the React canary line temporarily and document that choice as an explicit exception to the repo's otherwise conservative dependency posture.

Original guardrails:

1. keep the Dependabot ignore targeted to `eslint-plugin-react-hooks` only
2. record the exception in `SECURITY.md`
3. reevaluate the dependency as soon as a stable release line supports ESLint 10 cleanly
4. do not generalize this exception into a broader policy for other dependencies

## Resolution

Closed on 2026-05-02.

`eslint-plugin-react-hooks` 7.1.1 is a stable release and declares peer support for ESLint 10. The repository now depends on `^7.1.1`, the Dependabot ignore has been removed, and the canary exception is no longer active.

Do not reintroduce a React hooks canary dependency without a new ADR that records the current upstream constraint and exit criteria.

## Consequences

Resolved outcomes:

- keeps the current ESLint 10 toolchain intact
- removes the remaining pre-release dependency from the documented toolchain
- restores normal Dependabot coverage for `eslint-plugin-react-hooks`

Historical trade-off:

- the public `1.0.0` release carried one intentional canary dependency until stable peer support caught up
