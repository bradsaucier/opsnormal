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
    titleClassName: 'text-sky-200',
    descriptionClassName: 'text-sky-100',
    detailClassName: 'text-sky-50',
    subduedClassName: 'text-sky-100/78',
    definitionClassName: 'text-sky-50/88',
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
    titleClassName: 'text-amber-100',
    descriptionClassName: 'text-amber-100',
    detailClassName: 'text-amber-100',
    subduedClassName: 'text-amber-100/76',
    definitionClassName: 'text-amber-100/88',
    actionClassName: 'ops-action-button-amber',
  },
  warning: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(251,146,60,0.34),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(249,115,22,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-orange-200',
    descriptionClassName: 'text-orange-100/90',
    detailClassName: 'text-orange-100/90',
    subduedClassName: 'text-orange-100/78',
    definitionClassName: 'text-orange-100/88',
    actionClassName: 'ops-action-button-orange',
  },
  danger: {
    outerClassName:
      'bg-[linear-gradient(180deg,rgba(248,113,113,0.38),rgba(255,255,255,0.04))]',
    innerClassName:
      'bg-[linear-gradient(180deg,rgba(127,29,29,0.42),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    titleClassName: 'text-red-200',
    descriptionClassName: 'text-red-100/92',
    detailClassName: 'text-red-100/92',
    subduedClassName: 'text-red-100/78',
    definitionClassName: 'text-red-100/88',
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
  'ops-action-button clip-notched ops-notch-chip px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase';

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
