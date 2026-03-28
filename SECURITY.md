# Security Policy

## Supported versions

OpsNormal is maintained on the `main` branch. Security fixes are applied there first.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for security issues that could
impact users or the integrity of the published build.

Include:

1. A clear description of the issue.
2. Reproduction steps.
3. Browser and platform details.
4. Impact assessment if known.

## Scope note

OpsNormal is a client-side application with no backend, no account system, and
no cloud data plane. Relevant security concerns are therefore concentrated in:

1. Dependency supply chain risk.
2. Browser storage handling.
3. Service worker behavior.
4. Exported user data files.
5. Static hosting configuration.

Dependabot is enabled to monitor npm and GitHub Actions dependencies.
