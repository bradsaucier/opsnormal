import { StatusBadge } from '../../components/StatusBadge';
import { StatusLegend } from '../../components/StatusLegend';
import { SectorGlyphMark } from '../../components/icons/SectorGlyphs';
import { NotchedFrame } from '../../components/NotchedFrame';
import { formatDayLabel, formatLongDate } from '../../lib/date';
import { getUiStatus } from '../../lib/history';
import { getStatusCellText, getStatusLabel } from '../../lib/status';
import { SECTORS } from '../../types';
import {
  buildCellKey,
  getCellClassName,
  getStatusSpineClassName,
} from './historyGridShared';
import type { HistoryGridModel } from './useHistoryGridModel';

interface DesktopHistoryGridProps {
  model: HistoryGridModel;
}

export function DesktopHistoryGrid({ model }: DesktopHistoryGridProps) {
  const {
    canScrollLeft,
    canScrollRight,
    dateKeys,
    desktopScrollRef,
    entryLookup,
    handleCellFocus,
    handleCellKeyDown,
    handleCellSelection,
    ids,
    registerCellRef,
    selectedCell,
    selectedSector,
    selectedStatus,
    selectedStatusSummary,
    todayKey,
  } = model;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="max-w-2xl text-sm leading-6 text-ops-text-secondary">
            This grid is the mirror. Patterns matter more than extra
            instrumentation.
          </p>
          <p className="ops-tracking-caption text-xs leading-5 text-ops-text-muted">
            Desktop holds the full 30-day picture. Tab exits the grid. Select a
            cell for the detail brief.
          </p>
        </div>
        <div className="lg:self-end">
          <StatusLegend />
        </div>
      </div>

      <p id={ids.instructionsId} className="sr-only">
        After focusing a history cell, use the arrow keys to move one cell at a
        time. Home and End move to the first or last day in the current row.
        Control plus Home jumps to the first cell in the grid. Control plus End
        jumps to the last cell in the grid. Page Up and Page Down move seven
        days at a time. Tab exits the grid.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative min-w-0">
          {canScrollLeft ? (
            <div
              aria-hidden="true"
              className="ops-history-edge-left pointer-events-none absolute top-0 left-0 z-40 h-full w-6"
            />
          ) : null}
          {canScrollRight ? (
            <div
              aria-hidden="true"
              className="ops-history-edge-right pointer-events-none absolute top-0 right-0 z-40 h-full w-6"
            />
          ) : null}
          <NotchedFrame
            withShadow={false}
            outerClassName="bg-ops-border-struct"
            innerClassName="tactical-subpanel"
          >
            <div
              ref={desktopScrollRef}
              className="history-scroll-shell overflow-x-auto"
              role="region"
              aria-labelledby={ids.captionId}
            >
              <table
                className="min-w-max w-full border-separate border-spacing-0 text-sm"
                role="grid"
                aria-readonly="true"
                aria-describedby={`${ids.instructionsId} ${ids.statusSummaryId}`}
                aria-colcount={dateKeys.length + 1}
                aria-rowcount={SECTORS.length + 1}
              >
                <caption id={ids.captionId} className="sr-only">
                  Thirty-day readiness grid with one row per sector and one
                  column per day. Cell labels use OK for nominal, DG for
                  degraded, and UN for unmarked.
                </caption>
                <thead role="rowgroup">
                  <tr
                    role="row"
                    className="shadow-[0_1px_0_var(--color-ops-border-struct)]"
                  >
                    <th
                      role="columnheader"
                      className="ops-tracking-grid sticky top-0 left-0 z-30 border-r border-b border-ops-border-struct bg-ops-surface-2 px-4 py-1.5 text-left text-xs font-semibold text-ops-text-secondary uppercase"
                      scope="col"
                    >
                      Sector
                    </th>
                    {dateKeys.map((dateKey, dateIndex) => {
                      const isToday = dateKey === todayKey;
                      const isSelectedColumn = dateKey === selectedCell.dateKey;

                      return (
                        <th
                          key={dateKey}
                          role="columnheader"
                          className={[
                            'ops-tracking-grid sticky top-0 z-20 min-w-[2.75rem] border-b border-ops-border-struct px-2 py-1.5 text-center text-xs font-semibold uppercase',
                            (dateIndex + 1) % 7 === 0
                              ? 'ops-history-week-boundary'
                              : '',
                            isToday
                              ? 'ops-history-today-header bg-emerald-300/10 text-ops-accent-muted'
                              : isSelectedColumn
                                ? 'bg-white/[0.035] text-ops-text-primary'
                                : 'bg-ops-surface-1 text-ops-text-secondary',
                          ].join(' ')}
                          scope="col"
                          aria-current={isToday ? 'date' : undefined}
                          title={isToday ? 'Today' : undefined}
                        >
                          {formatDayLabel(dateKey)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {SECTORS.map((sector, sectorIndex) => {
                    const isSelectedRow = sector.id === selectedCell.sectorId;

                    return (
                      <tr
                        key={sector.id}
                        role="row"
                        className={[
                          'ops-history-row',
                          isSelectedRow ? 'bg-white/[0.035]' : '',
                        ].join(' ')}
                      >
                        <th
                          role="rowheader"
                          className={[
                            'ops-history-sector-divider ops-tracking-table sticky left-0 z-20 border-r border-ops-border-struct bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase',
                            isSelectedRow
                              ? 'text-ops-accent-muted'
                              : 'text-ops-text-primary',
                          ].join(' ')}
                          scope="row"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="text-ops-text-muted"
                              aria-hidden="true"
                            >
                              <SectorGlyphMark sectorId={sector.id} />
                            </span>
                            <span>{sector.label}</span>
                          </span>
                        </th>
                        {dateKeys.map((dateKey, dateIndex) => {
                          const status = getUiStatus(
                            entryLookup,
                            dateKey,
                            sector.id,
                          );
                          const isToday = dateKey === todayKey;
                          const isSelected =
                            dateKey === selectedCell.dateKey &&
                            sector.id === selectedCell.sectorId;
                          const cellLabel = `${sector.label} on ${formatLongDate(dateKey)}: ${getStatusLabel(status)}.`;

                          return (
                            <td
                              key={`${sector.id}:${dateKey}`}
                              ref={(element) =>
                                registerCellRef(
                                  buildCellKey(sector.id, dateKey),
                                  element,
                                )
                              }
                              role="gridcell"
                              aria-label={cellLabel}
                              aria-describedby={ids.statusSummaryId}
                              aria-selected={isSelected}
                              tabIndex={isSelected ? 0 : -1}
                              onClick={() =>
                                handleCellSelection({
                                  dateKey,
                                  sectorId: sector.id,
                                })
                              }
                              onFocus={() =>
                                handleCellFocus({
                                  dateKey,
                                  sectorId: sector.id,
                                })
                              }
                              onKeyDown={(event) =>
                                handleCellKeyDown(event, sectorIndex, dateIndex)
                              }
                              className={[
                                'ops-focus-ring-chip-proxy ops-history-cell ops-history-sector-divider cursor-pointer px-0.5 py-1 align-middle outline-none',
                                (dateIndex + 1) % 7 === 0
                                  ? 'ops-history-week-boundary'
                                  : '',
                                isSelected
                                  ? 'ops-history-selected-cell bg-white/[0.06]'
                                  : isToday
                                    ? 'ops-history-today-cell'
                                    : dateKey === selectedCell.dateKey
                                      ? 'bg-white/[0.025]'
                                      : '',
                              ].join(' ')}
                            >
                              <div
                                title={cellLabel}
                                className={[
                                  'ops-grid-cell ops-focus-ring-chip mx-auto w-full transition [font-variant-numeric:tabular-nums]',
                                  getCellClassName(status),
                                ].join(' ')}
                              >
                                {getStatusCellText(status)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </NotchedFrame>
        </div>

        <aside
          className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start"
          aria-live="polite"
        >
          <NotchedFrame
            withShadow={false}
            outerClassName="bg-ops-border-struct"
            innerClassName={`tactical-subpanel-strong ops-flat-panel-strong p-5 ${getStatusSpineClassName(selectedStatus)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ops-eyebrow text-ops-text-muted">Selected cell</p>
                <h3 className="ops-headline-h3 mt-2">{selectedSector.label}</h3>
              </div>
              <StatusBadge status={selectedStatus} size="lg" />
            </div>
            <p className="ops-tracking-caption mt-5 text-2xl leading-none font-semibold text-ops-text-primary uppercase [font-variant-numeric:tabular-nums]">
              {formatLongDate(selectedCell.dateKey)}
            </p>
            <p
              id={ids.statusSummaryId}
              className="mt-4 text-sm leading-6 text-ops-text-secondary"
            >
              {selectedStatusSummary}
            </p>
            <p className="ops-tracking-grid mt-4 border-t border-ops-border-soft pt-4 text-xs leading-5 text-ops-text-muted uppercase">
              {selectedCell.dateKey === todayKey
                ? 'Today is live. Use the Today panel to update the current status picture.'
                : 'History is read-only. Use the Today panel to set the current day and let the grid reflect the pattern.'}
            </p>
          </NotchedFrame>
        </aside>
      </div>
    </>
  );
}
