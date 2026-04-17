// Architecture: ADR-0026 fixes the CSP directive contract and the Trusted Types policy surface.

const OPSNORMAL_TRUSTED_TYPES_POLICY_NAME = 'opsnormal-default';

type TrustedHTML = string & {
  readonly __opsNormalTrustedHtmlBrand: unique symbol;
};
type TrustedScriptURL = string & {
  readonly __opsNormalTrustedScriptUrlBrand: unique symbol;
};

interface TrustedTypePolicy {
  createHTML(input: string): TrustedHTML;
  createScriptURL(input: string): TrustedScriptURL;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    options: {
      createHTML: (input: string) => string;
      createScriptURL: (input: string) => string;
    },
  ): TrustedTypePolicy;
}

let opsNormalPolicy: TrustedTypePolicy | null | undefined;

class TrustedTypesUsageError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TrustedTypesUsageError';
  }
}

function getTrustedTypesFactory(): TrustedTypePolicyFactory | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (
    window as Window &
      typeof globalThis & { trustedTypes?: TrustedTypePolicyFactory }
  ).trustedTypes;
}

export function getOpsNormalPolicy(): TrustedTypePolicy | undefined {
  if (opsNormalPolicy !== undefined) {
    return opsNormalPolicy ?? undefined;
  }

  const trustedTypesFactory = getTrustedTypesFactory();

  if (!trustedTypesFactory) {
    opsNormalPolicy = null;
    return undefined;
  }

  try {
    opsNormalPolicy = trustedTypesFactory.createPolicy(
      OPSNORMAL_TRUSTED_TYPES_POLICY_NAME,
      {
        createHTML(input) {
          return input;
        },
        createScriptURL(input) {
          return input;
        },
      },
    );
  } catch {
    opsNormalPolicy = null;
  }

  return opsNormalPolicy ?? undefined;
}

export function trustedHTML(
  input: string,
  reason: string,
): TrustedHTML | string {
  if (typeof input !== 'string') {
    throw new TrustedTypesUsageError(
      'Trusted Types helper expected an HTML string payload.',
    );
  }

  if (reason.trim().length === 0) {
    throw new TrustedTypesUsageError(
      'Trusted Types helper requires a non-empty reason for HTML creation.',
    );
  }

  const policy = getOpsNormalPolicy();

  if (!policy) {
    return input;
  }

  return policy.createHTML(input);
}

export function trustedScriptURL(
  input: string,
  reason: string,
): TrustedScriptURL | string {
  if (typeof input !== 'string') {
    throw new TrustedTypesUsageError(
      'Trusted Types helper expected a script URL string payload.',
    );
  }

  if (reason.trim().length === 0) {
    throw new TrustedTypesUsageError(
      'Trusted Types helper requires a non-empty reason for script URL creation.',
    );
  }

  const policy = getOpsNormalPolicy();

  if (!policy) {
    return input;
  }

  return policy.createScriptURL(input);
}
