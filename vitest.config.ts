import { defineConfig } from 'vitest/config';

const targetedCoverageModules = [
  'src/lib/date.ts',
  'src/lib/export.ts',
  'src/lib/exportSerialization.ts',
  'src/lib/fileDownload.ts',
  'src/lib/runtime.ts',
  'src/hooks/useStorageHealth.ts',
  'src/features/history/useViewportMatch.ts',
  'src/features/pwa/controllerReloadRecovery.ts',
  'src/features/pwa/pwaUpdateCoordination.ts',
  'src/features/pwa/swUpdateRuntime.ts',
];

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.test.ts{,x}',
      'tests/integration/**/*.test.ts{,x}',
    ],
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
      },
    },
  },
});
