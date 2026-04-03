import { renderBootFailureFallback } from './lib/bootFallback';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Root element #root not found for boot fallback harness.');
}

renderBootFailureFallback(rootElement);
