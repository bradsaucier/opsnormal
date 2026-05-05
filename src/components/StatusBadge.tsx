import type { UiStatus } from '../types';
import { getStatusContent } from '../lib/status';

interface StatusBadgeProps {
  status: UiStatus;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClassNameBySize = {
  sm: 'min-h-8 min-w-[3rem] px-2 text-[11px]',
  md: 'min-h-10 min-w-[5rem] px-3 text-xs',
  lg: 'min-h-11 min-w-[5.5rem] px-3.5 text-xs',
} as const;

export function StatusBadge({
  status,
  compact = false,
  size,
}: StatusBadgeProps) {
  const content = getStatusContent(status);
  const resolvedSize = size ?? (compact ? 'sm' : 'md');
  const isAbbreviated = resolvedSize === 'sm';

  return (
    <span
      className={[
        'ops-notch-chip clip-notched ops-status-frame ops-tracking-table inline-flex items-center justify-center border font-semibold leading-none uppercase whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        sizeClassNameBySize[resolvedSize],
        content.classes,
      ].join(' ')}
      aria-hidden="true"
      title={content.label}
    >
      {isAbbreviated ? content.shortLabel : content.label}
    </span>
  );
}
