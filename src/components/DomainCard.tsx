import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { getStatusContent } from '../lib/status';
import type { Sector, UiStatus } from '../types';
import { SectorGlyphMark } from './icons/SectorGlyphs';

interface DomainCardProps {
  sector: Sector;
  sectorSigil: string;
  instructionId?: string;
  status: UiStatus;
  busy?: boolean;
  onSelect: (sectorId: Sector['id'], status: UiStatus) => Promise<void>;
}

const STATUS_OPTIONS: UiStatus[] = ['unmarked', 'nominal', 'degraded'];
const RADIO_CONTROL_KEYS = new Set([
  ' ',
  'Enter',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft',
  'ArrowUp',
  'Home',
  'End',
]);

export function DomainCard({
  sector,
  sectorSigil,
  instructionId,
  status,
  busy = false,
  onSelect,
}: DomainCardProps) {
  const groupId = useId();
  const busyHintId = `${groupId}-busy-hint`;
  const radioRefs = useRef(new Map<UiStatus, HTMLButtonElement>());
  const pendingKeyboardFocusStatusRef = useRef<UiStatus | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<UiStatus | null>(
    null,
  );

  const resolvedStatus = busy ? (optimisticStatus ?? status) : status;
  const spineClassName =
    resolvedStatus === 'nominal'
      ? 'ops-sector-spine-nominal'
      : resolvedStatus === 'degraded'
        ? 'ops-sector-spine-degraded'
        : 'ops-sector-spine-unmarked';
  const describedBy = busy
    ? [instructionId, busyHintId].filter(Boolean).join(' ') || undefined
    : instructionId;

  const shellClassName = busy
    ? 'panel-shadow clip-notched ops-notch-panel-outer bg-ops-border-strong p-px'
    : 'panel-shadow clip-notched ops-notch-panel-outer bg-ops-border-strong p-px transition-colors hover:bg-ops-accent/16 focus-within:bg-ops-accent/20';

  useEffect(() => {
    const pendingStatus = pendingKeyboardFocusStatusRef.current;

    if (!pendingStatus) {
      return;
    }

    const pendingRadio = radioRefs.current.get(pendingStatus);

    if (!pendingRadio) {
      return;
    }

    if (document.activeElement !== pendingRadio) {
      pendingRadio.focus({ preventScroll: true });
    }

    if (!busy) {
      pendingKeyboardFocusStatusRef.current = null;
    }
  }, [busy, resolvedStatus]);

  function registerRadioRef(
    option: UiStatus,
    element: HTMLButtonElement | null,
  ) {
    if (!element) {
      radioRefs.current.delete(option);
      return;
    }

    radioRefs.current.set(option, element);
  }

  function handleRadioKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    optionIndex: number,
  ) {
    if (busy) {
      if (RADIO_CONTROL_KEYS.has(event.key)) {
        event.preventDefault();
      }

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
        nextIndex =
          (optionIndex - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length;
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
    pendingKeyboardFocusStatusRef.current = nextStatus;
    nextRadio?.focus({ preventScroll: true });

    if (nextStatus !== resolvedStatus) {
      setOptimisticStatus(nextStatus);
      void onSelect(sector.id, nextStatus);
    }
  }

  return (
    <div className={shellClassName}>
      <div
        className={[
          'clip-notched ops-notch-panel-inner tactical-panel flex min-h-[13rem] flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_28%),var(--color-ops-surface-2)] p-4 text-left sm:p-5',
          spineClassName,
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          <span
            className="clip-notched ops-notch-chip tactical-chip-panel inline-flex h-9 w-9 shrink-0 items-center justify-center border border-ops-border-soft text-ops-text-muted"
            aria-hidden="true"
          >
            <SectorGlyphMark sectorId={sector.id} />
          </span>
          <div className="min-w-0">
            <span className="ops-mono flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-ops-text-muted uppercase">
              <span className="text-ops-accent/70">{sectorSigil}</span>
              <span
                className="h-3 w-px bg-ops-border-struct"
                aria-hidden="true"
              />
              <span>{sector.shortLabel}</span>
            </span>
            <h3 className="mt-1.5 text-lg font-semibold tracking-[0.08em] text-ops-text-primary uppercase">
              {sector.label}
            </h3>
            <p className="mt-2.5 text-sm leading-6 text-ops-text-secondary">
              {sector.description}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="ops-sector-caption border-t border-ops-border-soft pt-3">
            <span>{busy ? 'SAVING' : 'STATE'}</span>
          </div>

          {busy ? (
            <span id={busyHintId} className="sr-only">
              Saving local write. Stand by.
            </span>
          ) : null}

          <div
            role="radiogroup"
            aria-label={`${sector.label} status`}
            aria-describedby={describedBy}
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
                  aria-disabled={busy || undefined}
                  aria-label={`${sector.label} ${content.label}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={(event) => {
                    if (busy) {
                      event.preventDefault();
                      return;
                    }

                    setOptimisticStatus(option);
                    event.currentTarget.focus({ preventScroll: true });
                    void onSelect(sector.id, option);
                  }}
                  onKeyDown={(event) => handleRadioKeyDown(event, optionIndex)}
                  className={[
                    'ops-focus-ring-chip ops-radio-chip tactical-chip-panel min-h-11 border px-2 py-2 text-center text-[11px] font-semibold tracking-[0.12em] uppercase',
                    busy ? 'cursor-wait opacity-70' : '',
                    isSelected
                      ? `${content.classes} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`
                      : 'ops-radio-chip-ghost text-ops-text-secondary hover:text-ops-text-primary',
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
