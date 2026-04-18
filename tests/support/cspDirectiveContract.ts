export const EXPECTED_DIRECTIVES: Record<string, string> = {
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

export function extractMetaCsp(html: string): string {
  const match = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );

  if (!match?.[1]) {
    throw new Error('Content Security Policy meta tag not found.');
  }

  return match[1];
}

export function parseDirectiveRecord(policy: string): Record<string, string> {
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
