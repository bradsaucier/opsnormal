import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppCrashFallback } from './components/AppCrashFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

export function CrashHarnessFault(): never {
  throw new Error('Crash fallback harness injected render fault.');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <AppCrashFallback error={error} onRetry={resetErrorBoundary} />
      )}
    >
      <CrashHarnessFault />
    </ErrorBoundary>
  </StrictMode>
);
