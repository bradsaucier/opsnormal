import { NotchedFrame } from '../../components/NotchedFrame';
import {
  getAlertSurfaceTonePalette,
  type AlertSurfaceTone,
} from '../../components/alertSurfaceTone';

import type { StatusMessage } from './workflowTypes';

interface StatusMessageRegionsProps {
  statusMessage: StatusMessage;
}

function getStatusSurfaceTone(statusMessage: StatusMessage): AlertSurfaceTone {
  if (statusMessage.tone === 'success') {
    return 'success';
  }

  if (statusMessage.tone === 'error') {
    return 'danger';
  }

  if (statusMessage.tone === 'warning') {
    return 'attention';
  }

  return 'neutral';
}

export function StatusMessageRegions({
  statusMessage,
}: StatusMessageRegionsProps) {
  const passiveStatusText =
    statusMessage.tone === 'info' || statusMessage.tone === 'success'
      ? statusMessage.text
      : '';
  const alertStatusText =
    statusMessage.tone === 'warning' || statusMessage.tone === 'error'
      ? statusMessage.text
      : '';

  const tonePalette = getAlertSurfaceTonePalette(
    getStatusSurfaceTone(statusMessage),
  );

  return (
    <div className="space-y-3">
      <div role="status" aria-atomic="true">
        {passiveStatusText ? (
          <NotchedFrame
            outerClassName={tonePalette.outerClassName}
            innerClassName={`p-4 text-sm leading-6 ${tonePalette.innerClassName} ${tonePalette.descriptionClassName}`}
          >
            {passiveStatusText}
          </NotchedFrame>
        ) : null}
      </div>
      <div role="alert" aria-atomic="true">
        {alertStatusText ? (
          <NotchedFrame
            outerClassName={tonePalette.outerClassName}
            innerClassName={`p-4 text-sm leading-6 ${tonePalette.innerClassName} ${tonePalette.descriptionClassName}`}
          >
            {alertStatusText}
          </NotchedFrame>
        ) : null}
      </div>
    </div>
  );
}
