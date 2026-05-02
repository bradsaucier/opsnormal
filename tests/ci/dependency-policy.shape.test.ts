// @vitest-environment node

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type PackageJson = {
  devDependencies?: Record<string, string>;
};

type PackageLockPackage = {
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version?: string;
};

type PackageLock = {
  packages?: Record<string, PackageLockPackage>;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

function expectHooksSpec(value: unknown, label: string): string {
  expect(typeof value, label).toBe('string');

  const spec = value as string;

  expect(
    spec.toLowerCase(),
    `${label} must not use a canary build.`,
  ).not.toContain('canary');

  return spec;
}

describe('React Hooks lint dependency policy', () => {
  const packageJson = readJson<PackageJson>('../../package.json');
  const packageLock = readJson<PackageLock>('../../package-lock.json');

  it('keeps eslint-plugin-react-hooks on the validated stable release line', () => {
    const packageSpec = expectHooksSpec(
      packageJson.devDependencies?.['eslint-plugin-react-hooks'],
      'package.json eslint-plugin-react-hooks',
    );
    const lockRootSpec = expectHooksSpec(
      packageLock.packages?.['']?.devDependencies?.[
        'eslint-plugin-react-hooks'
      ],
      'package-lock root eslint-plugin-react-hooks',
    );
    const lockedPackage =
      packageLock.packages?.['node_modules/eslint-plugin-react-hooks'];
    const lockedVersion = expectHooksSpec(
      lockedPackage?.version,
      'package-lock installed eslint-plugin-react-hooks',
    );

    expect(packageSpec).toBe('^7.1.1');
    expect(lockRootSpec).toBe('^7.1.1');
    expect(lockedVersion).toBe('7.1.1');
    expect(lockedPackage?.peerDependencies?.eslint).toContain('^10.0.0');
  });
});
