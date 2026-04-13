const INSTALL_BANNER_DISMISSED_KEY = 'opsnormal-install-banner-dismissed';

function readLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage access failures.
  }
}

function removeLocalStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage access failures.
  }
}

export function hasDismissedInstallBanner(): boolean {
  return readLocalStorageItem(INSTALL_BANNER_DISMISSED_KEY) === 'true';
}

export function recordInstallBannerDismissal(): void {
  writeLocalStorageItem(INSTALL_BANNER_DISMISSED_KEY, 'true');
}

export function clearInstallBannerDismissal(): void {
  removeLocalStorageItem(INSTALL_BANNER_DISMISSED_KEY);
}
