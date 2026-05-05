import type { ChangeEvent, RefObject } from 'react';

import { NotchedFrame } from '../../components/NotchedFrame';
import { getAlertSurfaceTonePalette } from '../../components/alertSurfaceTone';
import { formatBytes } from '../../lib/storage';
import {
  isSuccessfulImportPreview,
  type ImportMode,
  type ImportPreview,
} from '../../types';
import type { ReplaceBackupState, ReplaceConfirmState } from './workflowTypes';
import {
  formatImportAge,
  formatImportExportedAt,
  getImportImpactText,
  getImportPreviewDetailText,
  getImportPreviewHeadline,
  getImportRiskAcknowledgmentLabel,
} from './exportPanelHelpers';
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
  pendingImportCanCommit: boolean;
  pendingImportRequiresAcknowledgment: boolean;
  riskyImportAcknowledged: boolean;
  onRiskyImportAcknowledgedChange: (checked: boolean) => void;
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

const actionButtonClasses = 'ops-action-button';

function getModeOptionClasses(isSelected: boolean, mode: ImportMode): string {
  if (!isSelected) {
    return 'clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-neutral p-3 text-ops-text-secondary transition hover:text-ops-text-primary';
  }

  if (mode === 'replace') {
    return 'clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-amber p-3';
  }

  return 'clip-notched ops-notch-chip tactical-chip-panel p-3 text-ops-text-primary';
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
  pendingImportCanCommit,
  pendingImportRequiresAcknowledgment,
  riskyImportAcknowledged,
  onRiskyImportAcknowledgedChange,
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
  const successfulPreview = isSuccessfulImportPreview(pendingImport)
    ? pendingImport
    : null;
  const importPreviewHeadline = pendingImport
    ? getImportPreviewHeadline(pendingImport)
    : '';
  const importPreviewDetailText = pendingImport
    ? getImportPreviewDetailText(pendingImport)
    : '';
  const importRiskAcknowledgmentLabel =
    successfulPreview && pendingImportRequiresAcknowledgment
      ? getImportRiskAcknowledgmentLabel(successfulPreview)
      : '';

  const replaceCheckpointStepTwoText = getReplaceCheckpointStepTwoText(
    replaceBackupState,
    supportsVerifiedFileSave,
  );

  const manualBackupInstructionText =
    getManualBackupInstructionText(replaceBackupState);
  const infoTone = getAlertSurfaceTonePalette('info');
  const dangerTone = getAlertSurfaceTonePalette('danger');

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
            className={`ops-action-button ops-action-button-sky ops-focus-ring-within cursor-pointer ${importBusy ? 'pointer-events-none opacity-70' : ''}`}
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

        <div role="list" className="grid gap-3 lg:grid-cols-2">
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
            outerClassName={infoTone.outerClassName}
            innerClassName={`p-4 ${infoTone.innerClassName}`}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex-1">
                <h4
                  className={`ops-tracking-table text-sm font-semibold uppercase ${infoTone.titleClassName}`}
                >
                  Import preview
                </h4>
                <p className="mt-2 break-all text-sm font-semibold text-ops-text-primary">
                  {pendingFileName || 'Selected file'}
                </p>
                <p
                  className={`mt-2 text-sm leading-6 ${infoTone.descriptionClassName}`}
                >
                  {importPreviewHeadline}
                </p>
                <p
                  className={`mt-2 text-sm leading-6 ${infoTone.descriptionClassName}`}
                >
                  {importPreviewDetailText}
                </p>
                <p
                  className={`ops-eyebrow mt-2 text-xs ${infoTone.subduedClassName}`}
                >
                  File size - {formatBytes(pendingFileSize)}
                </p>
                {successfulPreview ? (
                  <>
                    <div
                      role="list"
                      className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    >
                      <PreviewFactCard
                        label="Exported at"
                        value={formatImportExportedAt(
                          successfulPreview.exportedAt,
                        )}
                      />
                      <PreviewFactCard
                        label="Backup age"
                        value={formatImportAge(successfulPreview.ageMs)}
                      />
                      <PreviewFactCard
                        label="Imported rows"
                        value={String(successfulPreview.totalEntries)}
                      />
                      <PreviewFactCard
                        label="Current rows"
                        value={String(successfulPreview.existingEntryCount)}
                      />
                      <PreviewFactCard
                        label="Date range"
                        value={
                          successfulPreview.dateRange
                            ? `${successfulPreview.dateRange.start} to ${successfulPreview.dateRange.end}`
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
                            ? `${successfulPreview.existingEntryCount} current rows cleared`
                            : `${successfulPreview.newEntryCount} new / ${successfulPreview.overwriteCount} overwrite`
                        }
                        detail={
                          importMode === 'replace'
                            ? 'All current rows will be cleared before restore.'
                            : 'All other local rows stay in place.'
                        }
                      />
                    </div>

                    {pendingImportRequiresAcknowledgment ? (
                      <div className="panel-shadow mt-4">
                        <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-amber p-3">
                          <div>
                            <p className="text-sm leading-6">
                              Review the staged file risk before merge or
                              replace unlocks.
                            </p>
                            <label className="mt-3 flex items-start gap-3 text-sm leading-6">
                              <input
                                type="checkbox"
                                checked={riskyImportAcknowledged}
                                onChange={(event) =>
                                  onRiskyImportAcknowledgedChange(
                                    event.target.checked,
                                  )
                                }
                                className="mt-1"
                              />
                              <span>{importRiskAcknowledgmentLabel}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="panel-shadow mt-4">
                    <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-rose p-3 text-sm leading-6">
                      Local data unchanged. Select a different JSON backup or
                      clear this preview.
                    </div>
                  </div>
                )}
              </div>

              <NotchedFrame
                className="w-full max-w-sm"
                emphasis="inset"
                innerClassName="tactical-chip-panel tactical-chip-panel-neutral p-4"
              >
                {successfulPreview ? (
                  <>
                    <fieldset>
                      <legend className="ops-eyebrow text-xs font-semibold text-ops-text-muted">
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
                              Write imported rows and preserve all other local
                              rows.
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
                              Clear local rows first, then restore from the
                              selected backup.
                            </span>
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    <div className="panel-shadow mt-4">
                      <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-neutral px-3 py-3 text-sm leading-6 text-ops-text-secondary">
                        {importMode === 'replace'
                          ? 'Destructive restore path selected. '
                          : 'Merge path selected. '}
                        {getImportImpactText(successfulPreview, importMode)}
                      </div>
                    </div>

                    {!pendingImportCanCommit ? (
                      <div className="panel-shadow mt-4">
                        <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-amber px-3 py-3 text-sm leading-6">
                          Acknowledge the staged file risk before the write path
                          unlocks.
                        </div>
                      </div>
                    ) : null}

                    <div className="my-4 border-t border-ops-border-soft" />

                    {importMode === 'replace' ? (
                      <NotchedFrame
                        className="mt-6"
                        outerClassName={dangerTone.outerClassName}
                        innerClassName={`p-4 ${dangerTone.innerClassName}`}
                      >
                        <div ref={replaceActionRef}>
                          <div className="panel-shadow">
                            <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-amber p-3 text-sm leading-6">
                              Step 1 - secure a pre-replace backup.{' '}
                              {replaceCheckpointStepTwoText} Step 3 - arm the
                              destructive path. Step 4 - execute the replace
                              only if the preview still matches intent.
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {replaceBackupState.phase ===
                            'manual-awaiting-ack' ? (
                              <div className="panel-shadow">
                                <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-amber p-3">
                                  <div>
                                    <p className="mb-3 text-sm leading-6">
                                      {manualBackupInstructionText}
                                    </p>
                                    <label className="flex items-start gap-3 text-sm leading-6">
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
                                        I confirm the backup file was
                                        successfully saved to my device before
                                        importing this restore.
                                      </span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={onAcknowledgeManualBackup}
                                      disabled={
                                        !manualBackupConfirmed || importBusy
                                      }
                                      className={`${actionButtonClasses} ops-action-button-amber mt-3 w-full`}
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
                                  !pendingImportCanCommit ||
                                  replaceBackupState.phase === 'saving' ||
                                  importBusy
                                }
                                className={`${actionButtonClasses} ops-action-button-amber w-full`}
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
                                <div className="clip-notched ops-notch-chip tactical-chip-panel tactical-chip-panel-neutral px-3 py-3 text-sm leading-6 text-ops-text-primary">
                                  <p>
                                    Backup ready - {replaceBackupState.fileName}
                                    .{' '}
                                    {replaceBackupState.verification ===
                                    'verified'
                                      ? 'Disk write read-back verified before replace unlock.'
                                      : 'Manual local-disk check acknowledged before replace unlock.'}
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-4 border-t border-ops-panel-border-strong pt-4">
                            <div className="flex flex-col gap-3">
                              <button
                                type="button"
                                onClick={() => void onConfirmImport()}
                                disabled={
                                  !pendingImportCanCommit ||
                                  !replaceReady ||
                                  importBusy
                                }
                                className={`${actionButtonClasses} ${replaceConfirmState === 'armed' ? 'ops-action-button-red' : 'ops-action-button-amber'}`}
                              >
                                {importBusy
                                  ? 'Writing Import'
                                  : replaceConfirmState === 'armed'
                                    ? `Execute Replace All ${successfulPreview.existingEntryCount} Rows`
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
                          disabled={!pendingImportCanCommit || importBusy}
                          className={`${actionButtonClasses} ops-action-button-emerald-solid w-full`}
                        >
                          {importBusy
                            ? 'Writing Import'
                            : 'Confirm Merge Import'}
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
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={onCancelImport}
                      disabled={importBusy}
                      className={`${actionButtonClasses} ops-action-button-subtle w-full`}
                    >
                      Clear Preview
                    </button>
                  </div>
                )}
              </NotchedFrame>
            </div>
          </NotchedFrame>
        ) : (
          <NotchedFrame
            emphasis="inset"
            innerClassName="tactical-chip-panel tactical-chip-panel-neutral p-4 text-sm leading-6 text-ops-text-muted"
          >
            No file staged. Select a JSON backup to open the preview and restore
            controls.
          </NotchedFrame>
        )}
      </div>
    </AccordionSection>
  );
}
