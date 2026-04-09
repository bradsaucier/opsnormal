import { useState } from 'react';

import { SectionCard } from '../../components/SectionCard';
import type { StorageHealth } from '../../lib/storage';
import { BackupSummarySignals } from './BackupSummarySignals';
import { ExportBackupSection } from './ExportBackupSection';
import { ImportRestoreSection } from './ImportRestoreSection';
import {
  type AccordionSectionKey,
  getDefaultStatusMessage
} from './exportPanelShared';
import { StatusMessageRegions } from './StatusMessageRegions';
import { StorageHealthSection } from './StorageHealthSection';
import { UndoRecoverySection } from './UndoRecoverySection';
import { useExportWorkflow } from './useExportWorkflow';
import { useImportWorkflow } from './useImportWorkflow';
import { useReplaceCheckpoint } from './useReplaceCheckpoint';
import { useUndoImport } from './useUndoImport';
import type { StatusMessage } from './workflowTypes';

interface ExportPanelProps {
  storageHealth: StorageHealth | null;
  onRequestStorageProtection?: () => Promise<StorageHealth>;
  isRequestingStorageProtection?: boolean;
  onImportCommitted?: () => void;
}

export function ExportPanel({
  storageHealth,
  onRequestStorageProtection,
  isRequestingStorageProtection = false,
  onImportCommitted = () => undefined
}: ExportPanelProps) {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(() => getDefaultStatusMessage());
  const [expandedSections, setExpandedSections] = useState<Record<AccordionSectionKey, boolean>>({
    export: true,
    import: false,
    undo: false,
    storage: false
  });

  function updateStatusMessage(nextMessage: StatusMessage) {
    setStatusMessage(nextMessage);
  }

  function toggleSection(sectionKey: AccordionSectionKey) {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  function openImportSection() {
    setExpandedSections((current) => ({
      ...current,
      import: true
    }));
  }

  function openUndoSection() {
    setExpandedSections((current) => ({
      ...current,
      undo: true
    }));
  }

  const { backupStatus, handleCsvExport, handleJsonExport, markBackupCompleted } =
    useExportWorkflow({
      onStatusMessage: updateStatusMessage
    });
  const { canUndoImport, handleUndoImport, stageUndoImport, undoBusy } = useUndoImport({
    onStatusMessage: updateStatusMessage
  });
  const {
    clearPendingImport,
    fileInputId,
    fileInputRef,
    handleConfirmImport,
    handleImportSelection,
    importBusy,
    importMode,
    pendingFileName,
    pendingFileSize,
    pendingImport,
    setImportModeWithReset
  } = useImportWorkflow({
    onImportApplied: stageUndoImport,
    onImportCommitted,
    onOpenImportSection: openImportSection,
    onOpenUndoSection: openUndoSection,
    onReplaceWorkflowResetRequested: () => {
      resetReplaceWorkflow();
    },
    onStatusMessage: updateStatusMessage
  });
  const {
    handleAcknowledgeManualBackup,
    handleArmReplace,
    handleDisarmReplace,
    handlePrepareReplaceBackup,
    manualBackupConfirmed,
    replaceActionRef,
    replaceBackupState,
    replaceConfirmState,
    replaceReady,
    resetReplaceWorkflow,
    setManualBackupConfirmed,
    supportsVerifiedFileSave
  } = useReplaceCheckpoint({
    onBackupCompleted: markBackupCompleted,
    onStatusMessage: updateStatusMessage,
    pendingImport
  });

  async function confirmImport() {
    await handleConfirmImport({
      onArmReplace: handleArmReplace,
      replaceConfirmState
    });
  }

  function cancelPendingImport() {
    clearPendingImport({
      tone: 'info',
      text: 'Import staging cleared. Local data unchanged.'
    });
  }

  return (
    <SectionCard eyebrow="Data Sovereignty" title="Backup and Recovery">
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-6 text-zinc-300">
          Local-first only works if recovery is real. Safe actions stay forward. Destructive
          restore paths stay collapsed until you deliberately open, stage, and confirm them.
        </p>

        <BackupSummarySignals backupStatus={backupStatus} canUndoImport={canUndoImport} />

        <ExportBackupSection
          isOpen={expandedSections.export}
          onToggle={toggleSection}
          backupStatus={backupStatus}
          onJsonExport={handleJsonExport}
          onCsvExport={handleCsvExport}
        />

        <ImportRestoreSection
          isOpen={expandedSections.import}
          onToggle={toggleSection}
          fileInputId={fileInputId}
          fileInputRef={fileInputRef}
          onImportSelection={handleImportSelection}
          pendingImport={pendingImport}
          pendingFileName={pendingFileName}
          pendingFileSize={pendingFileSize}
          importBusy={importBusy}
          importMode={importMode}
          onImportModeChange={setImportModeWithReset}
          onConfirmImport={confirmImport}
          onCancelImport={cancelPendingImport}
          replaceActionRef={replaceActionRef}
          replaceBackupState={replaceBackupState}
          replaceConfirmState={replaceConfirmState}
          replaceReady={replaceReady}
          supportsVerifiedFileSave={supportsVerifiedFileSave}
          manualBackupConfirmed={manualBackupConfirmed}
          onManualBackupConfirmedChange={setManualBackupConfirmed}
          onPrepareReplaceBackup={handlePrepareReplaceBackup}
          onAcknowledgeManualBackup={handleAcknowledgeManualBackup}
          onDisarmReplace={handleDisarmReplace}
        />

        <UndoRecoverySection
          isOpen={expandedSections.undo}
          onToggle={toggleSection}
          canUndoImport={canUndoImport}
          undoBusy={undoBusy}
          onUndoImport={handleUndoImport}
        />

        <StorageHealthSection
          isOpen={expandedSections.storage}
          onToggle={toggleSection}
          storageHealth={storageHealth}
          onRequestStorageProtection={onRequestStorageProtection}
          isRequestingStorageProtection={isRequestingStorageProtection}
        />

        <StatusMessageRegions statusMessage={statusMessage} />
      </div>
    </SectionCard>
  );
}
