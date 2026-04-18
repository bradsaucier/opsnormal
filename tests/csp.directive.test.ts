// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EXPECTED_DIRECTIVES,
  extractMetaCsp,
  parseDirectiveRecord,
} from './support/cspDirectiveContract';

const CONTRACT_FILES = [
  'index.html',
  'tests/harness/boot-fallback-harness.html',
  'tests/harness/crash-fallback-harness.html',
] as const;

describe('content security policy directive contract', () => {
  describe.each(CONTRACT_FILES)('%s', (relativePath) => {
    it('pins the exact meta CSP directive set', () => {
      const html = readFileSync(
        new URL(`../${relativePath}`, import.meta.url),
        'utf8',
      );
      const actualDirectives = parseDirectiveRecord(extractMetaCsp(html));

      expect(actualDirectives).toEqual(EXPECTED_DIRECTIVES);
    });
  });
});
