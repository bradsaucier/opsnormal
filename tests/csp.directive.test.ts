// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const EXPECTED_DIRECTIVES: Record<string, string> = {
  'default-src': "'none'",
  'script-src': "'self'",
  'style-src': "'self'",
  'img-src': "'self' data:",
  'font-src': "'self'",
  'manifest-src': "'self'",
  'worker-src': "'self'",
  'connect-src': "'self'",
  'base-uri': "'self'",
  'form-action': "'none'",
  'object-src': "'none'",
  'require-trusted-types-for': "'script'",
  'trusted-types': 'opsnormal-default',
};

function extractMetaCsp(html: string): string {
  const match = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );

  if (!match?.[1]) {
    throw new Error(
      'Content Security Policy meta tag not found in index.html.',
    );
  }

  return match[1];
}

function parseDirectiveRecord(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...valueParts] = directive.split(/\s+/);

        if (!name) {
          throw new Error('Encountered an empty CSP directive name.');
        }

        return [name, valueParts.join(' ')];
      }),
  );
}

describe('content security policy directive contract', () => {
  it('pins the exact meta CSP directive set in index.html', () => {
    const html = readFileSync(
      new URL('../index.html', import.meta.url),
      'utf8',
    );
    const actualDirectives = parseDirectiveRecord(extractMetaCsp(html));

    expect(actualDirectives).toEqual(EXPECTED_DIRECTIVES);
  });
});
