import { StatusBadge } from '../../components/StatusBadge';
import { StatusLegend } from '../../components/StatusLegend';
import { SectorGlyphMark } from '../../components/icons/SectorGlyphs';
import { NotchedFrame } from '../../components/NotchedFrame';
import { formatDayLabel, formatLongDate } from '../../lib/date';
import { getUiStatus } from '../../lib/history';
import { getStatusCellText, getStatusLabel } from '../../lib/status';
import { SECTORS } from '../../types';
import { getCellClassName, getStatusSpineClassName } from './historyGridShared';
import type { HistoryGridModel } from './useHistoryGridModel';

interface MobileHistoryGridProps {
  model: HistoryGridModel;
}

// Keep the first track at a fixed readable minimum while preserving CSP-safe static class names.
const MOBILE_WEEK_GRID_COLUMN_CLASS = {
  1: 'grid-cols-[minmax(4.5rem,_auto)_repeat(1,_minmax(0,_1fr))]',
  2: 'grid-cols-[minmax(4.5rem,_auto)_repeat(2,_minmax(0,_1fr))]',
  3: 'grid-cols-[minmax(4.5rem,_auto)_repeat(3,_minmax(0,_1fr))]',
  4: 'grid-cols-[minmax(4.5rem,_auto)_repeat(4,_minmax(0,_1fr))]',
  5: 'grid-cols-[minmax(4.5rem,_auto)_repeat(5,_minmax(0,_1fr))]',
  6: 'grid-cols-[minmax(4.5rem,_auto)_repeat(6,_minmax(0,_1fr))]',
  7: 'grid-cols-[minmax(4.5rem,_auto)_repeat(7,_minmax(0,_1fr))]',
} as const;

function getMobileWeekGridColumnsClass(dayCount: number) {
  return (
    MOBILE_WEEK_GRID_COLUMN_CLASS[
      dayCount as keyof typeof MOBILE_WEEK_GRID_COLUMN_CLASS
    ] ?? MOBILE_WEEK_GRID_COLUMN_CLASS[7]
  );
}

function WeekChevronIcon({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={
          direction === 'previous'
            ? 'M7.5 2.5 L4 6 L7.5 9.5'
            : 'M4.5 2.5 L8 6 L4.5 9.5'
        }
      />
    </svg>
  );
}

