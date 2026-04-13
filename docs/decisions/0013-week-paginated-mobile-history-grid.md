# ADR 0013 - Week-paginated mobile history grid

## Status

Accepted

## Context

OpsNormal's trailing history view is useful because it compresses thirty days of signal into one picture.
That shape works on wide screens.
It does not hold on narrow mobile viewports without forcing unreadable columns or hostile tap targets.

The app still needs the operator to scan patterns quickly on a phone,
but it cannot solve that by shrinking the entire thirty-day matrix into noise.
The mobile view must keep the historical picture readable,
preserve daily detail,
and stay inside the product boundary of a narrow local-first tracker.

## Decision

Use two responsive history surfaces backed by the same data:

- keep the full 30-column grid at and above the 768px desktop breakpoint
- collapse the mobile history view into week-sized snap groups
- make day selection the primary mobile interaction and show a daily brief for all five sectors beneath the weekly view
- keep the desktop grid keyboard-driven with a roving tabindex and explicit grid semantics
- strip the desktop grid role from the mobile path and use native button-driven day selection so screen readers are not forced through a two-dimensional grid contract on touch hardware
- harden the mobile app shell with dynamic viewport height, safe-area padding, and localized horizontal overscroll containment
- switch the render path through a viewport subscription backed by useSyncExternalStore so the React tree stays deterministic as the viewport crosses the 768px threshold

## Consequences

Positive:

- mobile history stays readable without reducing the product to a gimmick heatmap
- weekly snap groups make horizontal movement discoverable and controlled
- daily detail remains available without forcing thirty columns into a phone viewport
- desktop keeps the denser operator picture and keyboard contract

Trade-offs:

- the history surface now has separate mobile and desktop render paths
- test coverage must prove both layouts stay aligned on the same underlying data
- mobile history emphasizes day-level review instead of cell-by-cell keyboard navigation

## Amendment

The mobile history surface now includes explicit `Previous week` and `Next week` controls in addition to the existing swipe-driven, scroll-snap week view.

This amendment does not change the underlying decision recorded in this ADR. Mobile history remains a week-paginated surface optimized for narrow screens, and horizontal swipe remains a valid primary interaction path. The added controls are an additive usability and accessibility improvement intended to make week movement more discoverable and more reliable when swipe is inconvenient, unavailable, or imprecise.

Scope of the amendment:

- preserves the existing local-first architecture and read-only history model
- preserves the existing week-grouped mobile scroll-snap structure
- preserves desktop history behavior without modification
- adds explicit week-step controls for movement across the trailing 30-day window
- keeps the daily brief synchronized with the currently visible week
- strengthens assistive technology support through clearer week-navigation announcements and explicit navigation affordances

Operational effect:

Mobile operators can now move by week using either swipe or explicit controls without changing the product's narrow scope, persistence model, or visual posture.
