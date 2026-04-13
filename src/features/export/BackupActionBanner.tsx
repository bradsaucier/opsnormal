import { NotchedFrame } from '../../components/NotchedFrame';
import type { BackupActionPrompt } from './backupActionPrompt';

interface BackupActionBannerProps {
  prompt: BackupActionPrompt | null;
}

export function BackupActionBanner({ prompt }: BackupActionBannerProps) {
  if (!prompt) {
    return null;
  }

  return (
    <NotchedFrame
      outerClassName="bg-orange-400/35"
      innerClassName="bg-[linear-gradient(180deg,rgba(251,146,60,0.12),rgba(255,255,255,0.02)),var(--color-ops-surface-raised)] p-4 sm:p-5"
    >
      <section role="alert" aria-labelledby="backup-action-banner-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="backup-action-banner-title"
              className="text-sm font-semibold tracking-[0.16em] text-orange-100 uppercase"
            >
              {prompt.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-orange-50/90">{prompt.detail}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#backup-and-recovery"
              className="ops-action-button ops-action-button-orange inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-semibold tracking-[0.16em] uppercase transition"
            >
              Open backup and recovery
            </a>
          </div>
        </div>
      </section>
    </NotchedFrame>
  );
}