export function MobileHistoryGrid({ model }: MobileHistoryGridProps) {
  const {
    canScrollLeft,
    canScrollRight,
    canViewNextWeek,
    canViewPreviousWeek,
    entryLookup,
    handleDaySelection,
    handleNextWeek,
    handlePreviousWeek,
    ids,
    mobileScrollRef,
    registerWeekRef,
    selectedCell,
    selectedStatus,
    selectedDayStatuses,
    selectedDaySummary,
    todayKey,
    visibleWeekEnd,
    visibleWeekIndex,
    visibleWeekStart,
    weekGroups,
  } = model;

  const visibleWeekHeadingId = `${ids.mobileRegionId}-visible-week-heading`;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <div className="space-y-1">
          <p className="max-w-2xl text-sm leading-6 text-ops-text-secondary">
            Mobile holds the history picture one week at a time. Swipe by week
            or step the window with the week controls. Tap a day column for the
            daily brief.
          </p>
          <p className="ops-tracking-caption text-xs leading-5 text-ops-text-muted">
            Week groups snap into place. Explicit previous and next controls
            keep the path visible when swipe is inconvenient or unavailable.
          </p>
        </div>

        <NotchedFrame
          withShadow={false}
          outerClassName="bg-ops-border-struct"
          innerClassName="tactical-subpanel p-3"
        >
          <nav
            aria-label="Week navigation"
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2"
          >
            <button
              type="button"
              onClick={handlePreviousWeek}
              disabled={!canViewPreviousWeek}
              aria-controls={ids.mobileRegionId}
              aria-label="Previous week"
              className="ops-action-button ops-action-button-sm ops-action-button-subtle"
            >
              <WeekChevronIcon direction="previous" />
              <span className="max-[360px]:sr-only">Prev</span>
            </button>
            <div
              data-testid="mobile-history-week-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="ops-flat-panel ops-tracking-grid px-3 py-2 text-center text-xs uppercase text-ops-text-secondary max-[360px]:px-2"
            >
              <span className="block text-[10px] text-ops-text-muted">
                Week {visibleWeekIndex + 1} of {weekGroups.length}
              </span>
              <h3
                id={visibleWeekHeadingId}
                className="mt-1 text-xs text-ops-text-primary"
              >
                Week of {formatDayLabel(visibleWeekStart)} to{' '}
                {formatDayLabel(visibleWeekEnd)}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleNextWeek}
              disabled={!canViewNextWeek}
              aria-controls={ids.mobileRegionId}
              aria-label="Next week"
              className="ops-action-button ops-action-button-sm ops-action-button-subtle"
            >
              <span className="max-[360px]:sr-only">Next</span>
              <WeekChevronIcon direction="next" />
            </button>
          </nav>
          <div className="mt-3 border-t border-ops-border-soft pt-3">
            <StatusLegend />
          </div>
        </NotchedFrame>
      </div>

      <p id={ids.captionId} className="sr-only">
        Weekly readiness history.
      </p>
      <p id={ids.instructionsId} className="sr-only">
        Swipe left or right, or use the previous and next week buttons, to move
        by week. Activate a day header to open the daily brief for that date.
        The daily brief lists all five sector states for the selected day.
      </p>

      <div className="relative">
        {canScrollLeft ? (
          <div
            aria-hidden="true"
            className="ops-history-edge-left pointer-events-none absolute top-0 left-0 z-30 h-full w-6"
          />
        ) : null}
        {canScrollRight ? (
          <div
            aria-hidden="true"
            className="ops-history-edge-right pointer-events-none absolute top-0 right-0 z-30 h-full w-10"
          />
        ) : null}

        <div
          id={ids.mobileRegionId}
          ref={mobileScrollRef}
          className={[
            'history-scroll-shell history-scroll-shell-mobile flex gap-3 overflow-x-auto',
            canScrollRight ? 'pr-10' : 'pr-0',
          ].join(' ')}
          role="region"
          aria-labelledby={ids.captionId}
          aria-describedby={`${ids.instructionsId} ${ids.statusSummaryId}`}
          tabIndex={0}
        >
          {weekGroups.map((weekGroup, weekIndex) => {
            const weekStart = weekGroup[0] ?? selectedCell.dateKey;
            const weekEnd =
              weekGroup[weekGroup.length - 1] ?? selectedCell.dateKey;
            const weekHeadingId = `${ids.mobileRegionId}-week-heading-${weekIndex}`;
            const weekStateId = `${ids.mobileRegionId}-week-state-${weekIndex}`;

            return (
              <NotchedFrame
                key={weekStart}
                ref={(element) =>
                  registerWeekRef(weekIndex, element as HTMLDivElement | null)
                }
                data-week-index={weekIndex}
                role="group"
                aria-labelledby={weekHeadingId}
                aria-describedby={weekStateId}
                className="history-week-card w-[calc(100%-2.75rem)] min-w-[17.5rem] max-w-[24rem] shrink-0"
                withShadow={false}
                outerClassName="bg-ops-border-struct"
                innerClassName="tactical-subpanel p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="ops-tracking-eyebrow text-xs font-semibold uppercase text-ops-text-muted">
                      Week {weekIndex + 1}
                    </p>
                    <p
                      id={weekHeadingId}
                      className="ops-tracking-grid mt-1 text-xs uppercase text-ops-text-secondary"
                    >
                      {formatDayLabel(weekStart)} to {formatDayLabel(weekEnd)}
                    </p>
                  </div>
                  <div
                    id={weekStateId}
                    className={[
                      'ops-flat-panel ops-tracking-grid px-2.5 py-1 text-right text-[10px] font-semibold uppercase',
                      visibleWeekIndex === weekIndex
                        ? 'text-ops-accent-muted'
                        : 'text-ops-text-muted',
                    ].join(' ')}
                  >
                    {visibleWeekIndex === weekIndex ? 'On deck' : 'Stand by'}
                  </div>
                </div>

                <div
                  className={`grid gap-2 ${getMobileWeekGridColumnsClass(weekGroup.length)}`}
                >
                  <div className="ops-tracking-grid sticky left-0 z-10 bg-ops-surface-2 px-2 py-2 text-left text-[11px] font-semibold uppercase text-ops-text-secondary">
                    Sector
                  </div>
                  {weekGroup.map((dateKey) => {
                    const isToday = dateKey === todayKey;
                    const isSelectedDay = dateKey === selectedCell.dateKey;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => handleDaySelection(dateKey)}
                        aria-label={`Open daily brief for ${formatLongDate(dateKey)}`}
                        aria-controls="mobile-history-daily-brief"
                        aria-pressed={isSelectedDay}
                        aria-current={isToday ? 'date' : undefined}
                        className={[
                          'ops-focus-ring-chip ops-notch-chip clip-notched ops-tracking-grid min-h-11 border px-2 py-2 text-center text-[11px] font-semibold uppercase transition hover:border-ops-border-struct hover:bg-white/[0.045] hover:text-ops-text-primary',
                          isSelectedDay
                            ? 'border-ops-accent bg-emerald-300/12 text-ops-accent-muted'
                            : 'border-ops-border-soft bg-ops-surface-2 text-ops-text-secondary',
                          isToday && !isSelectedDay
                            ? 'ops-history-today-cell'
                            : '',
                        ].join(' ')}
                      >
                        <span className="block text-[10px] text-ops-text-muted">
                          {formatLongDate(dateKey).split(',')[0]}
                        </span>
                        <span className="mt-1 block">
                          {formatDayLabel(dateKey)}
                        </span>
                      </button>
                    );
                  })}

                  {SECTORS.map((sector) => {
                    return [
                      <div
                        key={`${sector.id}:label`}
                        className="ops-tracking-grid sticky left-0 z-10 flex min-h-11 items-center gap-2 bg-ops-surface-2 px-2 text-[11px] font-semibold uppercase text-ops-text-primary"
                      >
                        <span
                          className="text-ops-text-muted"
                          aria-hidden="true"
                        >
                          <SectorGlyphMark sectorId={sector.id} />
                        </span>
                        <span>{sector.shortLabel}</span>
                      </div>,
                      ...weekGroup.map((dateKey) => {
                        const status = getUiStatus(
                          entryLookup,
                          dateKey,
                          sector.id,
                        );
                        const isSelectedDay = dateKey === selectedCell.dateKey;
                        const cellLabel = `${sector.label} on ${formatLongDate(dateKey)}: ${getStatusLabel(status)}.`;

                        return (
                          <div
                            key={`${sector.id}:${dateKey}`}
                            className={[
                              'ops-grid-cell min-h-10 transition [font-variant-numeric:tabular-nums]',
                              isSelectedDay
                                ? 'outline outline-1 -outline-offset-1 outline-[var(--ops-focus-ring)]'
                                : '',
                              getCellClassName(status),
                            ].join(' ')}
                            title={cellLabel}
                          >
                            {getStatusCellText(status)}
                          </div>
                        );
                      }),
                    ];
                  })}
                </div>
              </NotchedFrame>
            );
          })}
        </div>

        <div
          className="mt-3 flex items-center justify-center gap-2"
          aria-hidden="true"
        >
          {weekGroups.map((weekGroup, weekIndex) => (
            <span
              key={weekGroup[0] ?? `week-${weekIndex}`}
              className={[
                'clip-notched ops-notch-chip h-[3px] w-3 border',
                visibleWeekIndex === weekIndex
                  ? 'border-ops-accent bg-ops-accent'
                  : 'border-ops-border-struct bg-transparent',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <NotchedFrame
        id="mobile-history-daily-brief"
        className="mt-4"
        aria-live="polite"
        withShadow={false}
        outerClassName="bg-ops-border-struct"
        innerClassName={`tactical-subpanel-strong ops-flat-panel-strong p-4 ${getStatusSpineClassName(selectedStatus)}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="ops-eyebrow text-ops-text-muted">Daily brief</p>
            <h3 className="ops-headline-h3 mt-2">
              {formatLongDate(selectedCell.dateKey)}
            </h3>
            <p
              id={ids.statusSummaryId}
              className="mt-2 text-sm leading-6 text-ops-text-secondary"
            >
              {selectedDaySummary}
            </p>
          </div>
          <div className="ops-flat-panel ops-tracking-grid px-3 py-2 text-xs uppercase text-ops-text-secondary">
            {visibleWeekIndex + 1} of {weekGroups.length} week groups
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {selectedDayStatuses.map(({ sector, status }) => (
            <div
              key={sector.id}
              className="tactical-chip-panel flex items-center justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-ops-text-muted" aria-hidden="true">
                    <SectorGlyphMark sectorId={sector.id} />
                  </span>
                  <p className="ops-tracking-section text-sm font-semibold uppercase text-ops-text-primary">
                    {sector.label}
                  </p>
                </div>
                <p className="mt-1 text-xs leading-5 text-ops-text-secondary">
                  {sector.description}
                </p>
                <p className="mt-2 text-xs leading-5 text-ops-text-secondary">
                  State:{' '}
                  <span className="text-ops-text-primary">
                    {getStatusLabel(status)}
                  </span>
                </p>
              </div>
              <StatusBadge status={status} size="sm" />
            </div>
          ))}
        </div>
      </NotchedFrame>
    </>
  );
}
