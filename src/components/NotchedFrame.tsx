import type { PropsWithChildren } from 'react';

export type NotchedFrameEmphasis =
  | 'primary'
  | 'standard'
  | 'support'
  | 'inset'
  | 'quiet';

interface NotchedFrameProps extends PropsWithChildren {
  className?: string;
  emphasis?: NotchedFrameEmphasis;
  notch?: 'panel' | 'shell' | 'chip';
  outerClassName?: string;
  innerClassName?: string;
  withShadow?: boolean;
}

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

export function NotchedFrame({
  className,
  emphasis = 'standard',
  notch = 'panel',
  outerClassName,
  innerClassName,
  withShadow = true,
  children,
}: NotchedFrameProps) {
  const outerNotchClassName =
    notch === 'shell'
      ? 'ops-notch-shell-outer'
      : notch === 'chip'
        ? 'ops-notch-chip'
        : 'ops-notch-panel-outer';
  const innerNotchClassName =
    notch === 'shell'
      ? 'ops-notch-shell-inner'
      : notch === 'chip'
        ? 'ops-notch-chip'
        : 'ops-notch-panel-inner';

  return (
    <div className={joinClasses(withShadow && 'panel-shadow', className)}>
      <div
        className={joinClasses(
          'clip-notched p-px',
          outerNotchClassName,
          !outerClassName && `ops-frame-emphasis-${emphasis}`,
          outerClassName,
        )}
      >
        <div
          className={joinClasses(
            'clip-notched',
            innerNotchClassName,
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
