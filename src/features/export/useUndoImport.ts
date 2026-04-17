import { useEffect, useMemo, useRef, useState } from 'react';

import { UndoInvalidatedError, UndoVerificationError } from '../../lib/errors';
import {
  createEntryWrittenTabId,
  isEntryWrittenCoordinationMessage,
  subscribeToEntryWrittenCoordination,
} from '../../services/entryWrittenCoordination';
import type { StatusMessage } from './workflowTypes';

const ENTRY_WRITTEN_EVENT_NAME = 'opsnormal:entry-written';
const localTabId = createEntryWrittenTabId();

interface UseUndoImportOptions {
  onStatusMessage: (message: StatusMessage) => void;
}

interface UseUndoImportResult {
  canUndoImport: boolean;
  handleUndoImport: () => Promise<void>;
  stageUndoImport: (undo: () => Promise<void>) => void;
  undoBusy: boolean;
  undoInvalidated: boolean;
}

export function useUndoImport({
  onStatusMessage,
}: UseUndoImportOptions): UseUndoImportResult {
  const [undoImport, setUndoImport] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoInvalidated, setUndoInvalidated] = useState(false);
  const undoImportRef = useRef<(() => Promise<void>) | null>(null);
  const onStatusMessageRef = useRef(onStatusMessage);

  useEffect(() => {
    undoImportRef.current = undoImport;
  }, [undoImport]);

  useEffect(() => {
    onStatusMessageRef.current = onStatusMessage;
  }, [onStatusMessage]);

  useEffect(() => {
    function invalidateUndoImport() {
      if (!undoImportRef.current) {
        return;
      }

      setUndoInvalidated((current) => {
        if (current) {
          return current;
        }

        onStatusMessageRef.current({
          tone: 'warning',
          text: 'Undo disabled: a daily check-in landed after this import. Export a fresh backup before proceeding.',
        });

        return true;
      });
    }

    function handleEntryWritten(event: Event) {
      const detail = (event as CustomEvent<{ source?: string }>).detail;

      if (detail?.source !== 'daily-status') {
        return;
      }

      invalidateUndoImport();
    }

    function handleCrossTabEntryWritten(event: MessageEvent<unknown>) {
      if (!isEntryWrittenCoordinationMessage(event.data)) {
        return;
      }

      if (
        event.data.sourceTabId === localTabId ||
        event.data.source !== 'daily-status'
      ) {
        return;
      }

      invalidateUndoImport();
    }

    window.addEventListener(ENTRY_WRITTEN_EVENT_NAME, handleEntryWritten);
    const unsubscribe = subscribeToEntryWrittenCoordination(
      handleCrossTabEntryWritten,
    );

    return () => {
      window.removeEventListener(ENTRY_WRITTEN_EVENT_NAME, handleEntryWritten);
      unsubscribe?.();
    };
  }, []);

  const canUndoImport = useMemo(
    () => undoImport !== null && !undoInvalidated,
    [undoImport, undoInvalidated],
  );

  function stageUndoImport(undo: () => Promise<void>) {
    undoImportRef.current = undo;
    setUndoImport(() => undo);
    setUndoInvalidated(false);
  }

  async function handleUndoImport() {
    if (!undoImport) {
      return;
    }

    if (undoInvalidated) {
      onStatusMessage({
        tone: 'warning',
        text: 'Undo disabled: a daily check-in landed after this import. Export a fresh backup before proceeding.',
      });
      return;
    }

    try {
      setUndoBusy(true);
      await undoImport();
      undoImportRef.current = null;
      setUndoImport(null);
      setUndoInvalidated(false);
      onStatusMessage({
        tone: 'success',
        text: 'Undo complete. The pre-import database snapshot has been restored.',
      });
    } catch (error) {
      if (error instanceof UndoInvalidatedError) {
        onStatusMessage({
          tone: 'error',
          text: 'Undo failed closed. The staged pre-import snapshot is no longer safe to apply. Export a fresh backup before proceeding.',
        });
        return;
      }

      if (error instanceof UndoVerificationError) {
        onStatusMessage({
          tone: 'error',
          text: 'Undo failed closed. Post-write read-back did not match the staged pre-import snapshot. Local data was left unchanged.',
        });
        return;
      }

      onStatusMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Undo failed. Reload the app and verify local data.',
      });
    } finally {
      setUndoBusy(false);
    }
  }

  return {
    canUndoImport,
    handleUndoImport,
    stageUndoImport,
    undoBusy,
    undoInvalidated,
  };
}
