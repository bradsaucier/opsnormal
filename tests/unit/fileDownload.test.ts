import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canUseVerifiedFileSave,
  downloadTextFile,
  saveTextFileWithPicker,
} from '../../src/lib/fileDownload';

describe('file download helpers', () => {
  let createObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrlSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();

    createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:opsnormal-test');
    revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    delete (window as Window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads text content through a temporary anchor and revokes the blob url', () => {
    downloadTextFile(
      'opsnormal-backup.json',
      '{"ok":true}',
      'application/json',
    );

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('a[download="opsnormal-backup.json"]'),
    ).toBeNull();

    vi.runAllTimers();

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:opsnormal-test');
  });

  it('requires a secure context and an available save picker for verified save', () => {
    expect(canUseVerifiedFileSave()).toBe(false);

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn(),
    });
    expect(canUseVerifiedFileSave()).toBe(true);

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });
    expect(canUseVerifiedFileSave()).toBe(false);
  });

  it('fails cleanly when verified save is unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });

    await expect(
      saveTextFileWithPicker('opsnormal-backup.json', '{}', 'application/json'),
    ).rejects.toThrow('Verified file save is unavailable');
  });

  it('writes content through the file picker when the browser exposes it', async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const createWritableSpy = vi.fn().mockResolvedValue({
      write: writeSpy,
      close: closeSpy,
    });
    const showSaveFilePickerSpy = vi.fn().mockResolvedValue({
      createWritable: createWritableSpy,
    });

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: showSaveFilePickerSpy,
    });

    await saveTextFileWithPicker(
      'opsnormal-backup.json',
      '{"mission":"go"}',
      'application/json',
    );

    expect(showSaveFilePickerSpy).toHaveBeenCalledWith({
      suggestedName: 'opsnormal-backup.json',
      excludeAcceptAllOption: false,
      types: [
        {
          description: 'OpsNormal backup',
          accept: {
            'application/json': ['.json'],
          },
        },
      ],
    });
    expect(createWritableSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('treats a dismissed picker as a cancelled backup', async () => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      saveTextFileWithPicker('opsnormal-backup.json', '{}', 'application/json'),
    ).rejects.toThrow('Backup save cancelled');
  });
});
