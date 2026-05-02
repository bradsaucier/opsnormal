import { afterEach, describe, expect, it, vi } from 'vitest';

type PolicyCallbacks = {
  createHTML(input: string): string;
  createScriptURL(input: string): string;
};

type TrustedPolicy = {
  createHTML: (input: string) => string;
  createScriptURL: (input: string) => string;
};

type PolicyFactory = {
  createPolicy: (name: string, options: PolicyCallbacks) => TrustedPolicy;
};

async function loadFresh() {
  vi.resetModules();
  return import('../../src/lib/trustedTypes');
}

function installFactory(factory: PolicyFactory | undefined): void {
  (
    window as Window & typeof globalThis & { trustedTypes?: PolicyFactory }
  ).trustedTypes = factory;
}

function createPolicy(): TrustedPolicy {
  return {
    createHTML: vi.fn((input: string) => `trusted-html:${input}`),
    createScriptURL: vi.fn((input: string) => `trusted-script-url:${input}`),
  };
}

function expectTrustedTypesUsageError(error: unknown): void {
  expect(error).toBeInstanceOf(TypeError);
  expect(error).toMatchObject({ name: 'TrustedTypesUsageError' });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (
    window as Window & typeof globalThis & { trustedTypes?: PolicyFactory }
  ).trustedTypes;
  vi.restoreAllMocks();
});

describe('Trusted Types helpers', () => {
  it('returns undefined and caches a negative result when the Trusted Types factory is unavailable', async () => {
    vi.stubGlobal('window', undefined);

    const browserlessModule = await loadFresh();

    expect(browserlessModule.getOpsNormalPolicy()).toBeUndefined();
    vi.unstubAllGlobals();

    const trustedTypesGetter = vi.fn(() => undefined);
    Object.defineProperty(window, 'trustedTypes', {
      configurable: true,
      get: trustedTypesGetter,
    });

    const { getOpsNormalPolicy } = await loadFresh();

    expect(getOpsNormalPolicy()).toBeUndefined();
    expect(getOpsNormalPolicy()).toBeUndefined();
    expect(trustedTypesGetter).toHaveBeenCalledTimes(1);
  });

  it('creates the OpsNormal policy once and returns the cached policy afterward', async () => {
    const policy = createPolicy();
    const createPolicySpy = vi.fn(
      (name: string, callbacks: PolicyCallbacks): TrustedPolicy => {
        void name;
        void callbacks;
        return policy;
      },
    );
    installFactory({ createPolicy: createPolicySpy });

    const { getOpsNormalPolicy } = await loadFresh();

    expect(getOpsNormalPolicy()).toBe(policy);
    expect(getOpsNormalPolicy()).toBe(policy);
    expect(createPolicySpy).toHaveBeenCalledTimes(1);
  });

  it('registers identity callbacks for trusted HTML and script URLs', async () => {
    const policy = createPolicy();
    let callbacks: PolicyCallbacks | undefined;
    const createPolicySpy = vi.fn(
      (_name: string, policyCallbacks: PolicyCallbacks): TrustedPolicy => {
        callbacks = policyCallbacks;
        return policy;
      },
    );
    installFactory({ createPolicy: createPolicySpy });

    const { getOpsNormalPolicy } = await loadFresh();

    expect(getOpsNormalPolicy()).toBe(policy);
    if (!callbacks) {
      throw new Error('Trusted Types policy callbacks were not registered.');
    }
    expect(callbacks.createHTML('<strong>ops</strong>')).toBe(
      '<strong>ops</strong>',
    );
    expect(callbacks.createScriptURL('/sw.js')).toBe('/sw.js');
  });

  it('swallows policy creation failures and caches the negative result', async () => {
    const createPolicySpy = vi.fn(
      (name: string, callbacks: PolicyCallbacks): TrustedPolicy => {
        void name;
        void callbacks;
        throw new Error('duplicate policy name');
      },
    );
    installFactory({ createPolicy: createPolicySpy });

    const { getOpsNormalPolicy } = await loadFresh();

    expect(getOpsNormalPolicy()).toBeUndefined();
    expect(getOpsNormalPolicy()).toBeUndefined();
    expect(createPolicySpy).toHaveBeenCalledTimes(1);
  });

  it('routes trustedHTML through the policy when available and falls back to the input string otherwise', async () => {
    const policy = createPolicy();
    installFactory({ createPolicy: vi.fn(() => policy) });

    const policyModule = await loadFresh();

    expect(
      policyModule.trustedHTML('<p>go</p>', 'render operator markup'),
    ).toBe('trusted-html:<p>go</p>');
    expect(policy.createHTML).toHaveBeenCalledWith('<p>go</p>');

    installFactory(undefined);
    const fallbackModule = await loadFresh();

    expect(
      fallbackModule.trustedHTML('<p>go</p>', 'render operator markup'),
    ).toBe('<p>go</p>');
  });

  it('routes trustedScriptURL through the policy when available and falls back to the input string otherwise', async () => {
    const policy = createPolicy();
    installFactory({ createPolicy: vi.fn(() => policy) });

    const policyModule = await loadFresh();

    expect(
      policyModule.trustedScriptURL('/sw.js', 'register service worker'),
    ).toBe('trusted-script-url:/sw.js');
    expect(policy.createScriptURL).toHaveBeenCalledWith('/sw.js');

    installFactory(undefined);
    const fallbackModule = await loadFresh();

    expect(
      fallbackModule.trustedScriptURL('/sw.js', 'register service worker'),
    ).toBe('/sw.js');
  });

  it('rejects non-string payloads with TrustedTypesUsageError', async () => {
    const { trustedHTML, trustedScriptURL } = await loadFresh();

    expect(() =>
      trustedHTML(42 as unknown as string, 'render operator markup'),
    ).toThrow(TypeError);
    try {
      trustedHTML(42 as unknown as string, 'render operator markup');
    } catch (error) {
      expectTrustedTypesUsageError(error);
    }

    expect(() =>
      trustedScriptURL(42 as unknown as string, 'register service worker'),
    ).toThrow(TypeError);
    try {
      trustedScriptURL(42 as unknown as string, 'register service worker');
    } catch (error) {
      expectTrustedTypesUsageError(error);
    }
  });

  it('requires non-empty reasons for trusted HTML and script URL creation', async () => {
    const { trustedHTML, trustedScriptURL } = await loadFresh();

    for (const reason of ['', '   ']) {
      try {
        trustedHTML('<p>go</p>', reason);
      } catch (error) {
        expectTrustedTypesUsageError(error);
      }

      try {
        trustedScriptURL('/sw.js', reason);
      } catch (error) {
        expectTrustedTypesUsageError(error);
      }
    }
  });

  it('pins the policy name to the CSP trusted-types directive', async () => {
    const policy = createPolicy();
    const createPolicySpy = vi.fn(
      (name: string, callbacks: PolicyCallbacks): TrustedPolicy => {
        void name;
        void callbacks;
        return policy;
      },
    );
    installFactory({ createPolicy: createPolicySpy });

    const { getOpsNormalPolicy } = await loadFresh();

    expect(getOpsNormalPolicy()).toBe(policy);
    expect(createPolicySpy).toHaveBeenCalledWith(
      'opsnormal-default',
      expect.any(Object),
    );
  });
});
