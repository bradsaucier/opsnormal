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
        <div className="ops-flat-panel p-4 text-sm leading-6 text-ops-text-secondary">
          The browser automatically manages local storage. You can manually
          request exemption from automatic deletion, though browsers may deny
          this silently. Always rely on routine exports to secure your critical
          data.
        </div>
      </div>
    </AccordionSection>
  );
}
