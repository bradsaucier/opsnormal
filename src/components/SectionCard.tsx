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
  return (
    <div className="panel-shadow">
      <div
        className={`clip-notched ops-notch-panel-outer ops-section-frame ops-section-emphasis-${emphasis} p-px`}
      >
        <section className="tactical-panel clip-notched ops-notch-panel-inner ops-section-surface p-6 sm:p-7 lg:p-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? (
                <p className="ops-eyebrow-strong ops-mono text-xs font-semibold text-ops-accent-muted">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="ops-tracking-section mt-1 text-2xl font-semibold text-ops-text-primary uppercase sm:text-3xl">
                {title}
              </h2>
            </div>
            {meta ? (
              <div className="clip-notched ops-notch-chip tactical-chip-panel px-3 py-3 text-sm text-ops-text-secondary sm:min-w-[14rem] sm:text-right">
                {meta}
              </div>
            ) : null}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
