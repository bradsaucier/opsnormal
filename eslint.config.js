import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'eslint.config.js', 'playwright.config.js', 'vite.config.js', 'vitest.config.js', 'playwright.config.d.ts', 'vite.config.d.ts', 'vitest.config.d.ts']
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    languageOptions: {
      ...reactHooks.configs.flat.recommended.languageOptions,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json']
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      ...reactHooks.configs.flat.recommended.plugins,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  }
);
