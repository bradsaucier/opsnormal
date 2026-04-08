import { StorageHealthIndicator } from '../../components/StorageHealthIndicator';
import type { StorageHealth } from '../../lib/storage';
import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface StorageHealthSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  storageHealth: StorageHealth | null;
}

export function StorageHealthSection({
  isOpen,
  onToggle,
  storageHealth
}: StorageHealthSectionProps) {
  return (
    <AccordionSection
      sectionKey="storage"
      title="Storage Health"
      summary="Browser-managed storage is operational terrain, not a guaranteed archive."
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <StorageHealthIndicator storageHealth={storageHealth} />
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
          Storage telemetry informs posture. It does not remove the need for routine export.
        </div>
      </div>
    </AccordionSection>
  );
}
