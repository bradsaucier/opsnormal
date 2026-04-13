import { NotchedFrame } from '../../components/NotchedFrame';

import type { StatusMessage } from './workflowTypes';

interface StatusMessageRegionsProps {
  statusMessage: StatusMessage;
}

function getPassiveToneClasses(isSuccess: boolean): { outer: string; inner: string; text: string } {
  if (isSuccess) {
    return {
      outer:
        'bg-[linear-gradient(180deg,rgba(110,231,183,0.34),rgba(255,255,255,0.04))]',
      inner:
        'bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
      text: 'text-emerald-50'
    };
  }

  return {
    outer: 'bg-ops-border-soft',
    inner:
      'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),var(--color-ops-surface-overlay)]',
    text: 'text-ops-text-secondary'
  };
}

function getAlertToneClasses(isError: boolean): { outer: string; inner: string; text: string } {
  if (isError) {
    return {
      outer:
        'bg-[linear-gradient(180deg,rgba(248,113,113,0.34),rgba(255,255,255,0.04))]',
      inner:
        'bg-[linear-gradient(180deg,rgba(239,68,68,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
      text: 'text-red-100'
    };
  }

  return {
    outer:
      'bg-[linear-gradient(180deg,rgba(251,191,36,0.32),rgba(255,255,255,0.04))]',
    inner:
      'bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)]',
    text: 'text-amber-100'
  };
}

export function StatusMessageRegions({ statusMessage }: StatusMessageRegionsProps) {
  const passiveStatusText =
    statusMessage.tone === 'info' || statusMessage.tone === 'success' ? statusMessage.text : '';
  const alertStatusText =
    statusMessage.tone === 'warning' || statusMessage.tone === 'error' ? statusMessage.text : '';

  const passiveToneClasses = getPassiveToneClasses(statusMessage.tone === 'success');
  const alertToneClasses = getAlertToneClasses(statusMessage.tone === 'error');

  return (
    <div className="space-y-3">
      <div role="status" aria-atomic="true">
        {passiveStatusText ? (
          <NotchedFrame
            outerClassName={passiveToneClasses.outer}
            innerClassName={`p-4 text-sm leading-6 ${passiveToneClasses.inner} ${passiveToneClasses.text}`}
          >
            {passiveStatusText}
          </NotchedFrame>
        ) : null}
      </div>
      <div role="alert" aria-atomic="true">
        {alertStatusText ? (
          <NotchedFrame
            outerClassName={alertToneClasses.outer}
            innerClassName={`p-4 text-sm leading-6 ${alertToneClasses.inner} ${alertToneClasses.text}`}
          >
            {alertStatusText}
          </NotchedFrame>
        ) : null}
      </div>
    </div>
  );
}
