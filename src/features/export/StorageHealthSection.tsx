import { NotchedFrame } from '../../components/NotchedFrame';
import { StorageHealthIndicator } from '../../components/StorageHealthIndicator';
import type { StorageHealth } from '../../lib/storage';
import type { AccordionSectionKey } from './exportPanelShared';
import { AccordionSection } from './exportPanelShared';

interface StorageHealthSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  storageHealth: StorageHealth | null;
  onRequestStorageProtection?: () => Promise<StorageHealth>;
  isRequestingStorageProtection?: boolean;
}

export function StorageHealthSection({
  isOpen,
  onToggle,
  storageHealth,
  onRequestStorageProtection,
  isRequestingStorageProtection = false,
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
        <StorageHealthIndicator
          storageHealth={storageHealth}
          onRequestStorageProtection={onRequestStorageProtection}
          isRequestingStorageProtection={isRequestingStorageProtection}
        />
        <NotchedFrame
          outerClassName="bg-ops-panel-border"
          innerClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-overlay)] p-4 text-sm leading-6 text-zinc-300"
        >
          The browser automatically manages local storage. You can manually
          request exemption from automatic deletion, though browsers may deny
          this silently. Always rely on routine exports to secure your critical
          data.
        </NotchedFrame>
      </div>
    </AccordionSection>
  );
}
