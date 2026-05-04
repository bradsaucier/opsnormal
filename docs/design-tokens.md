# OpsNormal design tokens

This file documents the custom interface values that are intentionally centralized for cockpit consistency.
It is not a full design system.
It covers the structural palette, clipped geometry, shared chrome utilities, and readiness signaling that are easy to drift if redefined ad hoc in JSX.

## Scope boundary

In scope:

- base and surface colors that establish the core cockpit palette
- structural border values used to frame primary panels and inset support surfaces
- notch sizes used by the shared clipped panel language
- shared chrome utilities for primary panels, nested support surfaces, and compact chip surfaces
- clipped action button chrome used on installation, update, backup, and restore actions
- readiness state colors used by badges and history cells
- typography role pairing between readable body copy and tactical mono chrome

Out of scope:

- generic typography utilities
- any new branding system or marketing layer

## Typography roles

OpsNormal uses two type roles, not two brand voices.
Body copy runs on `--font-sans` for readability.
The cockpit voice stays on `--font-mono`.

Mono is reserved for:

- product title chrome where the brand needs cockpit weight
- eyebrows, sector sigils, status labels, and action buttons
- telemetry chips, provenance facts, and tabular grid values
- radio chips and compact controls where state recognition matters

Application rules:

- Do not put descriptive paragraphs back on the mono stack.
- Use `.ops-headline-h2` and `.ops-headline-h3` for readable section and card headings.
- Do not remove mono from sigils, readiness status, telemetry, or controls.
- Prefer `.ops-mono` or `.ops-eyebrow` when a component needs explicit tactical voice.

### Tracking scale

OpsNormal uses a small tracking scale instead of one-off component values.

- `--ops-tracking-display`: `0.10em` for the product title and large display values
- `--ops-tracking-section`: `0.08em` for compact section headings
- `--ops-tracking-eyebrow`: `0.14em` for standard eyebrows and compact labels
- `--ops-tracking-eyebrow-strong`: `0.18em` for high-level shell metadata
- `--ops-tracking-action`: `0.14em` for clipped action buttons
- `--ops-tracking-table`: `0.16em` for dense table and grid headers

Application rules:

- Use `.ops-headline-h2` and `.ops-headline-h3` before adding heading-specific size or tracking utilities.
- Use `.ops-tracking-display`, `.ops-tracking-section`, `.ops-eyebrow`, `.ops-eyebrow-strong`, or `.ops-tracking-table` before adding an arbitrary tracking value.
- Action controls inherit tracking from `.ops-action-button`.
- Do not escalate eyebrow tracking above the product name.

## Core surfaces

- `--color-ops-base`: `#0a0f0d`
- `--color-ops-surface-base`: `#101613`
- `--color-ops-surface-1`: `#151d1a`
- `--color-ops-surface-2`: `#1c2521`
- `--color-ops-surface-3`: `#24302a`
- `--color-ops-surface-raised`: `#18211d`
- `--color-ops-surface-overlay`: `#1f2a25`
- `--color-ops-surface-interactive`: `#28342e`
- `--color-ops-text-primary`: `#e6ece9`
- `--color-ops-text-secondary`: `#b4bfba`
- `--color-ops-text-muted`: `#8b9691`
- `--color-ops-border-soft`: `#ffffff14`
- `--color-ops-border-struct`: `#ffffff29`
- `--color-ops-border-strong`: `#ffffff3a`
- `--color-ops-panel-border`: `#ffffff1a`
- `--color-ops-panel-border-strong`: `#ffffff24`
- `--color-ops-accent`: `#6ee7b7`
- `--color-ops-accent-muted`: `#b7f7da`
- `--color-ops-accent-border`: `#6ee7b724`

Application rules:

- Prefer `surface-1` for the main shell and primary section bodies.
- Prefer `surface-2` or `surface-raised` when a card needs to lift visually above the parent section.
- Prefer `surface-overlay` for nested decision zones, detail briefs, support strips, and subordinate notes.
- Prefer `surface-base` for compact chips, secondary labels, and inset status containers.
- Use panel border tokens instead of one-off `border-white/10` and `bg-black/20` combinations when the surface belongs to the notch-clipped chrome language.
- Use the four-step surface ramp to create visible lift. Do not introduce intermediate dark greens for local component depth.

## Hover and elevation scale

- `--ops-hover-1-bg`: `rgba(255, 255, 255, 0.015)`
- `--ops-hover-2-bg`: `rgba(255, 255, 255, 0.035)`
- `--ops-elevation-1`: standard card elevation
- `--ops-elevation-2`: active or hovered panel elevation
- `--ops-motion-standard`: `160ms ease-out`
- `--ops-motion-select`: `cubic-bezier(0.2, 0, 0, 1)`

Application rules:

- Use hover 1 for quiet rows and hover 2 for interactive cards or grid cells.
- Animate transform, opacity, color, background, border, and shadow only.
- New motion must remain covered by the reduced-motion override.

## Shared chrome utilities

These shared classes live in `src/styles/index.css` and should be preferred over ad hoc surface stacks.

Primary shells:

