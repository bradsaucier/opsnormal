# ADR 0011 - React error boundaries for render fault containment

## Status
Accepted, amended by ADR 0016

## Context
OpsNormal is a local-first PWA with IndexedDB as the primary working store.
A React render fault without an error boundary can unmount the full tree and drop the operator into a blank screen.
That is a poor failure mode for an app that may be running installed, offline, and without obvious browser chrome.

## Decision
Add a root React error boundary around the full app shell and a sectional boundary around the 30-day history grid.
Both boundaries must present direct recovery actions.
The root fallback must keep JSON and CSV export available so the operator can extract local data before retrying or reloading.
`createRoot()` runtime callbacks remain enabled so caught, uncaught, and recoverable React faults still reach the console during development and troubleshooting.
A try-catch around the `createRoot()` boot path provides a static DOM fallback if React itself fails to initialize. That fallback must remain compatible with the repo Content Security Policy and may not rely on inline handlers, inline style attributes, or injected script blocks.

## Consequences
Render faults are contained instead of collapsing the full UI into a white screen.
The history grid can fail independently while Today, backup, and install controls remain online.
The operator retains a direct backup path even when the main shell has faulted.
Malformed persistent IndexedDB data can still trigger crash loops on every mount. The operator may need to clear site data manually before restoring from backup.
