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
          <div className="ops-tracking-section text-sm font-semibold uppercase text-ops-text-primary">
            {model.streak} day streak
          </div>
          <div className="ops-tracking-eyebrow text-xs uppercase text-ops-text-muted">
            Full daily check-ins
          </div>
        </div>
      }
    >
      {!model.hasEntries ? (
        <div className="ops-flat-panel-strong p-5 sm:p-6">
          <div className="max-w-2xl">
            <p className="ops-eyebrow text-ops-text-muted">No history yet</p>
            <h3 className="ops-headline-h3 mt-2">
              Today's check-ins will mirror here as you mark them.
            </h3>
            <p className="mt-3 text-sm leading-6 text-ops-text-secondary">
              The grid opens after the first saved sector so the page avoids a
              wall of unmarked cells.
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
