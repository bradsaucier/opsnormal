import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExportModule = typeof import('../../src/lib/export');
type ImportServiceModule = typeof import('../../src/services/importService');

type CanUseVerifiedFileSave = ExportModule['canUseVerifiedFileSave'];
type CheckpointJsonBackupToDisk = ExportModule['checkpointJsonBackupToDisk'];
type DownloadTextFile = ExportModule['downloadTextFile'];
type ExportCurrentEntriesAsJson = ExportModule['exportCurrentEntriesAsJson'];
type ExportCurrentEntriesAsCsv = ExportModule['exportCurrentEntriesAsCsv'];
type RecordExportCompleted = ExportModule['recordExportCompleted'];
type ApplyImport = ImportServiceModule['applyImport'];
type PreviewImportFile = ImportServiceModule['previewImportFile'];

const importServiceMocks = vi.hoisted(() => ({
  applyImport: vi.fn<ApplyImport>(),
  previewImportFile: vi.fn<PreviewImportFile>(),
}));

const exportMocks = vi.hoisted(() => ({
  canUseVerifiedFileSave: vi.fn<CanUseVerifiedFileSave>(() => false),
  checkpointJsonBackupToDisk: vi.fn<CheckpointJsonBackupToDisk>(),
  downloadTextFile: vi.fn<DownloadTextFile>(),
  exportCurrentEntriesAsJson: vi.fn<ExportCurrentEntriesAsJson>(),
  exportCurrentEntriesAsCsv: vi.fn<ExportCurrentEntriesAsCsv>(),
  recordExportCompleted: vi.fn<RecordExportCompleted>(),
}));

vi.mock('../../src/db/appDb', () => ({
  getAllEntries: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../src/services/importService', () => ({
  applyImport: importServiceMocks.applyImport,
  previewImportFile: importServiceMocks.previewImportFile,
}));

vi.mock('../../src/lib/export', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/export')>(
    '../../src/lib/export',
  );

  return {
    ...actual,
    canUseVerifiedFileSave: exportMocks.canUseVerifiedFileSave,
    checkpointJsonBackupToDisk: exportMocks.checkpointJsonBackupToDisk,
    downloadTextFile: exportMocks.downloadTextFile,
    exportCurrentEntriesAsJson: exportMocks.exportCurrentEntriesAsJson,
    exportCurrentEntriesAsCsv: exportMocks.exportCurrentEntriesAsCsv,
    recordExportCompleted: exportMocks.recordExportCompleted,
  };
});

import { ExportPanel } from '../../src/features/export/ExportPanel';
import { type BackupCheckpointResult } from '../../src/lib/export';
import type { ImportPreview, JsonExportPayload } from '../../src/types';

const previewImportFileMock = importServiceMocks.previewImportFile;
const applyImportMock = importServiceMocks.applyImport;
const canUseVerifiedFileSaveMock = exportMocks.canUseVerifiedFileSave;
const exportCurrentEntriesAsJsonMock = exportMocks.exportCurrentEntriesAsJson;
const checkpointJsonBackupToDiskMock = exportMocks.checkpointJsonBackupToDisk;
const downloadTextFileMock = exportMocks.downloadTextFile;
const recordExportCompletedMock = exportMocks.recordExportCompleted;

const EXPORTED_AT = '2026-04-02T21:00:00.000Z';
const FILE_NAME = 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json';

type BackupPreparationFailureCase = {
  name: string;
  expectedText: string;
  result: BackupCheckpointResult | Error;
};

const backupPreparationFailureCases: BackupPreparationFailureCase[] = [
  {
    name: 'save-failed',
    result: {
      kind: 'save-failed',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
      message: 'Disk write failed hard.',
    },
    expectedText: 'Disk write failed hard.',
  },
  {
    name: 'unexpected exception',
    result: new Error('Pre-replace backup exploded.'),
    expectedText: 'Pre-replace backup exploded.',
  },
];

function buildPreview(
  overrides: Partial<JsonExportPayload> = {},
): ImportPreview {
  return {
    payload: {
      app: 'OpsNormal',
      schemaVersion: 1,
      exportedAt: '2026-03-28T12:00:00.000Z',
      entries: [
        {
          date: '2026-03-28',
          sectorId: 'body',
          status: 'nominal',
          updatedAt: '2026-03-28T12:00:00.000Z',
        },
      ],
      ...overrides,
    },
    integrityStatus: overrides.checksum ? 'verified' : 'legacy-unverified',
    existingEntryCount: 3,
    overwriteCount: 0,
    newEntryCount: 1,
    totalEntries: 1,
    dateRange: {
      start: '2026-03-28',
      end: '2026-03-28',
    },
  };
}

function primeReplacePreview() {
  previewImportFileMock.mockResolvedValue(buildPreview());
  exportCurrentEntriesAsJsonMock.mockResolvedValue({
    entryCount: 3,
    exportedAt: EXPORTED_AT,
    payload: '{"app":"OpsNormal"}',
  });
}

