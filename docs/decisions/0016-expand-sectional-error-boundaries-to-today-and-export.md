# ADR 0016 - Expand sectional error boundaries to TodayPanel and ExportPanel

## Status

Accepted

## Context

ADR 0011 established a root error boundary and a sectional boundary around the 30-day history grid.
That left TodayPanel and ExportPanel outside sectional containment.
A render fault in either section could still collapse the shell into the root crash fallback.
That blast radius is too wide for a local-only app where backup and recovery are part of the data-protection boundary.

## Decision

Add a sectional error boundary around TodayPanel with reset keys tied to the live `todayKey` so date rollover can automatically clear a stale render-fault latch.
Add a sectional error boundary around ExportPanel with a specialized fallback that keeps emergency JSON and CSV export available through the isolated crash-export path backed by a temporary Dexie connection.
Keep InstallBanner and PwaUpdateBanner outside sectional boundaries so service-worker handoff, waiting-worker prompts, and reload recovery remain mounted at shell level.
Extend the shared sectional fallback contract so section-level crashes expose retry, reload, and operator-visible fault details without requiring root-level collapse.

## Consequences

Today, history, and backup or recovery can now fail independently while the rest of the shell remains online.
ExportPanel faults still preserve a direct path to extract local data before retrying or reloading.
Sectional fallback states become part of the accessibility and release-gate surface, so tests must cover focus management, alert semantics, retry behavior, and emergency export continuity.
Malformed persistent IndexedDB data can still trigger repeat faults after retry if the underlying data defect is not corrected. The root crash fallback remains the last-resort recovery surface.
