import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type PropsWithChildren,
} from 'react';

export type NotchedFrameEmphasis =
  | 'primary'
  | 'standard'
  | 'support'
  | 'inset'
  | 'quiet';

interface NotchedFrameProps
  extends PropsWithChildren, HTMLAttributes<HTMLElement> {
  as?: ElementType;
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

export const NotchedFrame = forwardRef<HTMLElement, NotchedFrameProps>(
  function NotchedFrame(
    {
      as: Component = 'div',
      className,
      emphasis = 'standard',
      notch = 'panel',
      outerClassName,
      innerClassName,
      withShadow = true,
      children,
      ...rest
    },
    ref,
  ) {
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
      <Component
        ref={ref}
        className={joinClasses(withShadow && 'panel-shadow', className)}
        {...rest}
      >
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
      </Component>
    );
  },
);
