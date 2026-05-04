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
      ? 'ops-eyebrow-strong ops-mono text-xs font-semibold text-ops-accent-muted'
      : 'ops-eyebrow ops-mono text-xs font-semibold text-ops-text-muted';

  return (
    <NotchedFrame
      notch="panel"
      outerClassName={`ops-section-frame ops-section-emphasis-${emphasis}`}
      innerClassName="tactical-panel ops-section-surface p-[var(--ops-space-card)]"
    >
      <section>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
            <h2 className="ops-headline-h2 mt-1 text-ops-text-primary">
              {title}
            </h2>
          </div>
          {meta ? (
            <div className="clip-notched ops-notch-chip tactical-chip-panel px-3 py-3 text-sm text-ops-text-secondary sm:min-w-[14rem] sm:text-right lg:flex lg:items-center lg:justify-end">
              {meta}
            </div>
          ) : null}
        </div>
        {children}
      </section>
    </NotchedFrame>
  );
}
