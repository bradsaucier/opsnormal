import type { PropsWithChildren, ReactNode } from 'react';

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
    <div className="panel-shadow">
      <div
        className={`clip-notched ops-notch-panel-outer ops-section-frame ops-section-emphasis-${emphasis} p-px`}
      >
        <section className="tactical-panel clip-notched ops-notch-panel-inner ops-section-surface p-6 sm:p-7 lg:p-8">
          {emphasis === 'primary' ? (
            <span className="ops-section-primary-tick" aria-hidden="true" />
          ) : null}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
              <h2 className="ops-tracking-section mt-1 text-2xl font-semibold text-ops-text-primary uppercase">
                {title}
              </h2>
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
        </section>
      </div>
    </div>
  );
}
