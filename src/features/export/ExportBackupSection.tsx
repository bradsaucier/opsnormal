import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface ExportBackupSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  backupStatus: string;
  onJsonExport: () => Promise<void>;
  onCsvExport: () => Promise<void>;
}

const actionButtonClasses =
  'ops-action-button clip-notched ops-notch-chip px-4 py-3 text-sm font-semibold tracking-[0.14em] uppercase';

export function ExportBackupSection({
  isOpen,
  onToggle,
  backupStatus,
  onJsonExport,
  onCsvExport
}: ExportBackupSectionProps) {
  return (
    <AccordionSection
      sectionKey="export"
      title="Export and Backup"
      summary="Primary external backup path. Open by default because export is safe and routine."
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="panel-shadow">
            <div className="clip-notched ops-notch-panel-outer bg-ops-border-soft p-px">
              <div className="clip-notched ops-notch-panel-inner bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%),var(--color-ops-surface-overlay)] p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-ops-text-muted uppercase">
                  Backup posture
                </p>
                <p className="mt-2 text-sm leading-6 text-ops-text-secondary">{backupStatus}</p>
                <p className="mt-2 text-xs leading-5 text-ops-text-muted">
                  Export is the primary safe recovery path. Run it routinely.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void onJsonExport()}
              className={`${actionButtonClasses} ops-action-button-success-solid`}
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => void onCsvExport()}
              className={`${actionButtonClasses} ops-action-button-subtle`}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="panel-shadow">
          <div className="clip-notched ops-notch-panel-outer bg-ops-border-soft p-px">
            <div className="clip-notched ops-notch-panel-inner bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),var(--color-ops-surface-raised)] p-4 text-sm leading-6 text-ops-text-secondary">
              Export produces the recovery file. Run it routinely, especially in Safari on macOS and
              browser tabs on iPhone or iPad where browser-managed storage can disappear.
            </div>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}
