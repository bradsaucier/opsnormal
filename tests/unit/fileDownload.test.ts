import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canUseVerifiedFileSave,
  downloadTextFile,
  SaveVerificationMismatchError,
  SaveVerificationUnavailableError,
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

  it('downloads text content through a temporary anchor and revokes the blob url after a conservative guard delay', () => {
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

    vi.advanceTimersByTime(39_999);
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
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

  it('writes content through the file picker and reads the saved file back before reporting success', async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const createWritableSpy = vi.fn().mockResolvedValue({
      write: writeSpy,
      close: closeSpy,
    });
    const getFileSpy = vi.fn().mockResolvedValue(
      new File(['{"mission":"go"}'], 'opsnormal-backup.json', {
        type: 'application/json',
      }),
    );
    const showSaveFilePickerSpy = vi.fn().mockResolvedValue({
      createWritable: createWritableSpy,
      getFile: getFileSpy,
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
    expect(getFileSpy).toHaveBeenCalledTimes(1);
  });

  it('fails when the saved file content does not match the expected payload', async () => {
    const showSaveFilePickerSpy = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      getFile: vi.fn().mockResolvedValue(
        new File(['{"mission":"hold"}'], 'opsnormal-backup.json', {
          type: 'application/json',
        }),
      ),
    });

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: showSaveFilePickerSpy,
    });

    await expect(
      saveTextFileWithPicker(
        'opsnormal-backup.json',
        '{"mission":"go"}',
        'application/json',
      ),
    ).rejects.toBeInstanceOf(SaveVerificationMismatchError);
  });

  it('falls back to manual verification when the browser cannot read the saved file back', async () => {
    const showSaveFilePickerSpy = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: showSaveFilePickerSpy,
    });

    await expect(
      saveTextFileWithPicker(
        'opsnormal-backup.json',
        '{"mission":"go"}',
        'application/json',
      ),
    ).rejects.toBeInstanceOf(SaveVerificationUnavailableError);
  });

  it('preserves the underlying getFile failure as the cause when browser read-back permission drops', async () => {
    const permissionError = new DOMException(
      'Read permission revoked.',
      'NotAllowedError',
    );
    const showSaveFilePickerSpy = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      getFile: vi.fn().mockRejectedValue(permissionError),
    });

    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: showSaveFilePickerSpy,
    });

    await expect(
      saveTextFileWithPicker(
        'opsnormal-backup.json',
        '{"mission":"go"}',
        'application/json',
      ),
    ).rejects.toMatchObject({
      name: 'SaveVerificationUnavailableError',
      cause: permissionError,
    });
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
