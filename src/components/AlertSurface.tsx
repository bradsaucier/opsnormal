import {
  createElement,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useId,
} from 'react';

import { NotchedFrame } from './NotchedFrame';
import {
  getAlertSurfaceTonePalette,
  type AlertSurfaceTone,
} from './alertSurfaceTone';

// Architecture: see docs/design-tokens.md, "Alert surface tones".
// Consumers own role, aria-live, aria-atomic, aria-labelledby, and test hooks.
// This primitive centralizes frame, tone, spacing, and heading treatment only.

interface AlertSurfaceProps
  extends PropsWithChildren, Omit<HTMLAttributes<HTMLElement>, 'title'> {
  tone: AlertSurfaceTone;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'section' | 'div';
  intensity?: 'standard' | 'compact';
  titleId?: string;
  outerClassName?: string;
  innerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  bodyClassName?: string;
}

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

export function AlertSurface({
  tone,
  title,
  description,
  actions,
  as = 'section',
  intensity = 'standard',
  titleId,
  outerClassName,
  innerClassName,
  titleClassName,
  descriptionClassName,
  bodyClassName,
  className,
  children,
  ...elementProps
}: AlertSurfaceProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const tonePalette = getAlertSurfaceTonePalette(tone);
  const isCompact = intensity === 'compact';
  const resolvedAriaLabelledBy =
    elementProps['aria-labelledby'] ??
    (elementProps['aria-label'] ? undefined : resolvedTitleId);

  const content = (
    <>
      <div>
        <h2
          id={resolvedTitleId}
          className={joinClasses(
            'font-semibold uppercase',
            isCompact
              ? 'ops-tracking-display text-[11px] text-ops-text-secondary'
              : 'ops-tracking-eyebrow text-sm',
            !isCompact && tonePalette.titleClassName,
            titleClassName,
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={joinClasses(
              isCompact ? 'mt-1 text-sm leading-5' : 'mt-2 text-sm leading-6',
              tonePalette.descriptionClassName,
              descriptionClassName,
            )}
          >
            {description}
          </p>
        ) : null}
        {children ? (
          <div
            className={joinClasses(isCompact ? 'mt-2' : 'mt-3', bodyClassName)}
          >
            {children}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          className={joinClasses(
            'flex flex-wrap lg:justify-end',
            isCompact ? 'gap-2' : 'gap-3',
          )}
        >
          {actions}
        </div>
      ) : null}
    </>
  );

  return (
    <NotchedFrame
      outerClassName={joinClasses(tonePalette.outerClassName, outerClassName)}
      innerClassName={joinClasses(
        isCompact ? 'p-3 sm:p-3' : 'p-4 sm:p-5',
        tonePalette.innerClassName,
        innerClassName,
      )}
    >
      {createElement(
        as,
        {
          ...elementProps,
          ...(resolvedAriaLabelledBy
            ? { 'aria-labelledby': resolvedAriaLabelledBy }
            : {}),
          className: joinClasses(className),
        },
        actions ? (
          <div
            className={joinClasses(
              'flex flex-col lg:flex-row lg:items-center lg:justify-between',
              isCompact ? 'gap-3' : 'gap-4',
            )}
          >
            {content}
          </div>
        ) : (
          content
        ),
      )}
    </NotchedFrame>
  );
}
