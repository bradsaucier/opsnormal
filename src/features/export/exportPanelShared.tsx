import { NotchedFrame } from '../../components/NotchedFrame';

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
  children,
}: AccordionSectionProps) {
  const headerId = useId();
  const panelId = useId();

  return (
    <NotchedFrame
      outerClassName={isOpen ? 'bg-ops-panel-border-strong' : 'bg-ops-border-struct'}
      innerClassName={isOpen ? 'tactical-subpanel-strong' : 'tactical-subpanel'}
    >
      {isOpen ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-ops-accent-border"
        />
      ) : null}
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(sectionKey)}
          className="ops-focus-ring-inset flex min-h-[56px] w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/4"
        >
          <span>
            <span className="block text-xs font-semibold tracking-[0.22em] text-ops-text-muted uppercase">
              {title}
            </span>
            <span className="mt-2 block text-sm leading-6 text-ops-text-secondary">
              {summary}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`mt-1 text-lg leading-none text-ops-accent transition-transform ${isOpen ? 'rotate-90' : ''}`}
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
        className="border-t border-ops-border-soft px-4 py-4"
      >
        {children}
      </div>
    </NotchedFrame>
  );
}

function getSignalChromeClasses(
  tone: 'default' | 'safe' | 'warning' = 'default',
): {
  outer: string;
  inner: string;
  label: string;
  value: string;
  detail: string;
} {
  if (tone === 'safe') {
    return {
      outer: 'bg-ops-panel-border-strong',
      inner:
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02)_28%),var(--color-ops-surface-raised)]',
      label: 'text-ops-text-muted',
      value: 'text-ops-text-primary',
      detail: 'text-ops-text-secondary',
    };
  }

  if (tone === 'warning') {
    return {
      outer: 'bg-ops-panel-border-strong',
      inner:
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02)_28%),var(--color-ops-surface-raised)]',
      label: 'text-amber-200/80',
      value: 'text-amber-100',
      detail: 'text-ops-text-secondary',
    };
  }

  return {
    outer: 'bg-ops-border-soft',
    inner:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%),var(--color-ops-surface-overlay)]',
    label: 'text-ops-text-muted',
    value: 'text-ops-text-primary',
    detail: 'text-ops-text-secondary',
  };
}

interface SignalCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'safe' | 'warning';
}

export function SignalCard({
  label,
  value,
  detail,
  tone = 'default',
}: SignalCardProps) {
  const chromeClasses = getSignalChromeClasses(tone);

  return (
    <div role="listitem">
      <NotchedFrame
        outerClassName={chromeClasses.outer}
        innerClassName={`p-4 ${chromeClasses.inner}`}
      >
        <p
          className={`text-xs font-semibold tracking-[0.16em] uppercase ${chromeClasses.label}`}
        >
          {label}
        </p>
        <p
          className={`mt-2 text-sm font-semibold tracking-[0.08em] uppercase ${chromeClasses.value}`}
        >
          {value}
        </p>
        <p className={`mt-2 text-sm leading-6 ${chromeClasses.detail}`}>
          {detail}
        </p>
      </NotchedFrame>
    </div>
  );
}

interface PreviewFactCardProps {
  label: string;
  value: string;
  detail?: string;
}

export function PreviewFactCard({
  label,
  value,
  detail,
}: PreviewFactCardProps) {
  return (
    <div role="listitem" className="panel-shadow">
      <div className="clip-notched ops-notch-chip bg-ops-border-soft p-px">
        <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-overlay)] p-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-ops-text-muted uppercase">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-ops-text-primary">
            {value}
          </p>
          {detail ? (
            <p className="mt-2 text-xs leading-5 text-ops-text-muted">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
