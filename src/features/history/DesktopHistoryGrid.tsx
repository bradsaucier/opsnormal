import { StatusBadge } from '../../components/StatusBadge';
import { StatusLegend } from '../../components/StatusLegend';
import { SectorGlyphMark } from '../../components/icons/SectorGlyphs';
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
          <p className="text-xs tracking-[0.14em] text-ops-text-muted uppercase">
            Desktop holds the full 30-day picture. Tab exits the grid. Select a
            cell for the detail brief.
          </p>
        </div>
        <StatusLegend />
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
              className="pointer-events-none absolute left-0 top-0 z-40 h-full w-6 bg-gradient-to-r from-ops-surface-1 to-transparent"
            />
          ) : null}
          {canScrollRight ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 z-40 h-full w-6 bg-gradient-to-l from-ops-surface-1 to-transparent"
            />
          ) : null}
          <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
            <div className="clip-notched ops-notch-panel-inner tactical-subpanel">
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
                    <tr role="row">
                      <th
                        role="columnheader"
                        className="sticky left-0 top-0 z-30 border-b border-r border-ops-border-struct bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-secondary shadow-[6px_0_12px_rgba(10,15,13,0.32)]"
                        scope="col"
                      >
                        Sector
                      </th>
                      {dateKeys.map((dateKey) => {
                        const isToday = dateKey === todayKey;
                        const isSelectedColumn =
                          dateKey === selectedCell.dateKey;

                        return (
                          <th
                            key={dateKey}
                            role="columnheader"
                            className={[
                              'sticky top-0 z-20 border-b border-ops-border-struct px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em]',
                              isToday
                                ? 'bg-emerald-300/12 text-ops-accent-muted'
                                : isSelectedColumn
                                  ? 'bg-ops-surface-2 text-ops-text-primary'
                                  : 'bg-ops-surface-1 text-ops-text-secondary',
                            ].join(' ')}
                            scope="col"
                            aria-current={isToday ? 'date' : undefined}
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
                          className={
                            isSelectedRow
                              ? 'bg-white/[0.04]'
                              : 'odd:bg-white/[0.025] even:bg-white/[0.012]'
                          }
                        >
                          <th
                            role="rowheader"
                            className={[
                              'sticky left-0 z-20 border-b border-r border-ops-border-soft bg-ops-surface-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] shadow-[6px_0_12px_rgba(10,15,13,0.32)]',
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
                                  handleCellKeyDown(
                                    event,
                                    sectorIndex,
                                    dateIndex,
                                  )
                                }
                                className={[
                                  'ops-focus-ring-chip-proxy cursor-pointer border-b border-ops-border-soft px-1 py-0.5 align-middle outline-none',
                                  isSelected
                                    ? 'bg-white/[0.05] outline outline-1 -outline-offset-2 outline-[var(--ops-focus-ring)]'
                                    : isToday
                                      ? 'bg-emerald-300/[0.05]'
                                      : dateKey === selectedCell.dateKey
                                        ? 'bg-white/[0.025]'
                                        : '',
                                ].join(' ')}
                              >
                                <div
                                  title={cellLabel}
                                  className={[
                                    'ops-grid-cell ops-focus-ring-chip mx-auto w-full transition [font-variant-numeric:tabular-nums]',
                                    isToday && !isSelected
                                      ? 'ring-1 ring-inset ring-emerald-300/25'
                                      : '',
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
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-live="polite">
          <div className="clip-notched ops-notch-panel-outer bg-ops-border-struct p-px">
            <div
              className={`clip-notched ops-notch-panel-inner tactical-subpanel-strong p-5 ${getStatusSpineClassName(selectedStatus)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ops-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-ops-text-muted">
                    Selected cell
                  </p>
                  <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.06em] text-ops-text-primary">
                    {selectedSector.label}
                  </h3>
                </div>
                <StatusBadge status={selectedStatus} />
              </div>
              <p className="mt-5 text-2xl leading-none font-semibold tracking-[0.04em] text-ops-text-primary uppercase [font-variant-numeric:tabular-nums]">
                {formatLongDate(selectedCell.dateKey)}
              </p>
              <p
                id={ids.statusSummaryId}
                className="mt-4 text-sm leading-6 text-ops-text-secondary"
              >
                {selectedStatusSummary}
              </p>
              <p className="mt-4 border-t border-ops-border-soft pt-4 text-xs leading-5 tracking-[0.12em] text-ops-text-muted uppercase">
                {selectedCell.dateKey === todayKey
                  ? 'Today is live. Use the Today panel to update the current status picture.'
                  : 'History is read-only. Use the Today panel to set the current day and let the grid reflect the pattern.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