- `.tactical-panel`
- `.panel-shadow`

Inset support surfaces:

- `.tactical-subpanel`
- `.tactical-subpanel-strong`
- `.ops-flat-panel`
- `.ops-flat-panel-strong`
- `.ops-inline-alert`

Compact support surfaces:

- `.tactical-chip-panel`
- `.tactical-chip-panel-neutral`
- `.tactical-chip-panel-sky`
- `.tactical-chip-panel-amber`
- `.tactical-chip-panel-orange`
- `.tactical-chip-panel-rose`
- `.tactical-chip-panel-red`

Application rules:

- Use `tactical-panel` for major clipped shells that define the page rhythm.
- Reserve clipped panel notches for the app shell, first-level section cards, and key repeated controls.
- Use `ops-flat-panel` for secondary decision zones and narrative guidance inside a section.
- Use `ops-inline-alert` for non-critical banners that need tone without a full notched frame.
- Use `tactical-subpanel` only when a nested control truly needs cockpit framing.
- Use `tactical-subpanel-strong` when a detail brief or selected-state summary should read one step higher than surrounding support strips.
- Use `tactical-chip-panel` for compact meta blocks, legends, and grouped facts that should feel inset rather than flat.
- Keep these utilities inside the current cockpit language. They are not a license to add decorative glow, blur, or card-rounding.
- Use tone chip panels for import, restore, recovery, and fault guidance instead of repeating inline gradient stacks.

Frame emphasis:

- `NotchedFrame` supports `primary`, `standard`, `support`, `inset`, and `quiet` emphasis.
- Use `primary` for top-level live operator chrome.
- Use `standard` for normal nested panels.
- Use `support` for recovery, backup, and fault surfaces.
- Use `inset` for compact nested fact surfaces.
- Use `quiet` for low-priority boundary and footer chrome.

Section shell emphasis:

- `.ops-section-emphasis-primary` keeps the strongest top-level shell and is reserved for the live operator surface.
- `.ops-section-emphasis-standard` is the default shell weight for read-only mirrors such as history.
- `.ops-section-emphasis-support` drops the emerald outer wash and uses structural framing for support or recovery surfaces.
- Apply these through `SectionCard` only. They recalibrate shell hierarchy without changing notch geometry, focus chrome, or component signatures downstream.

Spine emphasis:

- `.ops-sector-spine-nominal`, `.ops-sector-spine-degraded`, and `.ops-sector-spine-unmarked` are reserved for sector readiness cards and selected sector summaries.
- `.ops-section-spine-fault` is reserved for contained crash and recovery fallback surfaces.
- `.ops-rollup-spine` is reserved for aggregate roll-up bands that are not sectors.

Focus chrome:

- `.ops-focus-ring-inset` for panel-scale and accordion-scale interactive surfaces that should carry the full inset focus treatment.
- `.ops-focus-ring-chip` for radio chips, history cells, and compact day selectors where the full 3px inset ring reads too heavy.

Application rules:

- Route focus-visible chrome on notched interactive elements through these shared utilities.
- Do not recreate cockpit focus treatment with ad hoc `focus-visible:ring-*` Tailwind stacks in component markup.
- Keep `ops-focus-ring-chip` on the clipped chip surface itself. If the focusable element is a parent shell, proxy focus to the chip surface instead of inventing a new ring pattern.

## Notch geometry

Shared notch sizes live in `src/styles/index.css`.
Use the outer value on structural shells and the inner value on the surface inset.
Use the chip value for badges, compact controls, and clipped action buttons.

- `--ops-notch-shell-outer`: `16px`
- `--ops-notch-shell-inner`: `15px`
- `--ops-notch-panel-outer`: `12px`
- `--ops-notch-panel-inner`: `11px`
- `--ops-notch-chip`: `8px`

Shared polygon pattern:

```css
clip-path: polygon(
  var(--notch) 0,
  100% 0,
  100% calc(100% - var(--notch)),
  calc(100% - var(--notch)) 100%,
  0 100%,
  0 var(--notch)
);
```

Application rules:

- Primary shells use a clipped outer frame plus a clipped inner surface.
- Status badges and compact history controls use the chip notch.
- Dense history heatmap cells use flat 2px-radius blocks instead of clipped chip geometry.
- Buttons inside the chrome system use the chip notch and inset focus rings.
- Do not add rounded corners to primary structural containers.

## Compact spacing tokens

These spacing tokens support the panel-chrome layer and keep dense controls aligned to a 4px and 8px rhythm.
They are available for future rollouts even where core Tailwind spacing utilities remain sufficient.

- `--spacing-ops-2`: `0.5rem`
- `--spacing-ops-3`: `0.75rem`
- `--spacing-ops-4`: `1rem`
- `--spacing-ops-5`: `1.25rem`
- `--spacing-ops-6`: `1.5rem`

## Chip height tokens

- `--ops-chip-min-h-sm`: `36px`
- `--ops-chip-min-h`: `44px`
- `--ops-chip-min-h-lg`: `52px`

Application rules:

