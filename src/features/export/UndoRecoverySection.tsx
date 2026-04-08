import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface UndoRecoverySectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  canUndoImport: boolean;
  undoBusy: boolean;
  onUndoImport: () => Promise<void>;
}

export function UndoRecoverySection({
  isOpen,
  onToggle,
  canUndoImport,
  undoBusy,
  onUndoImport
}: UndoRecoverySectionProps) {
  return (
    <AccordionSection
      sectionKey="undo"
      title="Undo and Recovery"
      summary="Session-scoped rollback after a successful import. Useful, but not a substitute for export."
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
          Undo restores the pre-import snapshot for the current session only. Reload the app and
          that rope is gone. Keep external backups current.
        </div>
        <button
          type="button"
          onClick={() => void onUndoImport()}
          disabled={!canUndoImport || undoBusy}
          className="min-h-[44px] rounded-lg border border-amber-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-amber-100 uppercase transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {undoBusy ? 'Undoing Import' : 'Undo Last Import'}
        </button>
        {!canUndoImport ? (
          <p className="text-sm leading-6 text-zinc-400">No import rollback staged in this session.</p>
        ) : null}
      </div>
    </AccordionSection>
  );
}
