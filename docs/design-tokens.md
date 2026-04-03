# OpsNormal design tokens

This file documents the custom interface values that are intentionally centralized for cockpit consistency.
It is not a full design system.
It only covers custom geometry and state signaling that are easy to drift if redefined ad hoc in JSX.

## Scope boundary

In scope:
- base and surface colors that establish the core cockpit palette
- structural border values used to frame primary panels
- notch sizes used by the shared clipped panel language
- readiness state colors used by badges and history cells

Out of scope:
- Tailwind spacing scale
- generic typography utilities
- button variants outside the custom readiness and structure language
- any new branding system or marketing layer

## Core surfaces

- `--color-ops-base`: `#0a0f0d`
- `--color-ops-surface-1`: `#151d1a`
- `--color-ops-surface-2`: `#1c2521`
- `--color-ops-surface-3`: `#24302a`
- `--color-ops-text-primary`: `#e6ece9`
- `--color-ops-text-secondary`: `#b4bfba`
- `--color-ops-text-muted`: `#8b9691`
- `--color-ops-border-soft`: `#ffffff14`
- `--color-ops-border-struct`: `#ffffff29`
- `--color-ops-border-strong`: `#ffffff3a`
- `--color-ops-accent`: `#6ee7b7`
- `--color-ops-accent-muted`: `#b7f7da`
- `--color-ops-accent-border`: `#6ee7b724`

## Notch geometry

Shared notch sizes live in `src/styles/index.css`.
Use the outer value on structural shells and the inner value on the surface inset.
Use the chip value for badges and compact state elements.

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
- Do not add rounded corners to primary structural containers.

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

Do not create near-duplicate one-off values in component markup unless there is a clear functional need.
