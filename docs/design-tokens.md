# OpsNormal design tokens

This file documents the custom interface values that are intentionally centralized for cockpit consistency.
It is not a full design system.
It only covers custom geometry and state signaling that are easy to drift if redefined ad hoc in JSX.

## Scope boundary

In scope:
- base and surface colors that establish the core cockpit palette
- structural border values used to frame primary panels
- notch sizes used by the shared clipped panel language
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
- `--color-ops-surface-raised`: `#18211d`
- `--color-ops-surface-overlay`: `#1f2a25`
- `--color-ops-surface-interactive`: `#24312b`
- `--color-ops-text-primary`: `#e6ece9`
- `--color-ops-text-secondary`: `#b4bfba`
- `--color-ops-text-muted`: `#8b9691`
- `--color-ops-border-soft`: `#ffffff14`
- `--color-ops-border-struct`: `#ffffff29`
- `--color-ops-border-strong`: `#ffffff3a`
- `--color-ops-panel-border`: `#ffffff1a`
- `--color-ops-panel-border`: `#ffffff17`
- `--color-ops-panel-border-strong`: `#ffffff24`
- `--color-ops-accent`: `#6ee7b7`
- `--color-ops-accent-muted`: `#b7f7da`
- `--color-ops-accent-border`: `#6ee7b724`

Application rule:
- Prefer `surface-raised` for primary cards and accordion bodies.
- Prefer `surface-overlay` for nested decision zones, preview details, and subordinate notes.
- Use panel border tokens instead of one-off `border-white/10` and `bg-black/20` combinations when the surface belongs to the notch-clipped chrome language.

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

Application rule:
- Primary shells use a clipped outer frame plus a clipped inner surface.
- Status badges and compact history controls use the chip notch.
- Buttons inside the chrome system use the chip notch and inset focus rings.
- Do not add rounded corners to primary structural containers.

## Action button chrome

Clipped action buttons are defined centrally so install, update, export, import, and recovery controls present the same geometry.

Base class:
- `.ops-action-button`

Tone classes:
- `.ops-action-button-neutral`
- `.ops-action-button-sky`
- `.ops-action-button-emerald`
- `.ops-action-button-emerald-solid`
- `.ops-action-button-amber`
- `.ops-action-button-orange`
- `.ops-action-button-rose`
- `.ops-action-button-red`

Application rule:
- Use clipped action buttons for major operator actions inside notch-framed surfaces.
- Preserve inset focus visibility on clipped controls.
- Avoid rounded button chrome inside primary tactical panels.


## Surface elevation and interaction tokens

The visual quality pass introduces semantic surface tones for notched panels and compact cards.
These do not replace every existing Tailwind color utility.
They define the shared baseline for high-traffic shells in backup, restore, install, and update flows.

Use these semantic layers when adding new structural chrome:
- `--color-ops-surface-base`: deepest inset content and passive support blocks
- `--color-ops-surface-raised`: standard panel surface for cards and banners
- `--color-ops-surface-overlay`: denser inset surface for nested controls and preview facts
- `--color-ops-surface-interactive`: hover or selected surface for compact interactive cards

## Compact spacing tokens

These spacing tokens support the panel-chrome layer and keep dense controls aligned to a 4px and 8px rhythm.
They are available for future rollouts even where core Tailwind spacing utilities remain sufficient.

- `--spacing-ops-2`: `0.5rem`
- `--spacing-ops-3`: `0.75rem`
- `--spacing-ops-4`: `1rem`
- `--spacing-ops-5`: `1.25rem`
- `--spacing-ops-6`: `1.5rem`

## Action button chrome

Primary action buttons now default to the chip notch geometry rather than rounded corners.
This keeps install, update, export, import, and destructive recovery controls inside the same silhouette language as the surrounding panels.

Guidance:
- use `ops-action-button` as the base class for structural controls
- default button notch is `--ops-notch-chip`
- use semantic tone modifiers such as success, info, warning, or danger rather than ad hoc border and background values
- keep focus indication inside the clipped geometry with the shared inset focus treatment

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

Use these tokens in:
- `StatusBadge`
- history state cells
- structural shells that define the cockpit silhouette
- clipped action surfaces such as install, update, export, import, and storage controls

Do not create near-duplicate one-off values in component markup unless there is a clear functional need.
