import { SectionCard } from '../../components/SectionCard';

import { DesktopHistoryGrid } from './DesktopHistoryGrid';
import type { HistoryGridProps } from './historyGridShared';
import { MobileHistoryGrid } from './MobileHistoryGrid';
import { useHistoryGridModel } from './useHistoryGridModel';

export function HistoryGrid(props: HistoryGridProps) {
  const model = useHistoryGridModel(props);

  return (
    <SectionCard
      eyebrow="Rolling History"
      title="30-Day Readiness Grid"
      meta={
        <div className="space-y-1 text-right">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-ops-text-primary">
            {model.streak} day streak
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-ops-text-muted">
            Full daily check-ins
          </div>
        </div>
      }
    >
      {!model.hasEntries ? (
        <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
          <div className="clip-notched ops-notch-panel-inner tactical-subpanel-strong p-5 sm:p-6">
            <p className="ops-eyebrow text-xs font-semibold tracking-[0.18em] text-ops-text-muted uppercase">
              Awaiting signal
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[0.08em] text-ops-text-primary uppercase">
              Patterns will appear here after your first daily check-in.
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ops-text-secondary">
              Today is live above. Mark one sector and this panel will open the
              rolling readiness picture.
            </p>
          </div>
        </div>
      ) : model.isDesktopHistory ? (
        <DesktopHistoryGrid model={model} />
      ) : (
        <MobileHistoryGrid model={model} />
      )}
    </SectionCard>
  );
}
