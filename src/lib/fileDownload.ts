type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      excludeAcceptAllOption?: boolean;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandleLike | undefined>;
  };

interface FileSystemFileHandleLike {
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile?: () => Promise<File>;
}

// Keep fallback Blob URLs alive on a conservative guard window. Browsers do not expose
// a reliable download-complete signal for anchor-triggered Blob downloads, and
// revoking too early is known to break the handoff in some engines.
const DOWNLOAD_URL_REVOKE_DELAY_MS = 40_000;

export class SaveVerificationUnavailableError extends Error {
  cause: unknown;

  constructor(
    message =
      'Backup save completed, but the browser could not read the saved file back for verification.',
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'SaveVerificationUnavailableError';
    this.cause = options?.cause;
  }
}

export class SaveVerificationMismatchError extends Error {
  constructor(
    message =
      'Backup save verification failed. The saved file did not match the expected backup payload.',
  ) {
    super(message);
    this.name = 'SaveVerificationMismatchError';
  }
}

export function isSaveVerificationUnavailableError(
  error: unknown,
): error is SaveVerificationUnavailableError {
  return error instanceof SaveVerificationUnavailableError;
}

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

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    DOWNLOAD_URL_REVOKE_DELAY_MS,
  );
}

export function canUseVerifiedFileSave(): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return false;
  }

  const pickerWindow = window as SaveFilePickerWindow;
  return typeof pickerWindow.showSaveFilePicker === 'function';
}

async function readSavedFileText(
  fileHandle: FileSystemFileHandleLike,
): Promise<string> {
  if (typeof fileHandle.getFile !== 'function') {
    throw new SaveVerificationUnavailableError(undefined, {
      cause: new Error('File handle did not expose getFile().'),
    });
  }

  try {
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (error) {
    throw new SaveVerificationUnavailableError(undefined, { cause: error });
  }
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

  const savedContent = await readSavedFileText(fileHandle);

  if (savedContent !== content) {
    throw new SaveVerificationMismatchError();
  }
}