async function stageReplacePreview() {
  await userEvent.click(
    screen.getByRole('button', { name: /import and restore/i }),
  );
  await userEvent.upload(
    screen.getByTestId('import-file-input'),
    new File(['{}'], 'replace-export.json', { type: 'application/json' }),
  );
  await userEvent.click(screen.getByRole('radio', { name: /replace/i }));
}

async function triggerPreReplaceBackup() {
  await userEvent.click(
    screen.getByRole('button', { name: /export pre-replace backup/i }),
  );
}

describe('ExportPanel import warnings', () => {
  beforeEach(() => {
    previewImportFileMock.mockReset();
    applyImportMock.mockReset();
    canUseVerifiedFileSaveMock.mockReset();
    exportCurrentEntriesAsJsonMock.mockReset();
    checkpointJsonBackupToDiskMock.mockReset();
    downloadTextFileMock.mockReset();
    recordExportCompletedMock.mockReset();
    canUseVerifiedFileSaveMock.mockReturnValue(false);
  });

  it('mounts stable live regions on initial render', () => {
    render(<ExportPanel storageHealth={null} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-atomic', 'true');
  });

  it('surfaces operator summary signals before the accordion detail', () => {
    render(<ExportPanel storageHealth={null} />);

    const dataBoundary = screen.getByText('Data boundary');
    const exportAccordionButton = screen.getByRole('button', {
      name: /export and backup/i,
    });

    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.getByText('Export first')).toBeInTheDocument();
    expect(screen.getByText('Locked until checkpoint')).toBeInTheDocument();
    expect(screen.getByText('Undo not staged')).toBeInTheDocument();
    expect(
      dataBoundary.compareDocumentPosition(exportAccordionButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('notifies the shell when a JSON backup completes', async () => {
    const onBackupCompleted = vi.fn();
    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: EXPORTED_AT,
      payload: '{"app":"OpsNormal"}',
    });

    render(
      <ExportPanel
        storageHealth={null}
        onBackupCompleted={onBackupCompleted}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /export json/i }));

    await waitFor(() =>
      expect(onBackupCompleted).toHaveBeenCalledWith(EXPORTED_AT),
    );
  });

  it('notifies the shell when the pre-replace checkpoint backup completes', async () => {
    const onBackupCompleted = vi.fn();
    primeReplacePreview();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
    });

    render(
      <ExportPanel
        storageHealth={null}
        onBackupCompleted={onBackupCompleted}
      />,
    );

    await stageReplacePreview();
    await triggerPreReplaceBackup();

    await waitFor(() =>
      expect(onBackupCompleted).toHaveBeenCalledWith(EXPORTED_AT),
    );
  });

  it('preserves accordion button and region bindings for backup sections', async () => {
    render(<ExportPanel storageHealth={null} />);

    const exportAccordionButton = screen.getByRole('button', {
      name: /export and backup/i,
    });
    const importAccordionButton = screen.getByRole('button', {
      name: /import and restore/i,
    });

    expect(exportAccordionButton).toHaveAttribute('aria-expanded', 'true');
    expect(importAccordionButton).toHaveAttribute('aria-expanded', 'false');

    const exportPanel = document.getElementById(
      exportAccordionButton.getAttribute('aria-controls') ?? '',
    );
    const importPanel = document.getElementById(
      importAccordionButton.getAttribute('aria-controls') ?? '',
    );

    expect(exportPanel).toHaveAttribute('role', 'region');
    expect(exportPanel).toHaveAttribute(
      'aria-labelledby',
      exportAccordionButton.id,
    );
    expect(importPanel).toHaveAttribute('role', 'region');
    expect(importPanel).toHaveAttribute(
      'aria-labelledby',
      importAccordionButton.id,
    );

    await userEvent.click(importAccordionButton);

    expect(importAccordionButton).toHaveAttribute('aria-expanded', 'true');
    expect(importPanel).not.toHaveAttribute('hidden');
  });

  it('flags legacy imports as unverified before confirm', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview());

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    const input = screen.getByTestId('import-file-input');
    const file = new File(['{}'], 'legacy-export.json', {
      type: 'application/json',
    });
    await userEvent.upload(input, file);

    expect(
      await screen.findByRole('heading', { name: 'Import preview' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/legacy backup detected/i)).toBeInTheDocument();
  });

  it('shows verified status text when checksum validation is present', async () => {
    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    const input = screen.getByTestId('import-file-input');
    const file = new File(['{}'], 'verified-export.json', {
      type: 'application/json',
    });
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(
        screen.getByText(
          /integrity verified\. embedded sha-256 checksum matched/i,
        ),
      ).toBeInTheDocument(),
    );
  });

  it('requires a backup checkpoint before destructive replace import runs', async () => {
    primeReplacePreview();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
    });
    applyImportMock.mockResolvedValue({
      importedCount: 1,
      undo: vi.fn(() => Promise.resolve()),
    });

    render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();

    const armButton = screen.getByRole('button', {
      name: /arm replace all data/i,
    });
    expect(armButton).toBeDisabled();

    await triggerPreReplaceBackup();

    expect(exportCurrentEntriesAsJsonMock).toHaveBeenCalledTimes(1);
    expect(checkpointJsonBackupToDiskMock).toHaveBeenCalledTimes(1);
    expect(recordExportCompletedMock).toHaveBeenCalledWith(EXPORTED_AT);

    const unlockButton = screen.getByRole('button', {
      name: /unlock replace after manual backup check/i,
    });
    expect(unlockButton).toBeDisabled();
    expect(armButton).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /i confirm the backup file was successfully saved to my device before importing this restore/i,
      }),
    );

    expect(unlockButton).toBeEnabled();
    expect(armButton).toBeDisabled();

    await userEvent.click(unlockButton);
    expect(armButton).toBeEnabled();

    await userEvent.click(armButton);

    expect(applyImportMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/replace armed\./i)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /execute replace all 3 rows/i }),
    );

    await waitFor(() => expect(applyImportMock).toHaveBeenCalledTimes(1));
  });

  it('forces the replace checkpoint to reset if the operator leaves and re-enters replace mode', async () => {
    primeReplacePreview();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
    });

    render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();
    await triggerPreReplaceBackup();
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /i confirm the backup file was successfully saved to my device before importing this restore/i,
      }),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: /unlock replace after manual backup check/i,
      }),
    );

    expect(
      screen.getByRole('button', { name: /arm replace all data/i }),
    ).toBeEnabled();

    await userEvent.click(screen.getByRole('radio', { name: /merge/i }));
    await userEvent.click(screen.getByRole('radio', { name: /replace/i }));

    expect(
      screen.getByRole('button', { name: /arm replace all data/i }),
    ).toBeDisabled();
  });

  it('keeps replace locked and surfaces a warning when the operator cancels backup save', async () => {
    primeReplacePreview();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'save-cancelled',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
      message: 'Backup save cancelled. Local data unchanged.',
    });

    const { container } = render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();
    await triggerPreReplaceBackup();

    expect(within(container).getByRole('alert')).toHaveTextContent(
      'Backup save cancelled. Local data unchanged.',
    );
    expect(
      screen.getByRole('button', { name: /arm replace all data/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('checkbox', {
        name: /i confirm the backup file was successfully saved to my device before importing this restore/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/backup ready -/i)).not.toBeInTheDocument();
    expect(recordExportCompletedMock).not.toHaveBeenCalled();
  });

  it.each(backupPreparationFailureCases)(
    'keeps replace locked and surfaces an error when backup preparation hits $name',
    async ({ expectedText, result }) => {
      primeReplacePreview();

      if (result instanceof Error) {
        checkpointJsonBackupToDiskMock.mockRejectedValue(result);
      } else {
        checkpointJsonBackupToDiskMock.mockResolvedValue(result);
      }

      const { container } = render(<ExportPanel storageHealth={null} />);

      await stageReplacePreview();
      await triggerPreReplaceBackup();

      expect(within(container).getByRole('alert')).toHaveTextContent(
        expectedText,
      );
      expect(
        screen.getByRole('button', { name: /arm replace all data/i }),
      ).toBeDisabled();
      expect(screen.queryByText(/backup ready -/i)).not.toBeInTheDocument();
      expect(recordExportCompletedMock).not.toHaveBeenCalled();
    },
  );

  it('keeps replace locked and surfaces an error when data snapshot generation fails', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview());
    exportCurrentEntriesAsJsonMock.mockRejectedValue(
      new Error('Database read failure during snapshot.'),
    );

    const { container } = render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();
    await triggerPreReplaceBackup();

    expect(within(container).getByRole('alert')).toHaveTextContent(
      'Database read failure during snapshot.',
    );
    expect(
      screen.getByRole('button', { name: /arm replace all data/i }),
    ).toBeDisabled();
    expect(recordExportCompletedMock).not.toHaveBeenCalled();
    expect(checkpointJsonBackupToDiskMock).not.toHaveBeenCalled();
  });

  it('uses verified file save when the browser exposes a save picker', async () => {
    primeReplacePreview();
    canUseVerifiedFileSaveMock.mockReturnValue(true);
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
    });

    render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();
    await userEvent.click(
      screen.getByRole('button', {
        name: /write verified pre-replace backup/i,
      }),
    );

    await waitFor(() =>
      expect(checkpointJsonBackupToDiskMock).toHaveBeenCalledTimes(1),
    );
    expect(
      screen.getByRole('button', { name: /arm replace all data/i }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', {
        name: /unlock replace after manual backup check/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/disk write verified before replace unlock\./i),
    ).toBeInTheDocument();
  });
});
