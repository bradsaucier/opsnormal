import { useMemo, useState } from 'react';

import { getErrorMessage } from '../lib/errors';
import { readEntriesForCrashExport } from '../lib/crashExport';
import {
  createCsvExport,
  createJsonExport,
  downloadTextFile,
  recordExportCompleted
} from '../lib/export';
import { reloadCurrentPage } from '../lib/runtime';

interface AppCrashFallbackProps {
  error: Error;
  onRetry: () => void;
}

export function AppCrashFallback({ error, onRetry }: AppCrashFallbackProps) {
  const [busyAction, setBusyAction] = useState<'json' | 'csv' | null>(null);
  const [message, setMessage] = useState(
    'The display crashed but your data may still be intact in local storage. Export it now before reloading.'
  );

  const faultMessage = useMemo(
    () => getErrorMessage(error, 'Unknown render failure.'),
    [error]
  );

  async function handleJsonExport() {
    try {
      setBusyAction('json');
      const entries = await readEntriesForCrashExport();
      const exportedAt = new Date().toISOString();
      const payload = await createJsonExport(entries, exportedAt);
      downloadTextFile('opsnormal-crash-export.json', payload, 'application/json');
      recordExportCompleted(exportedAt);
      setMessage(`JSON export complete. ${entries.length} entries recovered.`);
    } catch {
      setMessage('JSON export failed. Try reloading first.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCsvExport() {
    try {
      setBusyAction('csv');
      const entries = await readEntriesForCrashExport();
      const payload = createCsvExport(entries);
      const exportedAt = new Date().toISOString();
      downloadTextFile('opsnormal-crash-export.csv', payload, 'text/csv;charset=utf-8');
      recordExportCompleted(exportedAt);
      setMessage(`CSV export complete. ${entries.length} entries recovered.`);
    } catch {
      setMessage('CSV export failed. Try reloading first.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0f0d',
        color: '#e4e4e7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem'
      }}
    >
      <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: '#fca5a5'
          }}
        >
          Render fault
        </p>
        <h1
          style={{
            marginTop: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}
        >
          OpsNormal stopped rendering
        </h1>
        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.75',
            color: '#a1a1aa'
          }}
        >
          {message}
        </p>

        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(0,0,0,0.25)'
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#71717a'
            }}
          >
            Error detail
          </p>
          <p
            style={{
              marginTop: '0.5rem',
              fontSize: '0.8125rem',
              fontFamily: 'monospace',
              color: '#fca5a5',
              wordBreak: 'break-word'
            }}
          >
            {faultMessage}
          </p>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => void handleJsonExport()}
            disabled={busyAction !== null}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#a7f3d0',
              backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(52,211,153,0.4)',
              borderRadius: '0.5rem',
              cursor: busyAction === null ? 'pointer' : 'wait',
              opacity: busyAction === null ? 1 : 0.7
            }}
          >
            {busyAction === 'json' ? 'Exporting JSON' : 'Export JSON'}
          </button>
          <button
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={busyAction !== null}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#e4e4e7',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.5rem',
              cursor: busyAction === null ? 'pointer' : 'wait',
              opacity: busyAction === null ? 1 : 0.7
            }}
          >
            {busyAction === 'csv' ? 'Exporting CSV' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#93c5fd',
              backgroundColor: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Retry app
          </button>
          <button
            type="button"
            onClick={reloadCurrentPage}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#fdba74',
              backgroundColor: 'rgba(251,146,60,0.1)',
              border: '1px solid rgba(251,146,60,0.4)',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Reload page
          </button>
        </div>

        <p
          style={{
            marginTop: '2rem',
            fontSize: '0.75rem',
            lineHeight: '1.75',
            color: '#52525b'
          }}
        >
          If this fault survives retry and reload, export first, then clear the site data through
          your browser settings before restoring from backup.
        </p>
      </div>
    </div>
  );
}
