export type AlertSurfaceTone =
  | 'info'
  | 'success'
  | 'attention'
  | 'warning'
  | 'danger'
  | 'neutral';

export interface AlertSurfaceTonePalette {
  outerClassName: string;
  innerClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  detailClassName: string;
  subduedClassName: string;
  definitionClassName: string;
  actionClassName: string;
}

const tonePaletteByTone: Record<AlertSurfaceTone, AlertSurfaceTonePalette> = {
  info: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(125,211,252,0.34),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(56,189,248,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-[var(--ops-text-on-sky)]',
    descriptionClassName: 'text-[var(--ops-text-on-sky)]',
    detailClassName: 'text-[var(--ops-text-on-sky)]',
    subduedClassName: 'text-[var(--ops-text-on-sky)] opacity-80',
    definitionClassName: 'text-[var(--ops-text-on-sky)] opacity-90',
    actionClassName: 'ops-action-button-info',
  },
  success: {
    outerClassName:
      'bg-[linear-gradient(180deg,var(--color-ops-accent-border),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(110,231,183,0.08),rgba(255,255,255,0.02)),var(--color-ops-surface-raised)]',
    titleClassName: 'text-ops-accent-muted',
    descriptionClassName: 'text-ops-text-secondary',
    detailClassName: 'text-ops-text-secondary',
    subduedClassName: 'text-ops-text-muted',
    definitionClassName: 'text-ops-text-secondary',
    actionClassName: 'ops-action-button-success',
  },
  attention: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(251,191,36,0.32),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-[var(--ops-text-on-amber)]',
    descriptionClassName: 'text-[var(--ops-text-on-amber)]',
    detailClassName: 'text-[var(--ops-text-on-amber)]',
    subduedClassName: 'text-[var(--ops-text-on-amber)] opacity-80',
    definitionClassName: 'text-[var(--ops-text-on-amber)] opacity-90',
    actionClassName: 'ops-action-button-amber',
  },
  warning: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(251,146,60,0.34),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(249,115,22,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-[var(--ops-text-on-orange)]',
    descriptionClassName: 'text-[var(--ops-text-on-orange)] opacity-90',
    detailClassName: 'text-[var(--ops-text-on-orange)] opacity-90',
    subduedClassName: 'text-[var(--ops-text-on-orange)] opacity-80',
    definitionClassName: 'text-[var(--ops-text-on-orange)] opacity-90',
    actionClassName: 'ops-action-button-orange',
  },
  danger: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(248,113,113,0.38),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(127,29,29,0.42),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-[var(--ops-text-on-red)]',
    descriptionClassName: 'text-[var(--ops-text-on-red)]',
    detailClassName: 'text-[var(--ops-text-on-red)]',
    subduedClassName: 'text-[var(--ops-text-on-red)] opacity-80',
    definitionClassName: 'text-[var(--ops-text-on-red)] opacity-90',
    actionClassName: 'ops-action-button-red',
  },
  neutral: {
    outerClassName: 'bg-ops-border-struct',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-ops-text-primary',
    descriptionClassName: 'text-ops-text-primary',
    detailClassName: 'text-ops-text-secondary',
    subduedClassName: 'text-ops-text-muted',
    definitionClassName: 'text-ops-text-secondary',
    actionClassName: 'ops-action-button-neutral',
  },
};

export const alertSurfaceActionButtonClasses =
  'ops-action-button ops-action-button-sm';

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

export function getAlertSurfaceTonePalette(
  tone: AlertSurfaceTone,
): AlertSurfaceTonePalette {
  return tonePaletteByTone[tone];
}

export function getAlertSurfaceActionToneClass(tone: AlertSurfaceTone): string {
  return joinClasses(
    alertSurfaceActionButtonClasses,
    getAlertSurfaceTonePalette(tone).actionClassName,
  );
}
