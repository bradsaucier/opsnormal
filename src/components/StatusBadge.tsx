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
        'inline-flex items-center justify-center rounded-md border font-semibold tracking-[0.16em] uppercase',
        compact ? 'min-h-8 min-w-8 px-2 text-xs' : 'min-h-10 min-w-10 px-3 text-xs',
        content.classes
      ].join(' ')}
      aria-hidden="true"
      title={content.label}
    >
      {compact ? content.shortLabel : content.label}
    </span>
  );
}
