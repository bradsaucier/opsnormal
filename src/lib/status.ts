import type { UiStatus } from '../types';

const statusContent: Record<
  UiStatus,
  {
    label: string;
    shortLabel: string;
    cell: string;
    classes: string;
    srHint: string;
  }
> = {
  nominal: {
    label: 'NOMINAL',
    shortLabel: 'OK',
    cell: 'OK',
    classes: 'ops-status-nominal',
    srHint: 'Nominal status.'
  },
  degraded: {
    label: 'DEGRADED',
    shortLabel: 'DG',
    cell: 'DG',
    classes: 'ops-status-degraded',
    srHint: 'Degraded status.'
  },
  unmarked: {
    label: 'UNMARKED',
    shortLabel: 'UN',
    cell: 'UN',
    classes: 'ops-status-unmarked',
    srHint: 'Unmarked status.'
  }
};

const cycleOrder: UiStatus[] = ['unmarked', 'nominal', 'degraded'];

export function getStatusContent(status: UiStatus) {
  return statusContent[status];
}

export function getStatusLabel(status: UiStatus): string {
  return statusContent[status].label;
}

export function getStatusShortLabel(status: UiStatus): string {
  return statusContent[status].shortLabel;
}

export function getStatusCellText(status: UiStatus): string {
  return statusContent[status].cell;
}

export function getStatusScreenReaderHint(status: UiStatus): string {
  return statusContent[status].srHint;
}

export function getNextStatus(status: UiStatus): UiStatus {
  const currentIndex = cycleOrder.indexOf(status);
  return cycleOrder[(currentIndex + 1) % cycleOrder.length] ?? 'unmarked';
}
