import { useMemo, useState } from 'react';

import type { StatusMessage } from './workflowTypes';

interface UseUndoImportOptions {
  onStatusMessage: (message: StatusMessage) => void;
}

interface UseUndoImportResult {
  canUndoImport: boolean;
  handleUndoImport: () => Promise<void>;
  stageUndoImport: (undo: () => Promise<void>) => void;
  undoBusy: boolean;
}

export function useUndoImport({
  onStatusMessage,
}: UseUndoImportOptions): UseUndoImportResult {
  const [undoImport, setUndoImport] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [undoBusy, setUndoBusy] = useState(false);

  const canUndoImport = useMemo(() => undoImport !== null, [undoImport]);

  function stageUndoImport(undo: () => Promise<void>) {
    setUndoImport(() => undo);
  }

  async function handleUndoImport() {
    if (!undoImport) {
      return;
    }

    try {
      setUndoBusy(true);
      await undoImport();
      setUndoImport(null);
      onStatusMessage({
        tone: 'success',
        text: 'Undo complete. The pre-import database snapshot has been restored.',
      });
    } catch (error) {
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
  };
}
