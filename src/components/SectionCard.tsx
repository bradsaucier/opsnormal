import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
}

export function SectionCard({ title, eyebrow, meta, children }: SectionCardProps) {
  return (
    <div className="panel-shadow">
      <div className="clip-notched bg-[linear-gradient(180deg,rgba(110,231,183,0.18),rgba(255,255,255,0.02))] p-px [--notch:12px]">
        <section className="tactical-panel clip-notched bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%),var(--color-ops-surface-1)] p-5 [--notch:11px] sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {eyebrow ? (
                <p className="text-xs font-semibold tracking-[0.24em] text-ops-accent-muted uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-lg font-semibold tracking-[0.06em] text-ops-text-primary uppercase">
                {title}
              </h2>
            </div>
            {meta ? <div className="text-sm text-ops-text-secondary">{meta}</div> : null}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
