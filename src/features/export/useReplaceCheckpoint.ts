import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getErrorMessage } from '../../lib/errors';
import {
  canUseVerifiedFileSave,
  checkpointJsonBackupToDisk,
  exportCurrentEntriesAsJson,
} from '../../lib/export';
import type { ImportPreview } from '../../types';
import type {
  ReplaceBackupState,
  ReplaceConfirmState,
  StatusMessage,
} from './workflowTypes';

interface UseReplaceCheckpointOptions {
  onBackupCompleted: (exportedAt: string) => void;
  onStatusMessage: (message: StatusMessage) => void;
  pendingImport: ImportPreview | null;
}

interface UseReplaceCheckpointResult {
  handleAcknowledgeManualBackup: () => void;
  handleArmReplace: () => void;
  handleDisarmReplace: () => void;
  handlePrepareReplaceBackup: () => Promise<void>;
  manualBackupConfirmed: boolean;
  replaceActionRef: React.RefObject<HTMLDivElement | null>;
  replaceBackupState: ReplaceBackupState;
  replaceConfirmState: ReplaceConfirmState;
  replaceReady: boolean;
  resetReplaceWorkflow: () => void;
  setManualBackupConfirmed: (checked: boolean) => void;
  supportsVerifiedFileSave: boolean;
}

function buildPreReplaceBackupFileName(exportedAt: string): string {
  const safeTimestamp = exportedAt.replaceAll(':', '-');
  return `opsnormal-pre-replace-backup-${safeTimestamp}.json`;
}

export function useReplaceCheckpoint({
  onBackupCompleted,
  onStatusMessage,
  pendingImport,
}: UseReplaceCheckpointOptions): UseReplaceCheckpointResult {
  const [replaceConfirmState, setReplaceConfirmState] =
    useState<ReplaceConfirmState>('idle');
  const [replaceBackupState, setReplaceBackupState] =
    useState<ReplaceBackupState>({ phase: 'idle' });
  const [manualBackupConfirmed, setManualBackupConfirmed] = useState(false);
  const replaceActionRef = useRef<HTMLDivElement | null>(null);

  const replaceReady = useMemo(
    () => replaceBackupState.phase === 'ready',
    [replaceBackupState],
  );
  const supportsVerifiedFileSave = useMemo(() => canUseVerifiedFileSave(), []);

  const emitReplaceDisarmedMessage = useCallback(
    (text: string) => {
      onStatusMessage({
        tone: 'info',
        text,
      });
    },
    [onStatusMessage],
  );

  const resetReplaceWorkflow = useCallback(() => {
    setReplaceConfirmState('idle');
    setReplaceBackupState({ phase: 'idle' });
    setManualBackupConfirmed(false);
  }, []);

  const handleDisarmReplace = useCallback(() => {
    setReplaceConfirmState('idle');
    emitReplaceDisarmedMessage('Replace disarmed. Local data unchanged.');
  }, [emitReplaceDisarmedMessage]);

  useEffect(() => {
    if (replaceConfirmState !== 'armed') {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      setReplaceConfirmState('idle');
      emitReplaceDisarmedMessage('Replace disarmed. Local data unchanged.');
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!replaceActionRef.current?.contains(target)) {
        setReplaceConfirmState('idle');
        emitReplaceDisarmedMessage(
          'Replace disarmed after focus moved off the destructive control group.',
        );
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [emitReplaceDisarmedMessage, replaceConfirmState]);

  const handlePrepareReplaceBackup = useCallback(async () => {
    if (!pendingImport) {
      return;
    }

    setManualBackupConfirmed(false);

    try {
      setReplaceBackupState({ phase: 'saving' });
      const exportResult: Awaited<
        ReturnType<typeof exportCurrentEntriesAsJson>
      > = await exportCurrentEntriesAsJson();
      const fileName = buildPreReplaceBackupFileName(exportResult.exportedAt);
      const checkpointResult: Awaited<
        ReturnType<typeof checkpointJsonBackupToDisk>
      > = await checkpointJsonBackupToDisk({
        fileName,
        exportedAt: exportResult.exportedAt,
        payload: exportResult.payload,
      });

      if (checkpointResult.kind === 'verified-save-succeeded') {
        onBackupCompleted(exportResult.exportedAt);
        setReplaceBackupState({
          phase: 'ready',
          fileName,
          verification: 'verified',
        });
        onStatusMessage({
          tone: 'success',
          text: `Verified pre-replace backup saved as ${fileName}. ${exportResult.entryCount} current rows secured before restore.`,
        });
        return;
      }

      if (checkpointResult.kind === 'fallback-download-triggered') {
        onBackupCompleted(exportResult.exportedAt);
        setReplaceBackupState({ phase: 'manual-awaiting-ack', fileName });
        onStatusMessage({
          tone: 'warning',
          text: `Backup download triggered for ${fileName}. Verify the file exists on local disk, then acknowledge before replace unlocks.`,
        });
        return;
      }

      setReplaceBackupState({ phase: 'idle' });
      onStatusMessage({
        tone: checkpointResult.kind === 'save-cancelled' ? 'warning' : 'error',
        text: checkpointResult.message,
      });
    } catch (error: unknown) {
      setReplaceBackupState({ phase: 'idle' });
      onStatusMessage({
        tone: 'error',
        text: getErrorMessage(
          error,
          'Pre-replace backup failed. Local data remains untouched.',
        ),
      });
    }
  }, [onBackupCompleted, onStatusMessage, pendingImport]);

  const handleAcknowledgeManualBackup = useCallback(() => {
    if (
      replaceBackupState.phase !== 'manual-awaiting-ack' ||
      !manualBackupConfirmed
    ) {
      return;
    }

    setReplaceBackupState({
      phase: 'ready',
      fileName: replaceBackupState.fileName,
      verification: 'manual',
    });
    setManualBackupConfirmed(false);
    onStatusMessage({
      tone: 'warning',
      text: `Manual backup checkpoint acknowledged for ${replaceBackupState.fileName}. Replace is unlocked, but the browser did not verify the disk write.`,
    });
  }, [manualBackupConfirmed, onStatusMessage, replaceBackupState]);

  const handleArmReplace = useCallback(() => {
    if (!pendingImport) {
      return;
    }

    if (replaceBackupState.phase !== 'ready') {
      onStatusMessage({
        tone: 'warning',
        text: 'Replace remains locked. Complete the pre-replace backup checkpoint before arming the destructive path.',
      });
      return;
    }

    setReplaceConfirmState('armed');
    onStatusMessage({
      tone: 'warning',
      text: `Replace armed. Executing this path will wipe ${pendingImport.existingEntryCount} current rows and restore ${pendingImport.totalEntries} imported rows. Press Escape, click outside the destructive control group, or use Disarm Replace to stand down.`,
    });
  }, [onStatusMessage, pendingImport, replaceBackupState.phase]);

  return {
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
    supportsVerifiedFileSave,
  };
}
