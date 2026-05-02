import { defineConfig } from 'vitest/config';

const targetedCoverageModules = [
  'src/lib/date.ts',
  'src/lib/canonicalJson.ts',
  'src/lib/export.ts',
  'src/lib/exportSerialization.ts',
  'src/lib/fileDownload.ts',
  'src/lib/history.ts',
  'src/lib/runtime.ts',
  'src/lib/status.ts',
  'src/hooks/useStorageHealth.ts',
  'src/db/appDb.ts',
  'src/db/migrations/index.ts',
  'src/services/entryWrittenCoordination.ts',
  'src/services/importService.ts',
  'src/services/importValidation.ts',
  'src/features/export/backupActionPrompt.ts',
  'src/features/history/useViewportMatch.ts',
  'src/features/pwa/controllerReloadRecovery.ts',
  'src/features/pwa/pwaUpdateCoordination.ts',
  'src/features/pwa/swUpdateRuntime.ts',
];

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts{,x}'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      include: targetedCoverageModules,
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        // Coverage stays incremental on purpose. The targeted module list marks
        // the repo's highest-risk logic until broader thresholds are justified.
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 65,
        'src/lib/date.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100,
        },
        'src/lib/exportSerialization.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100,
        },
        'src/services/importService.ts': {
          lines: 94.93,
          functions: 100,
          statements: 95,
          branches: 80,
        },
        'src/db/appDb.ts': {
          lines: 89,
          functions: 90,
          statements: 89,
          branches: 78,
        },
        'src/db/migrations/index.ts': {
          lines: 94,
          functions: 100,
          statements: 94,
          branches: 84,
        },
        'src/services/entryWrittenCoordination.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100,
        },
      },
    },
  },
});
