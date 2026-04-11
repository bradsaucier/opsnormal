import { type ReactNode, useId } from 'react';


export type AccordionSectionKey = 'export' | 'import' | 'undo' | 'storage';

interface AccordionSectionProps {
  sectionKey: AccordionSectionKey;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  children: ReactNode;
}

export function AccordionSection({
  sectionKey,
  title,
  summary,
  isOpen,
  onToggle,
  children
}: AccordionSectionProps) {
  const headerId = useId();
  const panelId = useId();

  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(sectionKey)}
          className="flex min-h-[56px] w-full items-start justify-between gap-4 rounded-xl px-4 py-4 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <span>
            <span className="block font-mono text-xs font-semibold tracking-[0.22em] text-zinc-400 uppercase">
              {title}
            </span>
            <span className="mt-2 block text-sm leading-6 text-zinc-300">{summary}</span>
          </span>
          <span
            aria-hidden="true"
            className={`mt-1 text-lg leading-none text-emerald-300 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
        className="border-t border-white/10 px-4 py-4"
      >
        {children}
      </div>
    </div>
  );
}

function getSignalToneClasses(tone: 'default' | 'safe' | 'warning' = 'default'): string {
  if (tone === 'safe') {
    return 'border-emerald-400/25 bg-emerald-400/8';
  }

  if (tone === 'warning') {
    return 'border-amber-400/25 bg-amber-400/8';
  }

  return 'border-white/10 bg-black/20';
}

interface SignalCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'safe' | 'warning';
}

export function SignalCard({ label, value, detail, tone = 'default' }: SignalCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${getSignalToneClasses(tone)}`}>
      <dt className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">{label}</dt>
      <dd className="mt-2 text-sm font-semibold tracking-[0.08em] text-zinc-100 uppercase">
        {value}
      </dd>
      <dd className="mt-2 text-sm leading-6 text-zinc-300">{detail}</dd>
    </div>
  );
}

interface PreviewFactCardProps {
  label: string;
  value: string;
  detail?: string;
}

export function PreviewFactCard({ label, value, detail }: PreviewFactCardProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
      {detail ? <p className="mt-2 text-xs leading-5 text-zinc-400">{detail}</p> : null}
    </div>
  );
}
