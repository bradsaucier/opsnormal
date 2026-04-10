import type { BackupActionPrompt } from './backupActionPrompt';

interface BackupActionBannerProps {
  prompt: BackupActionPrompt | null;
}

export function BackupActionBanner({ prompt }: BackupActionBannerProps) {
  if (!prompt) {
    return null;
  }

  return (
    <div className="panel-shadow">
      <section
        role="alert"
        className="clip-notched border border-orange-400/35 bg-orange-400/10 p-4 [--notch:12px] sm:p-5"
        aria-labelledby="backup-action-banner-title"
      >
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
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-orange-200/40 bg-orange-200/10 px-4 py-2 text-xs font-semibold tracking-[0.16em] text-orange-50 uppercase transition hover:bg-orange-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-100"
            >
              Open backup and recovery
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
