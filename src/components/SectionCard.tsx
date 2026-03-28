import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
}

export function SectionCard({ title, eyebrow, meta, children }: SectionCardProps) {
  return (
    <div className="panel-shadow">
      <div className="clip-notched bg-emerald-400/15 p-px [--notch:12px]">
        <section className="tactical-panel clip-notched bg-black/40 p-4 [--notch:11px] sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {eyebrow ? (
                <p className="text-xs font-semibold tracking-[0.24em] text-emerald-400/80 uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-lg font-semibold tracking-[0.08em] text-white uppercase">
                {title}
              </h2>
            </div>
            {meta ? <div className="text-sm text-zinc-300">{meta}</div> : null}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
