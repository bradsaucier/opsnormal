import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { StorageHealthIndicator } from '../../components/StorageHealthIndicator';
import { SectionCard } from '../../components/SectionCard';
import {
  canUseVerifiedFileSave,
  checkpointJsonBackupToDisk,
  downloadTextFile,
  exportCurrentEntriesAsCsv,
  exportCurrentEntriesAsJson,
  formatLastExportCompletedAt,
  getLastExportCompletedAt,
  recordExportCompleted
} from '../../lib/export';
import type { StorageHealth } from '../../lib/storage';
import { applyImport, previewImportFile } from '../../services/importService';
import type { ImportMode, ImportPreview } from '../../types';

interface ExportPanelProps {
  storageHealth: StorageHealth | null;
}

type AccordionSectionKey = 'export' | 'import' | 'undo' | 'storage';
type MessageTone = 'info' | 'success' | 'warning' | 'error';
type ReplaceConfirmState = 'idle' | 'armed';
type ReplaceBackupState =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'manual-awaiting-ack'; fileName: string }
  | { phase: 'ready'; fileName: string; verification: 'verified' | 'manual' };

interface StatusMessage {
  tone: MessageTone;
  text: string;
}

interface AccordionSectionProps {
  sectionKey: AccordionSectionKey;
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  children: React.ReactNode;
}

