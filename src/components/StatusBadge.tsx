import type { UiStatus } from '../types';
import { getStatusContent } from '../lib/status';

interface StatusBadgeProps {
  status: UiStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const content = getStatusContent(status);

  return (
    <span
      className={[
        'ops-notch-chip clip-notched ops-status-frame inline-flex items-center justify-center border font-semibold leading-none tracking-[0.16em] uppercase whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        compact
          ? 'min-h-8 min-w-[3rem] px-2 text-[11px]'
          : 'min-h-10 min-w-[5rem] px-3 text-xs',
        content.classes,
      ].join(' ')}
      aria-hidden="true"
      title={content.label}
    >
      {compact ? content.shortLabel : content.label}
    </span>
  );
}
