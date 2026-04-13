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
      {model.isDesktopHistory ? (
        <DesktopHistoryGrid model={model} />
      ) : (
        <MobileHistoryGrid model={model} />
      )}
    </SectionCard>
  );
}
