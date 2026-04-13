import { type KeyboardEvent, useId, useRef, useState } from 'react';

import { getStatusContent, getStatusLabel } from '../lib/status';
import type { Sector, UiStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface DomainCardProps {
  sector: Sector;
  status: UiStatus;
  busy?: boolean;
  onSelect: (sectorId: Sector['id'], status: UiStatus) => Promise<void>;
}

const STATUS_OPTIONS: UiStatus[] = ['unmarked', 'nominal', 'degraded'];

export function DomainCard({ sector, status, busy = false, onSelect }: DomainCardProps) {
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const radioRefs = useRef(new Map<UiStatus, HTMLButtonElement>());
  const [optimisticStatus, setOptimisticStatus] = useState<UiStatus | null>(null);

  const resolvedStatus = busy ? (optimisticStatus ?? status) : status;
  const statusLabel = getStatusLabel(resolvedStatus);

  const shellClassName = busy
    ? 'panel-shadow clip-notched ops-notch-panel-outer bg-ops-border-strong p-px'
    : 'panel-shadow clip-notched ops-notch-panel-outer bg-ops-border-strong p-px transition-colors hover:bg-emerald-200/16 focus-within:bg-emerald-200/20';

  function registerRadioRef(option: UiStatus, element: HTMLButtonElement | null) {
    if (!element) {
      radioRefs.current.delete(option);
      return;
    }

    radioRefs.current.set(option, element);
  }

  function handleRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>, optionIndex: number) {
    if (busy) {
      return;
    }

    let nextIndex: number | null = null;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        return;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (optionIndex + 1) % STATUS_OPTIONS.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (optionIndex - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = STATUS_OPTIONS.length - 1;
        break;
      default:
        break;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextStatus = STATUS_OPTIONS[nextIndex] ?? resolvedStatus;
    const nextRadio = radioRefs.current.get(nextStatus);
    nextRadio?.focus();

    if (nextStatus !== resolvedStatus) {
      setOptimisticStatus(nextStatus);
      void onSelect(sector.id, nextStatus);
    }
  }

  return (
    <div className={shellClassName}>
      <div className="clip-notched ops-notch-panel-inner tactical-panel flex min-h-[13rem] flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_28%),var(--color-ops-surface-2)] p-5 text-left">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-[0.24em] text-ops-text-muted uppercase">
              {sector.shortLabel}
            </span>
            <h3 className="mt-2 text-base font-semibold tracking-[0.06em] text-ops-text-primary uppercase">
              {sector.label}
            </h3>
            <p className="mt-3 text-sm leading-6 text-ops-text-secondary">{sector.description}</p>
          </div>
          <StatusBadge status={resolvedStatus} />
        </div>

        <div className="mt-5 clip-notched ops-notch-chip tactical-subpanel px-4 py-4">
          <div className="flex items-center justify-between gap-3 border-b border-ops-border-soft pb-3 text-xs tracking-[0.16em] text-ops-text-secondary uppercase">
            <span>{busy ? 'SAVING' : 'DIRECT SELECT'}</span>
            <span>{statusLabel}</span>
          </div>

          <p id={hintId} className="mt-3 text-xs leading-5 text-ops-text-secondary">
            {busy
              ? 'Saving local write. Stand by.'
              : 'Choose a state directly. Arrow keys move inside the control group.'}
          </p>

          <div
            role="radiogroup"
            aria-label={`${sector.label} status`}
            aria-describedby={hintId}
            className="mt-3 grid grid-cols-3 gap-2"
          >
            {STATUS_OPTIONS.map((option, optionIndex) => {
              const content = getStatusContent(option);
              const isSelected = option === resolvedStatus;

              return (
                <button
                  key={option}
                  ref={(element) => registerRadioRef(option, element)}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${sector.label} ${content.label}`}
                  tabIndex={isSelected ? 0 : -1}
                  disabled={busy}
                  onClick={() => {
                    setOptimisticStatus(option);
                    void onSelect(sector.id, option);
                  }}
                  onKeyDown={(event) => handleRadioKeyDown(event, optionIndex)}
                  className={[
                    'clip-notched tactical-chip-panel min-h-11 border border-ops-border-soft px-2 py-2 text-center text-[11px] font-semibold tracking-[0.16em] uppercase transition motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ops-accent disabled:cursor-wait disabled:opacity-70',
                    isSelected
                      ? `${content.classes} ring-2 ring-inset ring-ops-accent/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`
                      : 'text-ops-text-secondary hover:border-ops-border-struct hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_32%),var(--color-ops-surface-overlay)]'
                  ].join(' ')}
                >
                  {content.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
