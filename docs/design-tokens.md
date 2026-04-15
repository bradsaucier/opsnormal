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

Out of scope:

- full typography redesign
- generic typography utilities
- any new branding system or marketing layer

## Core surfaces

- `--color-ops-base`: `#0a0f0d`
- `--color-ops-surface-1`: `#151d1a`
- `--color-ops-surface-2`: `#1c2521`
- `--color-ops-surface-3`: `#24302a`
- `--color-ops-surface-base`: `#101613`
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

## Shared chrome utilities

These shared classes live in `src/styles/index.css` and should be preferred over ad hoc surface stacks.

Primary shells:

- `.tactical-panel`
- `.panel-shadow`

Inset support surfaces:

- `.tactical-subpanel`
- `.tactical-subpanel-strong`

Compact support surfaces:

- `.tactical-chip-panel`

Application rules:

- Use `tactical-panel` for major clipped shells that define the page rhythm.
- Use `tactical-subpanel` for secondary decision zones and narrative guidance inside a section.
- Use `tactical-subpanel-strong` when a detail brief or selected-state summary should read one step higher than surrounding support strips.
- Use `tactical-chip-panel` for compact meta blocks, legends, and grouped facts that should feel inset rather than flat.
- Keep these utilities inside the current cockpit language. They are not a license to add decorative glow, blur, or card-rounding.

Section shell emphasis:

- `.ops-section-emphasis-primary` keeps the strongest top-level shell and is reserved for the live operator surface.
- `.ops-section-emphasis-standard` is the default shell weight for read-only mirrors such as history.
- `.ops-section-emphasis-support` drops the emerald outer wash and uses structural framing for support or recovery surfaces.
- Apply these through `SectionCard` only. They recalibrate shell hierarchy without changing notch geometry, focus chrome, or component signatures downstream.

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

## Action button chrome

Clipped action buttons are defined centrally so install, update, export, import, and recovery controls present the same geometry.

Base class:

- `.ops-action-button`

Tone classes:

- `.ops-action-button-subtle`
- `.ops-action-button-neutral`
- `.ops-action-button-sky`
- `.ops-action-button-emerald`
- `.ops-action-button-emerald-solid`
- `.ops-action-button-amber`
- `.ops-action-button-orange`
- `.ops-action-button-rose`
- `.ops-action-button-red`

Guidance:

- Use `ops-action-button` as the base class for structural controls.
- Default button notch is `--ops-notch-chip`.
- Use semantic tone modifiers rather than ad hoc border and background values.
- Keep focus indication inside the clipped geometry with the shared inset focus treatment.
- Avoid rounded button chrome inside primary tactical panels.

## Alert surface tones

Alert-like banners are centralized in `src/components/AlertSurface.tsx`.
New alert surfaces should compose that primitive instead of inlining clipped shell scaffolding.
The tone map is intentionally six-part. `success` and `neutral` stay distinct so setup guidance does not collapse into the same framing as steady-state support cards.

- `info`: sky outer gradient and sky raised inner gradient for update and system-notice surfaces
- `success`: emerald accent outer gradient and emerald-raised inner gradient for install and positive-setup surfaces
- `attention`: amber outer gradient and amber raised inner gradient for monitor states that need eyes-on without declaring active failure
- `warning`: orange outer gradient and orange raised inner gradient for elevated recovery or backup risk
- `danger`: red outer gradient and red raised inner gradient for destructive or hard-stop alert states
- `neutral`: structural outer border and neutral raised inner gradient for steady-state support cards

Application rules:

- Keep alert surfaces at panel notch scale through `NotchedFrame`.
- Use the shared alert heading tracking value of `0.16em`.
- Preserve consumer-specific `role`, `aria-live`, `aria-atomic`, `aria-labelledby`, and `data-testid` wiring when composing the primitive.
- Prefer the alert tone's mapped action-button variant for the primary action in that surface.
- Reserve `AlertSurface` for page-level, section-level, and support-banner surfaces. Field-level validation should stay inline.

## Readiness state colors

These values are for readiness signaling only.
Do not use them as general decorative accents.

Nominal:

- `--ops-status-nominal-border`: `rgba(110, 231, 183, 0.56)`
- `--ops-status-nominal-bg`: `rgba(110, 231, 183, 0.14)`
- `--ops-status-nominal-text`: `#c9fae4`

Degraded:

- `--ops-status-degraded-border`: `rgba(245, 158, 11, 0.56)`
- `--ops-status-degraded-bg`: `rgba(245, 158, 11, 0.14)`
- `--ops-status-degraded-text`: `#fde7b0`

Unmarked:

- `--ops-status-unmarked-border`: `rgba(255, 255, 255, 0.16)`
- `--ops-status-unmarked-bg`: `rgba(36, 48, 42, 0.72)`
- `--ops-status-unmarked-text`: `#96a39d`

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
