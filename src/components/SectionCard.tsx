import type { PropsWithChildren, ReactNode } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  meta?: ReactNode;
}

export function SectionCard({ title, eyebrow, meta, children }: SectionCardProps) {
  return (
    <section className="tactical-panel rounded-lg border border-emerald-400/15 bg-black/40 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-5">
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
  );
}
