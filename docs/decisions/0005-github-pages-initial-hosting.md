# ADR 0005 - GitHub Pages as initial hosting target

## Status

Accepted

## Context

The first release needs a zero-cost deployment path tightly integrated with the repository.

## Decision

Deploy the first production build to GitHub Pages through GitHub Actions.

## Consequences

Initial operations stay simple. A later migration to Cloudflare Pages remains open for stronger cache-control handling.
