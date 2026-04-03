import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AppCrashFallback } from './components/AppCrashFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { renderBootFailureFallback } from './lib/bootFallback';
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
  renderBootFailureFallback(rootElement);
}
