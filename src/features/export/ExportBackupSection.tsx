import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface ExportBackupSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  backupStatus: string;
  onJsonExport: () => Promise<void>;
  onCsvExport: () => Promise<void>;
}

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
          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
              Backup posture
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{backupStatus}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Export is the primary safe recovery path. Run it routinely.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void onJsonExport()}
              className="min-h-[44px] rounded-lg border border-emerald-400/45 bg-emerald-500 px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => void onCsvExport()}
              className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
          Export produces the recovery file. Run it routinely, especially in Safari on macOS and browser tabs on iPhone or iPad where browser-managed storage can disappear.
        </div>
      </div>
    </AccordionSection>
  );
}
