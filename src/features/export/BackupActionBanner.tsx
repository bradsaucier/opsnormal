import { AlertSurface } from '../../components/AlertSurface';
import { getAlertSurfaceActionToneClass } from '../../components/alertSurfaceTone';
import type { BackupActionPrompt } from './backupActionPrompt';

interface BackupActionBannerProps {
  prompt: BackupActionPrompt | null;
}

export function BackupActionBanner({ prompt }: BackupActionBannerProps) {
  if (!prompt) {
    return null;
  }

  return (
    <AlertSurface
      tone={prompt.tone}
      title={prompt.title}
      description={prompt.detail}
      role="alert"
      titleId="backup-action-banner-title"
      actions={
        <a
          href="#backup-and-recovery"
          className={getAlertSurfaceActionToneClass(prompt.tone)}
        >
          Open backup and recovery
        </a>
      }
    />
  );
}
