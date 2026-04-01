import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AppCrashFallback } from './components/AppCrashFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { onCaughtError, onRecoverableError, onUncaughtError } from './lib/runtime';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found.');
}

try {
  createRoot(rootElement, {
    onCaughtError,
    onUncaughtError,
    onRecoverableError
  }).render(
    <StrictMode>
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <AppCrashFallback error={error} onRetry={resetErrorBoundary} />
        )}
      >
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (bootError) {
  console.error('[OpsNormal] Boot failure:', bootError);
  rootElement.innerHTML = [
    '<div style="min-height:100vh;background:#0a0f0d;color:#e4e4e7;font-family:system-ui;padding:2rem">',
    '<div style="max-width:40rem;margin:0 auto">',
    '<p style="font-size:0.75rem;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#fca5a5">Boot failure</p>',
    '<h1 style="margin-top:0.5rem;font-size:1.5rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">OpsNormal failed to start</h1>',
    '<p style="margin-top:1rem;font-size:0.875rem;line-height:1.75;color:#a1a1aa">Your data may still exist in local storage. Try reloading. If this persists, clear site data through browser settings after exporting.</p>',
    '<button onclick="location.reload()" style="margin-top:1.5rem;padding:0.5rem 1rem;font-size:0.8125rem;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#fdba74;background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.4);border-radius:0.5rem;cursor:pointer">Reload</button>',
    '</div></div>'
  ].join('');
}
