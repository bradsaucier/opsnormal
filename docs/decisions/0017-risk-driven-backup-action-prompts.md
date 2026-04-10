## Status
Accepted

## Context

OpsNormal already tracked storage durability, reconnect events, and write-verification results.
That gave the operator telemetry, but not always a direct call to action at the moment risk became meaningful.

The highest-cost failure mode in a local-only app is not a minor UI glitch.
It is silent data loss after the operator assumes the browser is acting like a backup system.

The repo already records the last successful JSON backup timestamp in browser storage.
That timestamp can be combined with storage-risk diagnostics to raise a narrow, disciplined action prompt only when the signal is strong enough to matter.

## Decision

Add a top-level backup action banner that appears only when the repository has concrete evidence that the operator should refresh the JSON backup now.

The prompt is currently limited to three cases:
- reconnect or write-verification diagnostics indicate recent storage instability
- Safari-family browser-tab risk is active and the recorded JSON backup is older than the six-day warning buffer
- storage posture is already warning or unavailable and no JSON backup has been recorded on this browser

The banner links directly to the backup and recovery surface rather than duplicating export logic in a second location.
Export remains the single execution lane and the operator still performs the action deliberately.
Because the banner is injected only when risk becomes concrete, it also carries alert semantics so assistive technology announces the warning immediately instead of requiring manual discovery.

## Consequences

Positive:
- elevates the backup boundary into the main shell when risk turns concrete
- converts passive storage telemetry into a direct operator action
- keeps backup execution inside one existing surface instead of forking export logic

Trade-offs:
- adds another top-level banner, so the trigger rules must stay narrow to avoid alert fatigue
- the last-backup timestamp is browser-local metadata, not proof that the file still exists on disk
- the six-day Safari warning buffer is a safety margin, not a browser guarantee

