# ADR 0004 - YYYY-MM-DD date storage

## Status

Accepted

## Context

Daily trackers are vulnerable to timezone drift when storing timestamps or parsing date-only strings through the JavaScript Date constructor.

## Decision

Store daily records only under local YYYY-MM-DD string keys.

## Consequences

Sorting remains stable, queries stay simple, and the repo avoids date-shift bugs across timezones.