- Use the shared chip height tokens through `.ops-action-button`, `.ops-action-button-sm`, `.ops-action-button-lg`, telemetry chips, radio chips, and compact controls.
- Avoid new ad hoc `min-h-[...]` values unless the control has a fixed-format layout requirement that cannot use the shared scale.

## Action button chrome

Clipped action buttons are defined centrally so install, update, export, import, and recovery controls present the same geometry.

Base class:

- `.ops-action-button`

Size classes:

- `.ops-action-button-sm`
- `.ops-action-button-lg`

Tone classes:

- `.ops-action-button-subtle`
- `.ops-action-button-neutral`
- `.ops-action-button-sky`
- `.ops-action-button-emerald`
- `.ops-action-button-emerald-solid`
- `.ops-action-button-amber`
- `.ops-action-button-rose`
- `.ops-action-button-red`

Guidance:

- Use `ops-action-button` as the base class for structural controls.
- Default button notch is `--ops-notch-chip`.
- Default size is 44px minimum height. Use `ops-action-button-sm` for compact alert actions and `ops-action-button-lg` for high-emphasis recovery actions.
- Use semantic tone modifiers rather than ad hoc border and background values.
- Use emerald for primary affirmative actions, amber for caution, and red or rose for destructive paths.
- Legacy action tone aliases were removed. JSX should use the canonical tone class names above.
- Keep focus indication inside the clipped geometry with the shared inset focus treatment.
- Avoid rounded button chrome inside primary tactical panels.

## Alert surface tones

Alert-like banners are centralized in `src/components/AlertSurface.tsx`.
New alert surfaces should compose that primitive instead of inlining clipped shell scaffolding.
The tone map is intentionally six-part. `success` and `neutral` stay distinct so setup guidance does not collapse into the same framing as steady-state support cards.

- `info`: sky outer gradient and sky raised inner gradient for update and system-notice surfaces
- `success`: emerald accent outer gradient and emerald-raised inner gradient for install and positive-setup surfaces
- `attention`: amber outer gradient and amber raised inner gradient for monitor states that need eyes-on without declaring active failure
- `warning`: amber outer gradient and amber raised inner gradient for elevated recovery or backup risk
- `danger`: red outer gradient and red raised inner gradient for destructive or hard-stop alert states
- `neutral`: structural outer border and neutral raised inner gradient for steady-state support cards

Application rules:

- Use standard alert surfaces at panel notch scale through `NotchedFrame`.
- Use inline alert intensity when a non-critical banner needs tone without another clipped frame.
- Use the shared alert heading tracking value of `0.16em`.
- Preserve consumer-specific `role`, `aria-live`, `aria-atomic`, `aria-labelledby`, and `data-testid` wiring when composing the primitive.
- Prefer the alert tone's mapped action-button variant for the primary action in that surface.
- Reserve `AlertSurface` for page-level, section-level, and support-banner surfaces. Field-level validation should stay inline.

## Readiness state colors

These values are for readiness signaling only.
Do not use them as general decorative accents.

Nominal:

- `--ops-status-nominal-border`: `rgba(110, 231, 183, 0.56)`
- `--ops-status-nominal-bg`: `rgba(110, 231, 183, 0.34)`
- `--ops-status-nominal-text`: `#c9fae4`

Degraded:

- `--ops-status-degraded-border`: `rgba(245, 158, 11, 0.72)`
- `--ops-status-degraded-bg`: `rgba(245, 158, 11, 0.26)`
- `--ops-status-degraded-text`: `#fbd38d`

Unmarked:

- `--ops-status-unmarked-border`: `rgba(255, 255, 255, 0.16)`
- `--ops-status-unmarked-bg`: `rgba(255, 255, 255, 0.04)`
- `--ops-status-unmarked-text`: `#96a39d`

## Provenance lane

The footer carries Boundary and Provenance in one column with a hairline divider.
It is intentionally muted and secondary. It surfaces build version, license,
and a compact source link.

Application rules:

- Provenance content stays inside the existing footer `tactical-subpanel`.
- Keep Boundary and Provenance in one vertical rhythm.
- Use `.ops-provenance-facts` for the build and license definition list.
- Use `.ops-action-button .ops-action-button-subtle .ops-provenance-source`
  for the source link. The local `.ops-provenance-source` override drops the
  chip to 28px to preserve hierarchy.
- The source icon must be inline SVG. Remote image loads are out of policy
  for this surface.
- The source link must carry `target="_blank"` and `rel="noopener noreferrer"`
  and an explicit `aria-label` that names the new-tab behavior.
- Do not add additional promotional chrome, stars, or counts here.

## Enforcement guidance

Use these tokens and utilities in:

- `StatusBadge`
- history state cells
- structural shells that define the cockpit silhouette
- nested guidance strips and detail briefs inside Today, history, and backup or recovery surfaces
- clipped action surfaces such as install, update, export, import, and storage controls

Do not create near-duplicate one-off values in component markup unless there is a clear functional need.
Support `SignalCard` surfaces must stay on structural border and neutral surface tokens.
If a backup or restore fact needs caution emphasis, keep the surface neutral and express the caution through copy and text treatment only.
