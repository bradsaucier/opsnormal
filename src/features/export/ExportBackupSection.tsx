import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface ExportBackupSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  backupStatus: string;
  onJsonExport: () => Promise<void>;
  onCsvExport: () => Promise<void>;
}

const actionButtonClasses = 'ops-action-button';

export function ExportBackupSection({
  isOpen,
  onToggle,
  backupStatus,
  onJsonExport,
  onCsvExport,
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
          <div className="ops-flat-panel p-4">
            <p className="ops-eyebrow-mixed">Backup posture</p>
            <p className="mt-2 text-sm leading-6 text-ops-text-secondary">
              {backupStatus}
            </p>
            <p className="mt-2 text-xs leading-5 text-ops-text-muted">
              Export is the primary safe recovery path. Run it routinely.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void onJsonExport()}
              className={`${actionButtonClasses} ops-action-button-emerald-solid`}
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

        <div className="ops-flat-panel-strong p-4 text-sm leading-6 text-ops-text-secondary">
          Export produces the recovery file. Run it routinely, especially in
          Safari on macOS and browser tabs on iPhone or iPad where
          browser-managed storage can disappear.
        </div>
      </div>
    </AccordionSection>
  );
}
