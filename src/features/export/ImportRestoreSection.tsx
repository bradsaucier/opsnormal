import type { ChangeEvent, RefObject } from 'react';

import { NotchedFrame } from '../../components/NotchedFrame';
import { formatBytes } from '../../lib/storage';
import type { ImportMode, ImportPreview } from '../../types';
import type { ReplaceBackupState, ReplaceConfirmState } from './workflowTypes';
import { getImportImpactText } from './exportPanelHelpers';
import {
  AccordionSection,
  type AccordionSectionKey,
  PreviewFactCard,
  SignalCard,
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

const actionButtonClasses =
  'ops-action-button clip-notched ops-notch-chip px-4 py-3 text-sm font-semibold tracking-[0.14em] uppercase';

function getModeOptionClasses(isSelected: boolean, mode: ImportMode): string {
  if (!isSelected) {
    return 'clip-notched ops-notch-chip border border-ops-border-soft bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-overlay)] p-3 text-ops-text-secondary transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%),var(--color-ops-surface-interactive)]';
  }

  if (mode === 'replace') {
    return 'clip-notched ops-notch-chip border border-amber-400/35 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-overlay)] p-3 text-amber-50';
  }

  return 'clip-notched ops-notch-chip border border-emerald-400/35 bg-[linear-gradient(180deg,rgba(16,185,129,0.16),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-overlay)] p-3 text-emerald-50';
}

function getReplaceCheckpointStepTwoText(
  replaceBackupState: ReplaceBackupState,
  supportsVerifiedFileSave: boolean,
): string {
  if (replaceBackupState.phase === 'ready') {
    return replaceBackupState.verification === 'verified'
      ? 'Step 2 - browser read-back proof complete.'
      : 'Step 2 - manual local-disk check acknowledged.';
  }

  if (replaceBackupState.phase === 'manual-awaiting-ack') {
    return replaceBackupState.reason === 'readback-unavailable'
      ? 'Step 2 - browser read-back proof unavailable. Verify the file exists on local disk and acknowledge before replace can unlock.'
      : 'Step 2 - backup download triggered. Verify the file exists on local disk and acknowledge before replace can unlock.';
  }

  return supportsVerifiedFileSave
    ? 'Step 2 - the browser must read the saved file back before replace can unlock.'
    : 'Step 2 - verify the file exists on local disk and acknowledge before replace can unlock.';
}

function getManualBackupInstructionText(
  replaceBackupState: ReplaceBackupState,
): string {
  if (replaceBackupState.phase !== 'manual-awaiting-ack') {
    return '';
  }

  return replaceBackupState.reason === 'readback-unavailable'
    ? 'Browser read-back proof unavailable. Verify the saved file exists on local disk, then acknowledge before replace unlocks.'
    : 'Backup download triggered. Verify the saved file exists on local disk, then acknowledge before replace unlocks.';
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
  onDisarmReplace,
}: ImportRestoreSectionProps) {
  const importIntegrityText = pendingImport
    ? pendingImport.integrityStatus === 'verified'
      ? 'Integrity verified. Embedded SHA-256 checksum matched before write staging.'
      : 'Legacy backup detected. Structure validated, but this file has no integrity checksum.'
    : '';

  const replaceCheckpointStepTwoText = getReplaceCheckpointStepTwoText(
    replaceBackupState,
    supportsVerifiedFileSave,
  );

  const manualBackupInstructionText =
    getManualBackupInstructionText(replaceBackupState);

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
            className={`ops-action-button ops-action-button-info ops-focus-ring-within clip-notched ops-notch-chip cursor-pointer px-4 py-3 text-sm font-semibold tracking-[0.14em] uppercase ${importBusy ? 'pointer-events-none opacity-70' : ''}`}
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
          <NotchedFrame
            outerClassName="bg-[linear-gradient(180deg,rgba(125,211,252,0.34),rgba(255,255,255,0.04))]"
            innerClassName="bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-raised)] p-4"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold tracking-[0.16em] text-sky-100 uppercase">
                  Import preview
                </h4>
                <p className="mt-2 break-all text-sm font-semibold text-white">
                  {pendingFileName || 'Selected file'}
                </p>
                <p className="mt-2 text-sm leading-6 text-sky-50/95">
                  {importIntegrityText}
                </p>
                <p className="mt-2 text-xs tracking-[0.14em] text-sky-100/75 uppercase">
                  File size - {formatBytes(pendingFileSize)}
                </p>
                <div
                  role="list"
                  className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <PreviewFactCard
                    label="Imported rows"
                    value={String(pendingImport.totalEntries)}
                  />
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
                    label={
                      importMode === 'replace'
                        ? 'Replace impact'
                        : 'Merge impact'
                    }
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
                </div>
              </div>

              <NotchedFrame
                className="w-full max-w-sm"
                outerClassName="bg-ops-border-soft"
                innerClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%),var(--color-ops-surface-overlay)] p-4"
              >
                <fieldset>
                  <legend className="text-xs font-semibold tracking-[0.16em] text-ops-text-muted uppercase">
                    Restore mode
                  </legend>
                  <div className="mt-3 space-y-3 text-sm text-ops-text-secondary">
                    <label
                      className={`flex items-start gap-3 ${getModeOptionClasses(importMode === 'merge', 'merge')}`}
                    >
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
                        <span className="block font-semibold text-ops-text-primary">
                          Merge
                        </span>
                        <span className="block leading-6">
                          Write imported rows and preserve all other local rows.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex items-start gap-3 ${getModeOptionClasses(importMode === 'replace', 'replace')}`}
                    >
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
                        <span className="block font-semibold text-ops-text-primary">
                          Replace
                        </span>
                        <span className="block leading-6">
                          Clear local rows first, then restore from the selected
                          backup.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div className="panel-shadow mt-4">
                  <div className="clip-notched ops-notch-chip bg-ops-border-soft p-px">
                    <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-base)] px-3 py-3 text-sm leading-6 text-ops-text-secondary">
                      {importMode === 'replace'
                        ? 'Destructive restore path selected. '
                        : 'Merge path selected. '}
                      {getImportImpactText(pendingImport, importMode)}
                    </div>
                  </div>
                </div>

                <div className="my-4 border-t border-ops-border-soft" />

                {importMode === 'replace' ? (
                  <NotchedFrame
                    className="mt-6"
                    outerClassName="bg-[linear-gradient(180deg,rgba(248,113,113,0.34),rgba(255,255,255,0.04))]"
                    innerClassName="bg-[linear-gradient(180deg,rgba(239,68,68,0.14),rgba(255,255,255,0.02)_30%),var(--color-ops-surface-overlay)] p-4"
                  >
                    <div ref={replaceActionRef}>
                      <div className="panel-shadow">
                        <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(251,191,36,0.32),rgba(255,255,255,0.04))] p-px">
                          <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(255,255,255,0.02)_28%),var(--color-ops-surface-overlay)] p-3 text-sm leading-6 text-amber-50">
                            Step 1 - secure a pre-replace backup.{' '}
                            {replaceCheckpointStepTwoText} Step 3 - arm the
                            destructive path. Step 4 - execute the replace only
                            if the preview still matches intent.
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {replaceBackupState.phase === 'manual-awaiting-ack' ? (
                          <div className="panel-shadow">
                            <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(251,191,36,0.32),rgba(255,255,255,0.04))] p-px">
                              <div className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(255,255,255,0.02)_28%),var(--color-ops-surface-overlay)] p-3">
                                <p className="mb-3 text-sm leading-6 text-amber-100">
                                  {manualBackupInstructionText}
                                </p>
                                <label className="flex items-start gap-3 text-sm leading-6 text-amber-100">
                                  <input
                                    type="checkbox"
                                    checked={manualBackupConfirmed}
                                    onChange={(event) =>
                                      onManualBackupConfirmedChange(
                                        event.target.checked,
                                      )
                                    }
                                    className="mt-1"
                                  />
                                  <span>
                                    I confirm the backup file was successfully
                                    saved to my device before importing this
                                    restore.
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  onClick={onAcknowledgeManualBackup}
                                  disabled={
                                    !manualBackupConfirmed || importBusy
                                  }
                                  className={`${actionButtonClasses} ops-action-button-warning mt-3 w-full`}
                                >
                                  Unlock Replace After Manual Backup Check
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void onPrepareReplaceBackup()}
                            disabled={
                              replaceBackupState.phase === 'saving' ||
                              importBusy
                            }
                            className={`${actionButtonClasses} ops-action-button-info w-full`}
                          >
                            {replaceBackupState.phase === 'saving'
                              ? 'Writing Backup'
                              : supportsVerifiedFileSave
                                ? 'Write and Verify Pre-Replace Backup'
                                : 'Export Pre-Replace Backup'}
                          </button>
                        )}

                        {replaceBackupState.phase === 'ready' ? (
                          <div className="panel-shadow">
                            <div className="clip-notched ops-notch-chip bg-ops-border-soft p-px">
                              <p className="clip-notched ops-notch-chip bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%),var(--color-ops-surface-base)] px-3 py-3 text-sm leading-6 text-ops-text-primary">
                                Backup ready - {replaceBackupState.fileName}.{' '}
                                {replaceBackupState.verification === 'verified'
                                  ? 'Disk write read-back verified before replace unlock.'
                                  : 'Manual local-disk check acknowledged before replace unlock.'}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 border-t border-red-400/20 pt-4">
                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={() => void onConfirmImport()}
                            disabled={!replaceReady || importBusy}
                            className={`${actionButtonClasses} ${replaceConfirmState === 'armed' ? 'ops-action-button-danger' : 'ops-action-button-warning'}`}
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
                            disabled={
                              replaceConfirmState !== 'armed' || importBusy
                            }
                            className={`${actionButtonClasses} ops-action-button-subtle`}
                          >
                            Disarm Replace
                          </button>
                          <button
                            type="button"
                            onClick={onCancelImport}
                            disabled={importBusy}
                            className={`${actionButtonClasses} ops-action-button-subtle`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </NotchedFrame>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => void onConfirmImport()}
                      disabled={importBusy}
                      className={`${actionButtonClasses} ops-action-button-success w-full`}
                    >
                      {importBusy ? 'Writing Import' : 'Confirm Merge Import'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelImport}
                      disabled={importBusy}
                      className={`${actionButtonClasses} ops-action-button-subtle w-full`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </NotchedFrame>
            </div>
          </NotchedFrame>
        ) : (
          <NotchedFrame
            outerClassName="bg-ops-border-soft"
            innerClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_24%),var(--color-ops-surface-base)] p-4 text-sm leading-6 text-ops-text-muted"
          >
            No file staged. Select a JSON backup to open the preview and restore
            controls.
          </NotchedFrame>
        )}
      </div>
    </AccordionSection>
  );
}