function AccordionSection({
  sectionKey,
  title,
  summary,
  isOpen,
  onToggle,
  children
}: AccordionSectionProps) {
  const buttonId = `backup-${sectionKey}-header`;
  const panelId = `backup-${sectionKey}-panel`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => onToggle(sectionKey)}
          className="flex min-h-[56px] w-full items-start justify-between gap-4 rounded-xl px-4 py-4 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <span>
            <span className="block font-mono text-xs font-semibold tracking-[0.22em] text-zinc-400 uppercase">
              {title}
            </span>
            <span className="mt-2 block text-sm leading-6 text-zinc-300">{summary}</span>
          </span>
          <span
            aria-hidden="true"
            className={`mt-1 text-lg leading-none text-emerald-300 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className="border-t border-white/10 px-4 py-4"
      >
        {children}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImportImpactText(preview: ImportPreview, mode: ImportMode): string {
  if (mode === 'replace') {
    return `Replace ${preview.existingEntryCount} current rows with ${preview.totalEntries} imported rows.`;
  }

  return `${preview.newEntryCount} new rows and ${preview.overwriteCount} overwrites will be applied. All other local rows stay in place.`;
}

function getDefaultStatusMessage(): StatusMessage {
  return {
    tone: 'info',
    text: 'Backup and recovery are local actions. No cloud sync. No account system.'
  };
}

function buildPreReplaceBackupFileName(exportedAt: string): string {
  const safeTimestamp = exportedAt.replaceAll(':', '-');
  return `opsnormal-pre-replace-backup-${safeTimestamp}.json`;
}

export function ExportPanel({ storageHealth }: ExportPanelProps) {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(() => getDefaultStatusMessage());
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastExportCompletedAt());
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [pendingFileSize, setPendingFileSize] = useState<number>(0);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importBusy, setImportBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [replaceConfirmState, setReplaceConfirmState] = useState<ReplaceConfirmState>('idle');
  const [replaceBackupState, setReplaceBackupState] = useState<ReplaceBackupState>({ phase: 'idle' });
  const [manualBackupConfirmed, setManualBackupConfirmed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<AccordionSectionKey, boolean>>({
    export: true,
    import: false,
    undo: false,
    storage: false
  });
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceActionRef = useRef<HTMLDivElement | null>(null);
  const undoImportRef = useRef<(() => Promise<void>) | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    setLastBackupAt(getLastExportCompletedAt());
  }, []);

  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (replaceConfirmState !== 'armed') {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      setReplaceConfirmState('idle');
      setStatusMessage({
        tone: 'info',
        text: 'Replace disarmed. Local data unchanged.'
      });
    }

    function handlePointerDown(event: PointerEvent) {
      if (!replaceActionRef.current?.contains(event.target as Node)) {
        setReplaceConfirmState('idle');
        setStatusMessage({
          tone: 'info',
          text: 'Replace disarmed after focus moved off the destructive control group.'
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [replaceConfirmState]);

  const backupStatus = useMemo(() => formatLastExportCompletedAt(lastBackupAt), [lastBackupAt]);
  const canUndoImport = undoImportRef.current !== null;
  const importIntegrityText =
    pendingImport?.integrityStatus === 'verified'
      ? 'Integrity verified. Embedded SHA-256 checksum matched before write staging.'
      : 'Legacy backup detected. Structure validated, but this file has no integrity checksum.';
  const replaceReady = replaceBackupState.phase === 'ready';
  const passiveStatusText =
    statusMessage.tone === 'info' || statusMessage.tone === 'success' ? statusMessage.text : '';
  const alertStatusText =
    statusMessage.tone === 'warning' || statusMessage.tone === 'error' ? statusMessage.text : '';

  function toggleSection(sectionKey: AccordionSectionKey) {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  function resetReplaceWorkflow() {
    setReplaceConfirmState('idle');
    setReplaceBackupState({ phase: 'idle' });
    setManualBackupConfirmed(false);
  }

  function clearPendingImport(nextMessage?: StatusMessage) {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewRequestIdRef.current += 1;

    setPendingImport(null);
    setPendingFileName('');
    setPendingFileSize(0);
    setImportMode('merge');
    resetReplaceWorkflow();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (nextMessage) {
      setStatusMessage(nextMessage);
    }
  }

  function openImportSection() {
    setExpandedSections((current) => ({
      ...current,
      import: true
    }));
  }

  function setImportModeWithReset(nextMode: ImportMode) {
    setImportMode(nextMode);
    resetReplaceWorkflow();
  }

  async function handleJsonExport() {
    try {
      const { entryCount, exportedAt, payload } = await exportCurrentEntriesAsJson();
      downloadTextFile('opsnormal-export.json', payload, 'application/json');
      recordExportCompleted(exportedAt);
      setLastBackupAt(exportedAt);
      setStatusMessage({
        tone: 'success',
        text: `JSON export complete. ${entryCount} entries written to disk.`
      });
    } catch (error) {
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'JSON export failed. Reload the app and try again.'
      });
    }
  }

  async function handleCsvExport() {
    try {
      const { entryCount, payload } = await exportCurrentEntriesAsCsv();
      downloadTextFile('opsnormal-export.csv', payload, 'text/csv;charset=utf-8');
      setStatusMessage({
        tone: 'success',
        text: `CSV export complete. ${entryCount} entries written to disk.`
      });
    } catch (error) {
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'CSV export failed. Reload the app and try again.'
      });
    }
  }

  async function handleImportSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);

    if (!file) {
      return;
    }

    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    resetReplaceWorkflow();

    try {
      const preview = await previewImportFile(file, controller.signal);

      if (controller.signal.aborted || previewRequestIdRef.current !== requestId) {
        return;
      }

      setPendingImport(preview);
      setPendingFileName(file.name);
      setPendingFileSize(file.size);
      setImportMode('merge');
      openImportSection();
      setStatusMessage({
        tone: preview.integrityStatus === 'verified' ? 'success' : 'warning',
        text:
          preview.integrityStatus === 'verified'
            ? `Import staged. ${preview.totalEntries} entries validated. Review the preview and confirm the write path.`
            : `Legacy import staged. ${preview.totalEntries} entries validated, but this file has no integrity checksum. Review the preview and confirm the write path.`
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      clearPendingImport();
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Import preparation failed.'
      });
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }

      event.target.value = '';
    }
  }

  async function handlePrepareReplaceBackup() {
    if (!pendingImport) {
      return;
    }

    setManualBackupConfirmed(false);

    try {
      setReplaceBackupState({ phase: 'saving' });
      const { entryCount, exportedAt, payload } = await exportCurrentEntriesAsJson();
      const fileName = buildPreReplaceBackupFileName(exportedAt);
      const checkpointResult = await checkpointJsonBackupToDisk({
        fileName,
        exportedAt,
        payload
      });

      if (checkpointResult.kind === 'verified-save-succeeded') {
        recordExportCompleted(exportedAt);
        setLastBackupAt(exportedAt);
        setReplaceBackupState({ phase: 'ready', fileName, verification: 'verified' });
        setStatusMessage({
          tone: 'success',
          text: `Verified pre-replace backup saved as ${fileName}. ${entryCount} current rows secured before restore.`
        });
        return;
      }

      if (checkpointResult.kind === 'fallback-download-triggered') {
        recordExportCompleted(exportedAt);
        setLastBackupAt(exportedAt);
        setReplaceBackupState({ phase: 'manual-awaiting-ack', fileName });
        setStatusMessage({
          tone: 'warning',
          text: `Backup download triggered for ${fileName}. Verify the file exists on local disk, then acknowledge before replace unlocks.`
        });
        return;
      }

      setReplaceBackupState({ phase: 'idle' });
      setStatusMessage({
        tone: checkpointResult.kind === 'save-cancelled' ? 'warning' : 'error',
        text: checkpointResult.message
      });
    } catch (error) {
      setReplaceBackupState({ phase: 'idle' });
      setStatusMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Pre-replace backup failed. Local data remains untouched.'
      });
    }
  }

  function handleAcknowledgeManualBackup() {
    if (replaceBackupState.phase !== 'manual-awaiting-ack' || !manualBackupConfirmed) {
      return;
    }

    setReplaceBackupState({
      phase: 'ready',
      fileName: replaceBackupState.fileName,
      verification: 'manual'
    });
    setManualBackupConfirmed(false);
    setStatusMessage({
      tone: 'warning',
      text: `Manual backup checkpoint acknowledged for ${replaceBackupState.fileName}. Replace is unlocked, but the browser did not verify the disk write.`
    });
  }

  function handleArmReplace() {
    if (!pendingImport) {
      return;
    }

    if (!replaceReady) {
      setStatusMessage({
        tone: 'warning',
        text: 'Replace remains locked. Complete the pre-replace backup checkpoint before arming the destructive path.'
      });
      return;
    }

    setReplaceConfirmState('armed');
    setStatusMessage({
      tone: 'warning',
      text: `Replace armed. Executing this path will wipe ${pendingImport.existingEntryCount} current rows and restore ${pendingImport.totalEntries} imported rows. Press Escape, click outside the destructive control group, or use Disarm Replace to stand down.`
    });
  }

  function handleDisarmReplace() {
    setReplaceConfirmState('idle');
    setStatusMessage({
      tone: 'info',
      text: 'Replace disarmed. Local data unchanged.'
    });
  }

  async function runConfirmedImport() {
    if (!pendingImport) {
      return;
    }

    try {
      setImportBusy(true);
      const { importedCount, undo } = await applyImport(pendingImport.payload, importMode);
      undoImportRef.current = undo;
      clearPendingImport();
      setExpandedSections((current) => ({
        ...current,
        undo: true
      }));
      setStatusMessage({
        tone: 'success',
        text:
          importMode === 'replace'
            ? `Replace import complete. ${importedCount} rows restored.`
            : `Merge import complete. ${importedCount} rows applied.`
      });
    } catch (error) {
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Import failed during database write.'
      });
    } finally {
      setImportBusy(false);
      setReplaceConfirmState('idle');
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return;
    }

    if (importMode === 'replace') {
      if (replaceConfirmState !== 'armed') {
        handleArmReplace();
        return;
      }

      await runConfirmedImport();
      return;
    }

    await runConfirmedImport();
  }

  async function handleUndoImport() {
    if (!undoImportRef.current) {
      return;
    }

    try {
      setUndoBusy(true);
      await undoImportRef.current();
      undoImportRef.current = null;
      setStatusMessage({
        tone: 'success',
        text: 'Undo complete. The pre-import database snapshot has been restored.'
      });
    } catch (error) {
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Undo failed. Reload the app and verify local data.'
      });
    } finally {
      setUndoBusy(false);
    }
  }

  const passiveStatusClasses =
    statusMessage.tone === 'success'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : 'border-white/10 bg-black/25 text-zinc-300';
  const alertStatusClasses =
    statusMessage.tone === 'error'
      ? 'border-red-500/35 bg-red-500/10 text-red-100'
      : 'border-amber-400/30 bg-amber-400/10 text-amber-100';

  return (
    <SectionCard eyebrow="Data Sovereignty" title="Backup and Recovery">
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-6 text-zinc-300">
          Local-first only works if recovery is real. Safe actions stay forward. Destructive
          restore paths stay collapsed until you deliberately open, stage, and confirm them.
        </p>

        <AccordionSection
          sectionKey="export"
          title="Export and Backup"
          summary="Primary external backup path. Open by default because export is safe and routine."
          isOpen={expandedSections.export}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                Backup posture
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{backupStatus}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void handleJsonExport()}
                className="min-h-[44px] rounded-lg border border-emerald-400/45 bg-emerald-500 px-4 py-3 text-sm font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => void handleCsvExport()}
                className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
              >
                Export CSV
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              Export produces the recovery file. Run it routinely, especially on Safari-family
              browsers and mobile hardware where browser-managed storage can disappear.
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="import"
          title="Import and Restore"
          summary="Stage a JSON backup, inspect the preview, then choose merge or full replace."
          isOpen={expandedSections.import}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label
                htmlFor={fileInputId}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-sky-400/40 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-300"
              >
                Select JSON Backup
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  data-testid="import-file-input"
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => void handleImportSelection(event)}
                />
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              Merge is the low-risk path. Replace is the destructive restore path. Replace now stays
              locked until a pre-replace backup checkpoint is complete.
            </div>

            {pendingImport ? (
              <div className="rounded-xl border border-sky-400/25 bg-sky-400/8 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold tracking-[0.16em] text-sky-100 uppercase">
                      Import preview
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-sky-50/95">{importIntegrityText}</p>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          File
                        </dt>
                        <dd className="mt-1 break-all text-sm font-semibold text-white">
                          {pendingFileName || 'Selected file'}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          File size
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-white">
                          {formatBytes(pendingFileSize)}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          Imported rows
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-white">
                          {pendingImport.totalEntries}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          Current rows
                        </dt>
                        <dd className="mt-1 text-lg font-semibold text-white">
                          {pendingImport.existingEntryCount}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          Date range
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-white">
                          {pendingImport.dateRange
                            ? `${pendingImport.dateRange.start} to ${pendingImport.dateRange.end}`
                            : 'No valid dates detected'}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                          Merge impact
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-white">
                          {pendingImport.newEntryCount} new / {pendingImport.overwriteCount} overwrite
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="w-full max-w-sm rounded-xl border border-white/10 bg-black/20 p-4">
                    <fieldset>
                      <legend className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                        Restore mode
                      </legend>
                      <div className="mt-3 space-y-3 text-sm text-zinc-300">
                        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                          <input
                            type="radio"
                            name="import-mode"
                            value="merge"
                            checked={importMode === 'merge'}
                            onChange={() => {
                              setImportModeWithReset('merge');
                            }}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-semibold text-zinc-100">Merge</span>
                            <span className="block leading-6">
                              Write imported rows and preserve all other local rows.
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                          <input
                            type="radio"
                            name="import-mode"
                            value="replace"
                            checked={importMode === 'replace'}
                            onChange={() => {
                              setImportModeWithReset('replace');
                            }}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-semibold text-zinc-100">Replace</span>
                            <span className="block leading-6">
                              Clear local rows first, then restore from the selected backup.
                            </span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    <div className="mt-4 rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-zinc-300">
                      {getImportImpactText(pendingImport, importMode)}
                    </div>

                    <div className="my-4 border-t border-white/10" />

                    {importMode === 'replace' ? (
                      <div ref={replaceActionRef} className="space-y-4">
                        <div className="rounded-lg border border-amber-400/25 bg-amber-400/8 p-3 text-sm leading-6 text-amber-100">
                          Step 1 - secure a pre-replace backup. Step 2 - verify that the backup file exists on local disk if the browser cannot prove the write. Step 3 - arm the destructive path. Step 4 - execute the replace only if the preview still matches intent.
                        </div>

                        <div className="space-y-3">
                          {replaceBackupState.phase === 'manual-awaiting-ack' ? (
                            <div className="space-y-3 rounded-lg border border-amber-400/25 bg-amber-400/6 p-3">
                              <label className="flex items-start gap-3 text-sm leading-6 text-amber-100">
                                <input
                                  type="checkbox"
                                  checked={manualBackupConfirmed}
                                  onChange={(event) => setManualBackupConfirmed(event.target.checked)}
                                  className="mt-1"
                                />
                                <span>
                                  I confirm the backup file was successfully saved to my device before importing this restore.
                                </span>
                              </label>
                              <button
                                type="button"
                                onClick={handleAcknowledgeManualBackup}
                                disabled={!manualBackupConfirmed || importBusy}
                                className="min-h-[44px] w-full rounded-lg border border-amber-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-amber-100 uppercase transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                Unlock Replace After Manual Backup Check
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handlePrepareReplaceBackup()}
                              disabled={replaceBackupState.phase === 'saving' || importBusy}
                              className="min-h-[44px] w-full rounded-lg border border-sky-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {replaceBackupState.phase === 'saving'
                                ? 'Writing Backup'
                                : canUseVerifiedFileSave()
                                  ? 'Write Verified Pre-Replace Backup'
                                  : 'Export Pre-Replace Backup'}
                            </button>
                          )}

                          {replaceBackupState.phase === 'ready' ? (
                            <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 text-zinc-200">
                              Backup ready - {replaceBackupState.fileName}.{' '}
                              {replaceBackupState.verification === 'verified'
                                ? 'Disk write verified before replace unlock.'
                                : 'Disk write acknowledged manually before replace unlock.'}
                            </p>
                          ) : null}
                        </div>

                        <div className="border-t border-white/10 pt-4">
                          <div className="flex flex-col gap-3">
                            <button
                              type="button"
                              onClick={() => void handleConfirmImport()}
                              disabled={!replaceReady || importBusy}
                              className={`min-h-[44px] rounded-lg border px-4 py-3 text-sm font-semibold tracking-[0.14em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                                replaceConfirmState === 'armed'
                                  ? 'border-red-400/50 bg-red-950/40 text-red-100 hover:bg-red-950/55 focus-visible:outline-red-300'
                                  : 'border-red-700/45 bg-transparent text-red-300 hover:bg-red-950/25 focus-visible:outline-red-300'
                              }`}
                            >
                              {importBusy
                                ? 'Writing Import'
                                : replaceConfirmState === 'armed'
                                  ? `Execute Replace All ${pendingImport.existingEntryCount} Rows`
                                  : 'Arm Replace All Data'}
                            </button>
                            <button
                              type="button"
                              onClick={handleDisarmReplace}
                              disabled={replaceConfirmState !== 'armed' || importBusy}
                              className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Disarm Replace
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                clearPendingImport({
                                  tone: 'info',
                                  text: 'Import staging cleared. Local data unchanged.'
                                })
                              }
                              disabled={importBusy}
                              className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => void handleConfirmImport()}
                          disabled={importBusy}
                          className="min-h-[44px] rounded-lg border border-emerald-400/40 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-emerald-200 uppercase transition hover:bg-emerald-400/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-wait disabled:opacity-70"
                        >
                          {importBusy ? 'Writing Import' : 'Confirm Merge Import'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            clearPendingImport({
                              tone: 'info',
                              text: 'Import staging cleared. Local data unchanged.'
                            })
                          }
                          disabled={importBusy}
                          className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/15 p-4 text-sm leading-6 text-zinc-400">
                No file staged. Select a JSON backup to open the preview and restore controls.
              </div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="undo"
          title="Undo and Recovery"
          summary="Session-scoped rollback after a successful import. Useful, but not a substitute for export."
          isOpen={expandedSections.undo}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              Undo restores the pre-import snapshot for the current session only. Reload the app and
              that rope is gone. Keep external backups current.
            </div>
            <button
              type="button"
              onClick={() => void handleUndoImport()}
              disabled={!canUndoImport || undoBusy}
              className="min-h-[44px] rounded-lg border border-amber-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-amber-100 uppercase transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {undoBusy ? 'Undoing Import' : 'Undo Last Import'}
            </button>
            {!canUndoImport ? (
              <p className="text-sm leading-6 text-zinc-400">
                No import rollback staged in this session.
              </p>
            ) : null}
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="storage"
          title="Storage Health"
          summary="Browser-managed storage is operational terrain, not a guaranteed archive."
          isOpen={expandedSections.storage}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <StorageHealthIndicator storageHealth={storageHealth} />
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              Storage telemetry informs posture. It does not remove the need for routine export.
            </div>
          </div>
        </AccordionSection>

        <div className="space-y-3">
          <div
            className={passiveStatusText ? `min-h-12 rounded-xl border p-4 text-sm leading-6 ${passiveStatusClasses}` : 'sr-only'}
            role="status"
            aria-atomic="true"
          >
            {passiveStatusText}
          </div>
          <div
            className={alertStatusText ? `min-h-12 rounded-xl border p-4 text-sm leading-6 ${alertStatusClasses}` : 'sr-only'}
            role="alert"
            aria-atomic="true"
          >
            {alertStatusText}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
