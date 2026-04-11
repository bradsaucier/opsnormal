import type { ChangeEvent, RefObject } from 'react';

import { formatBytes } from '../../lib/storage';
import type { ImportMode, ImportPreview } from '../../types';
import type { ReplaceBackupState, ReplaceConfirmState } from './workflowTypes';
import { getImportImpactText } from './exportPanelHelpers';
import {
  AccordionSection,
  type AccordionSectionKey,
  PreviewFactCard,
  SignalCard
} from './exportPanelShared';

interface ImportRestoreSectionProps {
  isOpen: boolean;
  onToggle: (sectionKey: AccordionSectionKey) => void;
  fileInputId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportSelection: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  pendingImport: ImportPreview | null;
  pendingFileName: string;
  pendingFileSize: number;
  importBusy: boolean;
  importMode: ImportMode;
  onImportModeChange: (nextMode: ImportMode) => void;
  onConfirmImport: () => Promise<void>;
  onCancelImport: () => void;
  replaceActionRef: RefObject<HTMLDivElement | null>;
  replaceBackupState: ReplaceBackupState;
  replaceConfirmState: ReplaceConfirmState;
  replaceReady: boolean;
  supportsVerifiedFileSave: boolean;
  manualBackupConfirmed: boolean;
  onManualBackupConfirmedChange: (checked: boolean) => void;
  onPrepareReplaceBackup: () => Promise<void>;
  onAcknowledgeManualBackup: () => void;
  onDisarmReplace: () => void;
}

export function ImportRestoreSection({
  isOpen,
  onToggle,
  fileInputId,
  fileInputRef,
  onImportSelection,
  pendingImport,
  pendingFileName,
  pendingFileSize,
  importBusy,
  importMode,
  onImportModeChange,
  onConfirmImport,
  onCancelImport,
  replaceActionRef,
  replaceBackupState,
  replaceConfirmState,
  replaceReady,
  supportsVerifiedFileSave,
  manualBackupConfirmed,
  onManualBackupConfirmedChange,
  onPrepareReplaceBackup,
  onAcknowledgeManualBackup,
  onDisarmReplace
}: ImportRestoreSectionProps) {
  const importIntegrityText = pendingImport
    ? pendingImport.integrityStatus === 'verified'
      ? 'Integrity verified. Embedded SHA-256 checksum matched before write staging.'
      : 'Legacy backup detected. Structure validated, but this file has no integrity checksum.'
    : '';

  return (
    <AccordionSection
      sectionKey="import"
      title="Import and Restore"
      summary="Stage a JSON backup, inspect the preview, then choose merge or full replace."
      isOpen={isOpen}
      onToggle={onToggle}
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
              onChange={(event) => void onImportSelection(event)}
            />
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <SignalCard
            label="Preferred path"
            value="Merge first"
            detail="Merge is the low-risk path. It writes imported rows and leaves all other local rows in place."
            tone="safe"
          />
          <SignalCard
            label="Destructive path"
            value="Replace stays gated"
            detail="Replace clears current rows first and stays locked until the pre-replace backup checkpoint is complete."
            tone="warning"
          />
        </div>

        {pendingImport ? (
          <div className="rounded-xl border border-sky-400/25 bg-sky-400/8 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold tracking-[0.16em] text-sky-100 uppercase">
                  Import preview
                </h4>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {pendingFileName || 'Selected file'}
                </p>
                <p className="mt-2 text-sm leading-6 text-sky-50/95">{importIntegrityText}</p>
                <p className="mt-2 text-xs tracking-[0.14em] text-zinc-400 uppercase">
                  File size - {formatBytes(pendingFileSize)}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PreviewFactCard label="Imported rows" value={String(pendingImport.totalEntries)} />
                  <PreviewFactCard
                    label="Current rows"
                    value={String(pendingImport.existingEntryCount)}
                  />
                  <PreviewFactCard
                    label="Date range"
                    value={
                      pendingImport.dateRange
                        ? `${pendingImport.dateRange.start} to ${pendingImport.dateRange.end}`
                        : 'No valid dates detected'
                    }
                  />
                  <PreviewFactCard
                    label={importMode === 'replace' ? 'Replace impact' : 'Merge impact'}
                    value={
                      importMode === 'replace'
                        ? `${pendingImport.existingEntryCount} current rows cleared`
                        : `${pendingImport.newEntryCount} new / ${pendingImport.overwriteCount} overwrite`
                    }
                    detail={
                      importMode === 'replace'
                        ? 'All current rows will be cleared before restore.'
                        : 'All other local rows stay in place.'
                    }
                  />
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
                          onImportModeChange('merge');
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
                          onImportModeChange('replace');
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
                  {importMode === 'replace'
                    ? 'Destructive restore path selected. '
                    : 'Merge path selected. '}
                  {getImportImpactText(pendingImport, importMode)}
                </div>

                <div className="my-4 border-t border-white/10" />

                {importMode === 'replace' ? (
                  <div
                    ref={replaceActionRef}
                    className="mt-6 space-y-4 rounded-xl border border-red-500/20 bg-red-950/10 p-4"
                  >
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
                              onChange={(event) =>
                                onManualBackupConfirmedChange(event.target.checked)
                              }
                              className="mt-1"
                            />
                            <span>
                              I confirm the backup file was successfully saved to my device before importing this restore.
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={onAcknowledgeManualBackup}
                            disabled={!manualBackupConfirmed || importBusy}
                            className="min-h-[44px] w-full rounded-lg border border-amber-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-amber-100 uppercase transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Unlock Replace After Manual Backup Check
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void onPrepareReplaceBackup()}
                          disabled={replaceBackupState.phase === 'saving' || importBusy}
                          className="min-h-[44px] w-full rounded-lg border border-sky-400/35 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {replaceBackupState.phase === 'saving'
                            ? 'Writing Backup'
                            : supportsVerifiedFileSave
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
                          onClick={() => void onConfirmImport()}
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
                          onClick={onDisarmReplace}
                          disabled={replaceConfirmState !== 'armed' || importBusy}
                          className="min-h-[44px] rounded-lg border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Disarm Replace
                        </button>
                        <button
                          type="button"
                          onClick={onCancelImport}
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
                      onClick={() => void onConfirmImport()}
                      disabled={importBusy}
                      className="min-h-[44px] rounded-lg border border-emerald-400/40 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.14em] text-emerald-200 uppercase transition hover:bg-emerald-400/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-wait disabled:opacity-70"
                    >
                      {importBusy ? 'Writing Import' : 'Confirm Merge Import'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelImport}
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
  );
}
