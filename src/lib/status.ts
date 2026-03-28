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
    classes: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
    srHint: 'Nominal status.'
  },
  degraded: {
    label: 'DEGRADED',
    shortLabel: 'DG',
    cell: 'DG',
    classes: 'border-orange-500/50 bg-orange-500/15 text-orange-300',
    srHint: 'Degraded status.'
  },
  unmarked: {
    label: 'UNMARKED',
    shortLabel: 'UN',
    cell: 'UN',
    classes: 'border-zinc-600 bg-transparent text-zinc-300',
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
