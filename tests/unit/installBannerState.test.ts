import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearInstallBannerDismissal,
  hasDismissedInstallBanner,
  recordInstallBannerDismissal
} from '../../src/features/install/installBannerState';

function createStorageAccessError(name: string): DOMException {
  return new DOMException(`${name} while accessing localStorage`, name);
}

describe('installBannerState', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('records and reads dismissal state when localStorage is available', () => {
    expect(hasDismissedInstallBanner()).toBe(false);

    recordInstallBannerDismissal();

    expect(hasDismissedInstallBanner()).toBe(true);
  });

  it('swallows QuotaExceededError when recording dismissal state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw createStorageAccessError('QuotaExceededError');
    });

    expect(() => recordInstallBannerDismissal()).not.toThrow();
    expect(hasDismissedInstallBanner()).toBe(false);
  });

  it('swallows SecurityError when recording dismissal state', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw createStorageAccessError('SecurityError');
    });

    expect(() => recordInstallBannerDismissal()).not.toThrow();
    expect(hasDismissedInstallBanner()).toBe(false);
  });

  it('returns false when reading dismissal state throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw createStorageAccessError('SecurityError');
    });

    expect(hasDismissedInstallBanner()).toBe(false);
  });

  it('swallows removal errors when clearing dismissal state', () => {
    window.localStorage.setItem('opsnormal-install-banner-dismissed', 'true');

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw createStorageAccessError('SecurityError');
    });

    expect(() => clearInstallBannerDismissal()).not.toThrow();
  });
});
