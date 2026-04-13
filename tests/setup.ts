import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

import { configureAxe } from 'vitest-axe';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

export async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
