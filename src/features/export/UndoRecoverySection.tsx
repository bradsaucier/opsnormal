import { NotchedFrame } from '../../components/NotchedFrame';
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
        <NotchedFrame
          outerClassName="bg-ops-panel-border"
          innerClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-overlay)] p-4 text-sm leading-6 text-zinc-300"
        >
          Undo restores the pre-import snapshot for the current session only. Reload the app and
          that rope is gone. Keep external backups current.
        </NotchedFrame>
        <button
          type="button"
          onClick={() => void onUndoImport()}
          disabled={!canUndoImport || undoBusy}
          className="ops-action-button ops-action-button-amber min-h-[44px] px-4 py-3 text-sm font-semibold tracking-[0.14em] uppercase transition disabled:cursor-not-allowed disabled:opacity-60"
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
