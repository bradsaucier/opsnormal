import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderBootFailureFallback } from '../../src/lib/bootFallback';

const mocks = vi.hoisted(() => ({
  reloadCurrentPage: vi.fn()
}));

vi.mock('../../src/lib/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/runtime')>();
  return {
    ...actual,
    reloadCurrentPage: mocks.reloadCurrentPage
  };
});

describe('renderBootFailureFallback', () => {
  let rootElement: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"><span>stale</span></div>';
    rootElement = document.getElementById('root') as HTMLDivElement;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the boot failure contract without inline handlers or style attributes', () => {
    renderBootFailureFallback(rootElement);

    expect(rootElement.textContent).toContain('Boot failure');
    expect(rootElement.textContent).toContain('OpsNormal failed to start');
    expect(rootElement.textContent).toContain('Your data may still exist in local storage.');
    expect(rootElement.querySelector('[onclick]')).toBeNull();
    expect(rootElement.querySelector('[style]')).toBeNull();
  });

  it('announces the failure surface to assistive technology', () => {
    renderBootFailureFallback(rootElement);

    const shell = rootElement.querySelector('.ops-boot-fallback-shell');

    if (!(shell instanceof HTMLDivElement)) {
      throw new Error('Boot fallback shell not rendered.');
    }

    expect(shell.getAttribute('role')).toBe('alert');
    expect(shell.hasAttribute('aria-live')).toBe(false);
  });

  it('replaces any stale root content with the recovery surface', () => {
    renderBootFailureFallback(rootElement);

    expect(rootElement.textContent).not.toContain('stale');
    expect(rootElement.querySelector('.ops-boot-fallback-shell')).not.toBeNull();
  });

  it('reloads the page when the recovery action is selected', () => {
    renderBootFailureFallback(rootElement);

    const reloadButton = rootElement.querySelector('button');

    if (!(reloadButton instanceof HTMLButtonElement)) {
      throw new Error('Reload button not rendered.');
    }

    reloadButton.click();

    expect(mocks.reloadCurrentPage).toHaveBeenCalledTimes(1);
  });
});
