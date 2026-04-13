import type { PropsWithChildren } from 'react';

interface NotchedFrameProps extends PropsWithChildren {
  className?: string;
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
  outerClassName,
  innerClassName,
  withShadow = true,
  children,
}: NotchedFrameProps) {
  return (
    <div className={joinClasses(withShadow && 'panel-shadow', className)}>
      <div
        className={joinClasses(
          'clip-notched ops-notch-panel-outer p-px',
          outerClassName,
        )}
      >
        <div
          className={joinClasses(
            'clip-notched ops-notch-panel-inner',
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
