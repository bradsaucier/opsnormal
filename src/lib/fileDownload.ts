type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      excludeAcceptAllOption?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob | string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function canUseVerifiedFileSave(): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return false;
  }

  const pickerWindow = window as SaveFilePickerWindow;
  return typeof pickerWindow.showSaveFilePicker === 'function';
}

export async function saveTextFileWithPicker(
  fileName: string,
  content: string,
  mimeType: string,
): Promise<void> {
  if (!canUseVerifiedFileSave()) {
    throw new Error(
      'Verified file save is unavailable in this browser context. Use the manual backup checkpoint instead.',
    );
  }

  const pickerWindow = window as SaveFilePickerWindow;
  const fileHandle = await pickerWindow.showSaveFilePicker?.({
    suggestedName: fileName,
    excludeAcceptAllOption: false,
    types: [
      {
        description: 'OpsNormal backup',
        accept: {
          [mimeType]: ['.json'],
        },
      },
    ],
  });

  if (!fileHandle) {
    throw new Error('Backup save cancelled. Local data unchanged.');
  }

  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([content], { type: mimeType }));
  await writable.close();
}
