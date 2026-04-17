# ADR 0026 - CSP directive contract and Trusted Types

## Status

Accepted

## Context

ADR-0007 fixes OpsNormal's trust boundary as local-only, same-origin, and browser-enforced.
On GitHub Pages, the Content Security Policy is carried by the meta tag in `index.html`, not by response headers.
That makes the directive string a load-bearing contract surface.
Before this ADR, runtime tests watched for `securitypolicyviolation` events but no gate asserted the exact directive set, which left CSP weakening vulnerable to silent drift.

## Decision

Pin the exact meta-CSP directive set in automated tests.
Require that any CSP edit update the directive gate and this ADR in the same commit.
Adopt `require-trusted-types-for 'script'` and a named `trusted-types opsnormal-default` policy as additive defense for DOM-sink injection on supporting browsers, while keeping a benign fallback on engines that do not yet support Trusted Types.
Do not ship `upgrade-insecure-requests` while the local preview and smoke harness remain plain HTTP, because the directive upgrades same-origin preview assets to HTTPS and breaks the WebKit release gate.

## Consequences

The CSP string is now a review surface instead of an implicit convention.
Any directive addition, removal, or weakening fails CI until the change is made explicit in code review.
Trusted Types enforcement raises Chromium's protection floor without changing the local-only trust boundary, adding a backend, or changing the product data model.
The pinned contract stays limited to directives that are compatible with the repository's current GitHub Pages artifact and HTTP-based local verification lanes.

## Reference

Extends ADR-0007 - Local-only and no-cloud trust boundary.
