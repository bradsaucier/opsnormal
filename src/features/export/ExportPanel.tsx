import { useEffect, useMemo, useRef, useState } from 'react';

import { StorageHealthIndicator } from '../../components/StorageHealthIndicator';
import { SectionCard } from '../../components/SectionCard';
import {
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

export function ExportPanel({ storageHealth }: ExportPanelProps) {
  const [message, setMessage] = useState<string>(
    'Backup and recovery are local actions. No cloud sync. No account system.'
  );
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastExportCompletedAt());
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importBusy, setImportBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const undoImportRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setLastBackupAt(getLastExportCompletedAt());
  }, []);

  const backupStatus = useMemo(() => formatLastExportCompletedAt(lastBackupAt), [lastBackupAt]);

  async function handleJsonExport() {
    try {
      const { entryCount, exportedAt, payload } = await exportCurrentEntriesAsJson();
      downloadTextFile('opsnormal-export.json', payload, 'application/json');
      recordExportCompleted(exportedAt);
      setLastBackupAt(exportedAt);
      setMessage(`JSON export complete. ${entryCount} entries written to disk.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'JSON export failed. Reload the app and try again.');
    }
  }

  async function handleCsvExport() {
    try {
      const { entryCount, payload } = await exportCurrentEntriesAsCsv();
      downloadTextFile('opsnormal-export.csv', payload, 'text/csv;charset=utf-8');
      setMessage(`CSV export complete. ${entryCount} entries written to disk.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'CSV export failed. Reload the app and try again.');
    }
  }

  async function handleImportSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);

    if (!file) {
      return;
    }

    try {
      const preview = await previewImportFile(file);
      setPendingImport(preview);
      setPendingFileName(file.name);
      setImportMode('merge');
      setMessage(
        preview.integrityStatus === 'verified'
          ? `Import staged. ${preview.totalEntries} entries validated. Review the mode and confirm to write.`
          : `Legacy import staged. ${preview.totalEntries} entries validated, but this file has no integrity checksum. Review the mode and confirm to write.`
      );
    } catch (error) {
      setPendingImport(null);
      setPendingFileName('');
      setMessage(error instanceof Error ? error.message : 'Import preparation failed.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return;
    }

    try {
      setImportBusy(true);
      const { importedCount, undo } = await applyImport(pendingImport.payload, importMode);
      undoImportRef.current = undo;
      setPendingImport(null);
      setPendingFileName('');
      setMessage(
        `${importMode === 'replace' ? 'Replace' : 'Merge'} import complete. ${importedCount} entries applied.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed during database write.');
    } finally {
      setImportBusy(false);
    }
  }

  async function handleUndoImport() {
    if (!undoImportRef.current) {
      return;
    }

    try {
      setUndoBusy(true);
      await undoImportRef.current();
      undoImportRef.current = null;
      setMessage('Undo complete. The pre-import database snapshot has been restored.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Undo failed. Reload the app and verify local data.');
    } finally {
      setUndoBusy(false);
    }
  }

  return (
    <SectionCard eyebrow="Data Sovereignty" title="Backup and Recovery">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <p className="max-w-2xl text-sm leading-6 text-zinc-300">
            Local-first only works if recovery is real. Export creates external backups. Import
            validates before write and aborts the transaction if post-write verification fails.
          </p>

          <StorageHealthIndicator storageHealth={storageHealth} />

          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
              Backup posture
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{backupStatus}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleJsonExport()}
              className="min-h-11 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-emerald-200 uppercase transition hover:bg-emerald-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => void handleCsvExport()}
              className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-sky-100 uppercase transition hover:bg-sky-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Import JSON
            </button>
            {undoImportRef.current ? (
              <button
                type="button"
                onClick={() => void handleUndoImport()}
                disabled={undoBusy}
                className="min-h-11 rounded-lg border border-orange-400/40 bg-orange-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-orange-100 uppercase transition hover:bg-orange-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 disabled:cursor-wait disabled:opacity-70"
              >
                {undoBusy ? 'Undoing' : 'Undo Import'}
              </button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            data-testid="import-file-input"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportSelection(event)}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            Operating notes
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
            <li>Export routinely, especially on iPhone and iPad.</li>
            <li>Use merge to add or refresh selected days without wiping the browser database.</li>
            <li>Use replace only when restoring a full backup snapshot.</li>
            <li>Undo is session-scoped. Once the app is reloaded, that safety rope is gone.</li>
          </ol>
        </div>
      </div>

      {pendingImport ? (
        <div className="mt-5 rounded-xl border border-sky-400/25 bg-sky-400/8 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-[0.16em] text-sky-100 uppercase">
                Import ready
              </h3>
              <p className="mt-2 text-sm leading-6 text-sky-50/95">
                {pendingFileName || 'Selected file'} passed validation. Review the impact before
                committing it to local storage.
              </p>
              {pendingImport.integrityStatus === 'legacy-unverified' ? (
                <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-100">
                  Legacy backup detected. This file predates export integrity checks, so content
                  structure is validated but file integrity is not cryptographically verified.
                </p>
              ) : (
                <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm leading-6 text-emerald-100">
                  Integrity verified. The embedded SHA-256 checksum matched before write staging.
                </p>
              )}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                    Entries
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {pendingImport.totalEntries}
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
                    New rows
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {pendingImport.newEntryCount}
                  </dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <dt className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                    Overwrites
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-white">
                    {pendingImport.overwriteCount}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="w-full max-w-xs rounded-xl border border-white/10 bg-black/20 p-4">
              <fieldset>
                <legend className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                  Import mode
                </legend>
                <div className="mt-3 space-y-3 text-sm text-zinc-300">
                  <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <input
                      type="radio"
                      name="import-mode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
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
                      onChange={() => setImportMode('replace')}
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

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  disabled={importBusy}
                  className="min-h-11 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-emerald-200 uppercase transition hover:bg-emerald-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-70"
                >
                  {importBusy ? 'Writing Import' : 'Confirm Import'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingImport(null);
                    setPendingFileName('');
                    setMessage('Import staging cleared. Local data unchanged.');
                  }}
                  disabled={importBusy}
                  className="min-h-11 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300">
        {message}
      </div>
    </SectionCard>
  );
}
