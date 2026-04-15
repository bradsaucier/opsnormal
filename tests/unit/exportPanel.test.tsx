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
import type {
  ImportPreview,
  JsonExportPayload,
  SuccessfulImportPreview,
} from '../../src/types';

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
): SuccessfulImportPreview {
  return {
    kind: overrides.checksum ? 'good' : 'legacy-unverified',
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
    exportedAt: '2026-03-28T12:00:00.000Z',
    ageMs: 0,
    dateRange: {
      start: '2026-03-28',
      end: '2026-03-28',
    },
  };
}

function buildRejectedPreview(kind: ImportPreview['kind']): ImportPreview {
  switch (kind) {
    case 'checksum-failed':
      return { kind };
    case 'incompatible':
      return {
        kind,
        reason: 'schema-version',
        detectedAppName: 'OpsNormal',
        detectedSchemaVersion: 2,
      };
    case 'oversize':
      return { kind, maxBytes: 5 * 1024 * 1024 };
    case 'blocked-key':
      return { kind, blockedKey: '__proto__' };
    case 'invalid':
      return {
        kind,
        issuePath: 'entries.0.sectorId',
        issueMessage: 'Invalid sector.',
      };
    case 'unreadable':
      return { kind };
    case 'good':
    case 'stale':
    case 'legacy-unverified':
      return buildPreview({ checksum: 'a'.repeat(64) });
  }
}

function primeReplacePreview() {
  previewImportFileMock.mockResolvedValue(
    buildPreview({ checksum: 'a'.repeat(64) }),
  );
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

  it('keeps backup summary signal chrome off readiness-background accents', () => {
    render(<ExportPanel storageHealth={null} />);

    const summarySignals = screen.getByRole('list', {
      name: /backup and recovery summary signals/i,
    });
    const signalMarkup = summarySignals.innerHTML;

    expect(signalMarkup).toContain('bg-ops-panel-border-strong');
    expect(signalMarkup).not.toContain('rgba(110,231,183');
    expect(signalMarkup).not.toContain('rgba(16,185,129');
    expect(signalMarkup).not.toContain('rgba(251,191,36,0.32)');
    expect(signalMarkup).not.toContain('rgba(245,158,11,0.16)');
    expect(signalMarkup).not.toContain('text-emerald-');
  });

  it('keeps selected restore mode cards on structural chrome instead of readiness backgrounds', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview({ checksum: 'a'.repeat(64) }));

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    await userEvent.upload(
      screen.getByTestId('import-file-input'),
      new File(['{}'], 'verified-export.json', {
        type: 'application/json',
      }),
    );

    const mergeOption = screen.getByText('Merge').closest('label');
    expect(mergeOption?.className).not.toContain('emerald');
    expect(mergeOption?.className).not.toContain('rgba(16,185,129');

    await userEvent.click(screen.getByRole('radio', { name: /replace/i }));

    const replaceOption = screen.getByText('Replace').closest('label');
    expect(replaceOption?.className).not.toContain('rgba(245,158,11,0.16)');
    expect(replaceOption?.className).not.toContain('text-amber-50');
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

  it('flags legacy imports as unverified and keeps confirm locked until acknowledged', async () => {
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
    expect(
      screen.getByText(/legacy backup\. structure validated/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm merge import/i }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /i understand this backup has no checksum/i,
      }),
    );

    expect(
      screen.getByRole('button', { name: /confirm merge import/i }),
    ).toBeEnabled();
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

  it('locks stale backups until the operator acknowledges the staged file risk', async () => {
    previewImportFileMock.mockResolvedValue({
      ...buildPreview({ checksum: 'a'.repeat(64) }),
      kind: 'stale',
      ageMs: 7 * 24 * 60 * 60 * 1000,
    });

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    await userEvent.upload(
      screen.getByTestId('import-file-input'),
      new File(['{}'], 'stale-export.json', {
        type: 'application/json',
      }),
    );

    expect(
      screen.getByText(/backup file is older than the freshness buffer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm merge import/i }),
    ).toBeDisabled();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /i reviewed the export time and date range/i,
      }),
    );

    expect(
      screen.getByRole('button', { name: /confirm merge import/i }),
    ).toBeEnabled();
  });

  it('clears the stale-file acknowledgment when the operator switches from merge to replace', async () => {
    previewImportFileMock.mockResolvedValue({
      ...buildPreview({ checksum: 'a'.repeat(64) }),
      kind: 'stale',
      ageMs: 7 * 24 * 60 * 60 * 1000,
    });

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    await userEvent.upload(
      screen.getByTestId('import-file-input'),
      new File(['{}'], 'stale-export.json', {
        type: 'application/json',
      }),
    );

    const acknowledgment = screen.getByRole('checkbox', {
      name: /i reviewed the export time and date range/i,
    });

    await userEvent.click(acknowledgment);

    expect(acknowledgment).toBeChecked();
    expect(
      screen.getByRole('button', { name: /confirm merge import/i }),
    ).toBeEnabled();

    await userEvent.click(screen.getByRole('radio', { name: /replace/i }));

    expect(acknowledgment).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: /export pre-replace backup/i }),
    ).toBeDisabled();
  });

  it('renders incompatible backups in read-only preview mode', async () => {
    previewImportFileMock.mockResolvedValue(
      buildRejectedPreview('incompatible'),
    );

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    await userEvent.upload(
      screen.getByTestId('import-file-input'),
      new File(['{}'], 'future-schema.json', {
        type: 'application/json',
      }),
    );

    expect(
      screen.getByText(/this backup declares schema version 2/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /merge/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirm merge import/i }),
    ).not.toBeInTheDocument();
  });

  it('renders checksum-failed backups in read-only preview mode', async () => {
    previewImportFileMock.mockResolvedValue(
      buildRejectedPreview('checksum-failed'),
    );

    render(<ExportPanel storageHealth={null} />);

    await userEvent.click(
      screen.getByRole('button', { name: /import and restore/i }),
    );

    await userEvent.upload(
      screen.getByTestId('import-file-input'),
      new File(['{}'], 'checksum-failed.json', {
        type: 'application/json',
      }),
    );

    expect(
      screen.getByText(/embedded sha-256 checksum did not match/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirm merge import/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /clear preview/i }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(
        /backup download triggered\. verify the saved file exists on local disk, then acknowledge before replace unlocks\./i,
      ),
    ).toBeInTheDocument();

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
    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );
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

  it('surfaces distinct operator guidance when picker save completes without browser read-back proof', async () => {
    primeReplacePreview();
    canUseVerifiedFileSaveMock.mockReturnValue(true);
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'manual-verification-required',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT,
      message:
        'Backup save completed, but the browser could not read the saved file back for verification. Confirm the file on local disk before replace unlocks.',
    });

    render(<ExportPanel storageHealth={null} />);

    await stageReplacePreview();
    await userEvent.click(
      screen.getByRole('button', {
        name: /write and verify pre-replace backup/i,
      }),
    );

    expect(
      await screen.findByText(
        /browser read-back proof unavailable\. verify the saved file exists on local disk, then acknowledge before replace unlocks\./i,
      ),
    ).toBeInTheDocument();
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
        name: /write and verify pre-replace backup/i,
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
      screen.getByText(/step 2 - browser read-back proof complete\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /disk write read-back verified before replace unlock\./i,
      ),
    ).toBeInTheDocument();
  });
});
