## Status

Accepted

## Context

OpsNormal is moving from a strong pre-v1 posture to a public `1.0.0` release.
The repo already carried real architectural discipline, but the public surface was incomplete.

The gaps were not in the local-only data model.
They were in the release-facing contract around version identity, custom-domain configuration, community health files, public metadata, and documented support boundaries.

For a static local-only PWA, those repo-surface details are part of the product.
If the README, Pages configuration, release docs, and community health files drift apart, the first trust failure happens before an operator records a single check-in.

## Decision

Treat the public release surface as a maintained product boundary.

Public release now requires:

1. `package.json`, `package-lock.json`, `CHANGELOG.md`, and `CITATION.cff` to agree on the current release identity.
2. GitHub Pages custom-domain configuration to be represented in-repo through `public/CNAME`, canonical metadata, and README instructions.
3. Community health files to exist for support, issue intake, pull requests, ownership, and release-note categorization.
4. Workflow names and release-language claims to stay narrower than the pipeline evidence actually produced.
5. Public docs to record the browser-compatibility posture, support boundary, and release checklist instead of assuming that repository settings communicate them implicitly.

## Consequences

Positive:

- makes the public repo surface match the actual deployment and release posture
- reduces first-contact confusion for operators, contributors, and security reporters
- keeps version identity, domain identity, and release identity aligned

Trade-offs:

- release work now includes repo-health maintenance, not only application code
- some public-release checks still live outside the repository and must be confirmed in GitHub settings
