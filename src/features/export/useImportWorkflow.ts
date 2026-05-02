import { useEffect, useId, useRef, useState } from 'react';

import { UnverifiedImportRejectedError } from '../../lib/errors';
import { applyImport, previewImportFile } from '../../services/importService';
import {
  isSuccessfulImportPreview,
  requiresImportRiskAcknowledgment,
  type ImportMode,
  type ImportPreview,
} from '../../types';
import { getImportPreviewStatusMessage } from './exportPanelHelpers';
import type { ReplaceConfirmState, StatusMessage } from './workflowTypes';

interface UseImportWorkflowOptions {
  onImportApplied: (undo: () => Promise<void>) => void;
  onImportCommitted?: () => void;
  onOpenImportSection: () => void;
  onOpenUndoSection: () => void;
  onReplaceWorkflowResetRequested: () => void;
  onStatusMessage: (message: StatusMessage) => void;
}

interface UseImportWorkflowResult {
  clearPendingImport: (nextMessage?: StatusMessage) => void;
  fileInputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleConfirmImport: (options: {
    onArmReplace: () => void;
    replaceConfirmState: ReplaceConfirmState;
  }) => Promise<void>;
  handleImportSelection: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
  importBusy: boolean;
  importMode: ImportMode;
  pendingFileName: string;
  pendingFileSize: number;
  pendingImport: ImportPreview | null;
  pendingImportCanCommit: boolean;
  pendingImportRequiresAcknowledgment: boolean;
  riskyImportAcknowledged: boolean;
  setRiskyImportAcknowledged: (checked: boolean) => void;
  setImportModeWithReset: (nextMode: ImportMode) => void;
}

export function useImportWorkflow({
  onImportApplied,
  onImportCommitted,
  onOpenImportSection,
  onOpenUndoSection,
  onReplaceWorkflowResetRequested,
  onStatusMessage,
}: UseImportWorkflowOptions): UseImportWorkflowResult {
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(
    null,
  );
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingFileSize, setPendingFileSize] = useState(0);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importBusy, setImportBusy] = useState(false);
  const [riskyImportAcknowledged, setRiskyImportAcknowledged] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort();
      previewAbortRef.current = null;
      previewRequestIdRef.current += 1;
    };
  }, []);

  function canCommitImport(
    preview: ImportPreview | null,
    acknowledged: boolean,
  ): preview is Extract<
    ImportPreview,
    { kind: 'good' | 'stale' | 'legacy-unverified' }
  > {
    return (
      preview !== null &&
      isSuccessfulImportPreview(preview) &&
      (!requiresImportRiskAcknowledgment(preview) || acknowledged)
    );
  }

  function clearPendingImport(nextMessage?: StatusMessage) {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewRequestIdRef.current += 1;

    setPendingImport(null);
    setPendingFileName('');
    setPendingFileSize(0);
    setImportMode('merge');
    setRiskyImportAcknowledged(false);
    onReplaceWorkflowResetRequested();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (nextMessage) {
      onStatusMessage(nextMessage);
    }
  }

  function setImportModeWithReset(nextMode: ImportMode) {
    setImportMode(nextMode);
    setRiskyImportAcknowledged(false);
    onReplaceWorkflowResetRequested();
  }

  async function handleImportSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const [file] = Array.from(event.target.files ?? []);

    if (!file) {
      return;
    }

    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    onReplaceWorkflowResetRequested();

    try {
      const preview = await previewImportFile(file, controller.signal);

      if (
        controller.signal.aborted ||
        previewRequestIdRef.current !== requestId
      ) {
        return;
      }

      setPendingImport(preview);
      setPendingFileName(file.name);
      setPendingFileSize(file.size);
      setImportMode('merge');
      setRiskyImportAcknowledged(false);
      onOpenImportSection();
      onStatusMessage(getImportPreviewStatusMessage(preview));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      clearPendingImport();
      onStatusMessage({
        tone: 'error',
        text:
          error instanceof Error ? error.message : 'Import preparation failed.',
      });
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }

      event.target.value = '';
    }
  }

  async function runConfirmedImport() {
    if (!canCommitImport(pendingImport, riskyImportAcknowledged)) {
      return;
    }

    try {
      setImportBusy(true);
      const { importedCount, undo } = await applyImport(
        pendingImport.payload,
        importMode,
        {
          allowUnverified:
            pendingImport.kind === 'legacy-unverified' &&
            riskyImportAcknowledged,
        },
      );
      onImportApplied(undo);
      clearPendingImport();
      onOpenUndoSection();
      onStatusMessage({
        tone: 'success',
        text:
          importMode === 'replace'
            ? `Replace import complete. ${importedCount} rows restored.`
            : `Merge import complete. ${importedCount} rows applied.`,
      });
      onImportCommitted?.();
    } catch (error) {
      onStatusMessage({
        tone: 'error',
        text:
          error instanceof UnverifiedImportRejectedError
            ? 'Import rejected. The backup file has no integrity checksum. Reload the file and acknowledge the unverified-import risk before retrying.'
            : error instanceof Error
              ? error.message
              : 'Import failed during database write.',
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function handleConfirmImport({
    onArmReplace,
    replaceConfirmState,
  }: {
    onArmReplace: () => void;
    replaceConfirmState: ReplaceConfirmState;
  }) {
    if (!pendingImport) {
      return;
    }

    if (!isSuccessfulImportPreview(pendingImport)) {
      onStatusMessage({
        tone: 'error',
        text: 'Import remains blocked. Select a compatible backup file before writing local data.',
      });
      return;
    }

    if (
      requiresImportRiskAcknowledgment(pendingImport) &&
      !riskyImportAcknowledged
    ) {
      onStatusMessage({
        tone: 'warning',
        text: 'Import remains locked. Review the staged risk and acknowledge it before the write path unlocks.',
      });
      return;
    }

    if (importMode === 'replace') {
      if (replaceConfirmState !== 'armed') {
        onArmReplace();
        return;
      }

      await runConfirmedImport();
      return;
    }

    await runConfirmedImport();
  }

  const pendingImportRequiresAcknowledgment =
    requiresImportRiskAcknowledgment(pendingImport);
  const pendingImportCanCommit = canCommitImport(
    pendingImport,
    riskyImportAcknowledged,
  );

  return {
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
    pendingImportCanCommit,
    pendingImportRequiresAcknowledgment,
    riskyImportAcknowledged,
    setRiskyImportAcknowledged,
    setImportModeWithReset,
  };
}
