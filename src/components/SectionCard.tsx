import type { PropsWithChildren, ReactNode } from 'react';

import { NotchedFrame } from './NotchedFrame';

type SectionCardEmphasis = 'primary' | 'standard' | 'support';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
  emphasis?: SectionCardEmphasis;
}

export function SectionCard({
  title,
  eyebrow,
  meta,
  emphasis = 'standard',
  children,
}: SectionCardProps) {
  const eyebrowClassName =
    emphasis === 'primary'
      ? 'ops-eyebrow-strong text-ops-accent-muted'
      : 'ops-eyebrow text-ops-text-muted';

  return (
    <NotchedFrame
      as="section"
      outerClassName={`ops-section-frame ops-section-emphasis-${emphasis}`}
      innerClassName="tactical-panel ops-section-surface p-5 sm:p-6 lg:p-8"
    >
      {emphasis === 'primary' ? (
        <span className="ops-section-primary-tick" aria-hidden="true" />
      ) : null}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
          <h2 className="ops-headline-h2 mt-1">{title}</h2>
        </div>
        {meta ? (
          <div className="lg:flex lg:self-stretch lg:border-l lg:border-ops-border-soft lg:pl-6">
            <div className="ops-flat-panel px-3 py-3 text-sm text-ops-text-secondary sm:min-w-[14rem] sm:text-right lg:flex lg:items-center lg:justify-end">
              {meta}
            </div>
          </div>
        ) : null}
      </div>
      {children}
    </NotchedFrame>
  );
}
