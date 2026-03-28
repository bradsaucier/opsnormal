import { useState } from 'react';

import { SectionCard } from '../../components/SectionCard';
import { getAllEntries } from '../../db/appDb';
import { createCsvExport, createJsonExport, downloadTextFile } from '../../lib/export';

export function ExportPanel() {
  const [message, setMessage] = useState<string>('Export creates a local file. No cloud sync. No account system.');

  async function handleJsonExport() {
    try {
      const entries = await getAllEntries();
      const payload = createJsonExport(entries);
      downloadTextFile('opsnormal-export.json', payload, 'application/json');
      setMessage(`JSON export complete. ${entries.length} entries written to disk.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'JSON export failed. Reload the app and try again.');
    }
  }

  async function handleCsvExport() {
    try {
      const entries = await getAllEntries();
      const payload = createCsvExport(entries);
      downloadTextFile('opsnormal-export.csv', payload, 'text/csv;charset=utf-8');
      setMessage(`CSV export complete. ${entries.length} entries written to disk.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'CSV export failed. Reload the app and try again.');
    }
  }

  return (
    <SectionCard eyebrow="Data Sovereignty" title="Export">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-zinc-300">
          Local-first means you own the data. Export routinely, especially on iPhone or iPad, to
          maintain an external record.
        </p>
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
        </div>
      </div>
      <p className="mt-4 text-xs tracking-[0.14em] text-zinc-500 uppercase" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    </SectionCard>
  );
}
