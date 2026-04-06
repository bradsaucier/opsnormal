import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExportModule = typeof import('../../src/lib/export');
type CheckpointJsonBackupToDisk = ExportModule['checkpointJsonBackupToDisk'];
type ExportCurrentEntriesAsJson = ExportModule['exportCurrentEntriesAsJson'];

const exportMocks = vi.hoisted(() => ({
  canUseVerifiedFileSave: vi.fn<() => boolean>(() => false),
  checkpointJsonBackupToDisk: vi.fn<CheckpointJsonBackupToDisk>(),
  exportCurrentEntriesAsJson: vi.fn<ExportCurrentEntriesAsJson>()
}));

vi.mock('../../src/lib/export', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/export')>('../../src/lib/export');

  return {
    ...actual,
    canUseVerifiedFileSave: exportMocks.canUseVerifiedFileSave,
    checkpointJsonBackupToDisk: exportMocks.checkpointJsonBackupToDisk,
    exportCurrentEntriesAsJson: exportMocks.exportCurrentEntriesAsJson
  };
});

import { type BackupCheckpointResult } from '../../src/lib/export';
import { useReplaceCheckpoint } from '../../src/features/export/useReplaceCheckpoint';
import type { StatusMessage } from '../../src/features/export/workflowTypes';
import type { ImportPreview, JsonExportPayload } from '../../src/types';

const exportCurrentEntriesAsJsonMock = exportMocks.exportCurrentEntriesAsJson;
const checkpointJsonBackupToDiskMock = exportMocks.checkpointJsonBackupToDisk;

const EXPORTED_AT = '2026-04-02T21:00:00.000Z';
const FILE_NAME = 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json';

function buildPreview(overrides: Partial<JsonExportPayload> = {}): ImportPreview {
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
          updatedAt: '2026-03-28T12:00:00.000Z'
        }
      ],
      ...overrides
    },
    integrityStatus: overrides.checksum ? 'verified' : 'legacy-unverified',
    existingEntryCount: 3,
    overwriteCount: 0,
    newEntryCount: 1,
    totalEntries: 1,
    dateRange: {
      start: '2026-03-28',
      end: '2026-03-28'
    }
  };
}

function primeExportSnapshot() {
  exportCurrentEntriesAsJsonMock.mockResolvedValue({
    entryCount: 3,
    exportedAt: EXPORTED_AT,
    payload: '{"app":"OpsNormal"}'
  });
}

type OnBackupCompleted = (exportedAt: string) => void;
type OnStatusMessage = (message: StatusMessage) => void;

function renderSubject(args: {
  onBackupCompleted?: OnBackupCompleted;
  onStatusMessage?: OnStatusMessage;
}) {
  const onBackupCompleted = args.onBackupCompleted ?? vi.fn<OnBackupCompleted>();
  const onStatusMessage = args.onStatusMessage ?? vi.fn<OnStatusMessage>();

  const hook = renderHook(() =>
    useReplaceCheckpoint({
      onBackupCompleted,
      onStatusMessage,
      pendingImport: buildPreview()
    })
  );

  return {
    ...hook,
    onBackupCompleted,
    onStatusMessage
  };
}

describe('useReplaceCheckpoint', () => {
  beforeEach(() => {
    exportCurrentEntriesAsJsonMock.mockReset();
    checkpointJsonBackupToDiskMock.mockReset();
  });

  it('enters a verified ready state when the browser confirms the pre-replace save', async () => {
    primeExportSnapshot();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT
    });

    const { result, onBackupCompleted, onStatusMessage } = renderSubject({});

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    expect(result.current.replaceBackupState).toEqual({
      phase: 'ready',
      fileName: FILE_NAME,
      verification: 'verified'
    });
    expect(result.current.replaceReady).toBe(true);
    expect(onBackupCompleted).toHaveBeenCalledWith(EXPORTED_AT);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: `Verified pre-replace backup saved as ${FILE_NAME}. 3 current rows secured before restore.`
    });
  });

  it('requires explicit manual acknowledgment after fallback download trigger before unlock', async () => {
    primeExportSnapshot();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT
    });

    const { result, onBackupCompleted, onStatusMessage } = renderSubject({});

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    expect(result.current.replaceBackupState).toEqual({
      phase: 'manual-awaiting-ack',
      fileName: FILE_NAME
    });
    expect(result.current.replaceReady).toBe(false);
    expect(onBackupCompleted).toHaveBeenCalledWith(EXPORTED_AT);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text: `Backup download triggered for ${FILE_NAME}. Verify the file exists on local disk, then acknowledge before replace unlocks.`
    });

    act(() => {
      result.current.handleAcknowledgeManualBackup();
    });

    expect(result.current.replaceBackupState).toEqual({
      phase: 'manual-awaiting-ack',
      fileName: FILE_NAME
    });
    expect(result.current.replaceReady).toBe(false);

    act(() => {
      result.current.setManualBackupConfirmed(true);
    });

    act(() => {
      result.current.handleAcknowledgeManualBackup();
    });

    expect(result.current.manualBackupConfirmed).toBe(false);
    expect(result.current.replaceBackupState).toEqual({
      phase: 'ready',
      fileName: FILE_NAME,
      verification: 'manual'
    });
    expect(result.current.replaceReady).toBe(true);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text:
        'Manual backup checkpoint acknowledged for opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json. Replace is unlocked, but the browser did not verify the disk write.'
    });
  });

  it.each([
    {
      name: 'save-cancelled',
      result: {
        kind: 'save-cancelled',
        fileName: FILE_NAME,
        exportedAt: EXPORTED_AT,
        message: 'Backup save cancelled. Local data unchanged.'
      } satisfies BackupCheckpointResult,
      expectedTone: 'warning' as const,
      expectedMessage: 'Backup save cancelled. Local data unchanged.'
    },
    {
      name: 'save-failed',
      result: {
        kind: 'save-failed',
        fileName: FILE_NAME,
        exportedAt: EXPORTED_AT,
        message: 'Disk write failed hard.'
      } satisfies BackupCheckpointResult,
      expectedTone: 'error' as const,
      expectedMessage: 'Disk write failed hard.'
    }
  ])(
    'fails closed and resets internal state to idle while surfacing distinct operator messages when checkpoint result is $name',
    async ({ result: checkpointResult, expectedMessage, expectedTone }) => {
      primeExportSnapshot();
      checkpointJsonBackupToDiskMock.mockResolvedValue(checkpointResult);

      const { result, onBackupCompleted, onStatusMessage } = renderSubject({});

      await act(async () => {
        await result.current.handlePrepareReplaceBackup();
      });

      expect(result.current.replaceBackupState).toEqual({ phase: 'idle' });
      expect(result.current.replaceReady).toBe(false);
      expect(result.current.replaceConfirmState).toBe('idle');
      expect(onBackupCompleted).not.toHaveBeenCalled();
      expect(onStatusMessage).toHaveBeenLastCalledWith({
        tone: expectedTone,
        text: expectedMessage
      });

      act(() => {
        result.current.handleArmReplace();
      });

      expect(result.current.replaceConfirmState).toBe('idle');
      expect(onStatusMessage).toHaveBeenLastCalledWith({
        tone: 'warning',
        text: 'Replace remains locked. Complete the pre-replace backup checkpoint before arming the destructive path.'
      });
    }
  );

  it('fails closed and surfaces an error when snapshot generation throws before any disk write', async () => {
    exportCurrentEntriesAsJsonMock.mockRejectedValue(
      new Error('Database read failure during snapshot.')
    );

    const { result, onBackupCompleted, onStatusMessage } = renderSubject({});

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    expect(result.current.replaceBackupState).toEqual({ phase: 'idle' });
    expect(result.current.replaceReady).toBe(false);
    expect(onBackupCompleted).not.toHaveBeenCalled();
    expect(checkpointJsonBackupToDiskMock).not.toHaveBeenCalled();
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'error',
      text: 'Database read failure during snapshot.'
    });

    act(() => {
      result.current.handleArmReplace();
    });

    expect(result.current.replaceConfirmState).toBe('idle');
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text: 'Replace remains locked. Complete the pre-replace backup checkpoint before arming the destructive path.'
    });
  });

  it('resets checkpoint state cleanly when the replace workflow is reset', async () => {
    primeExportSnapshot();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT
    });

    const { result } = renderSubject({});

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    act(() => {
      result.current.setManualBackupConfirmed(true);
      result.current.resetReplaceWorkflow();
    });

    expect(result.current.manualBackupConfirmed).toBe(false);
    expect(result.current.replaceConfirmState).toBe('idle');
    expect(result.current.replaceBackupState).toEqual({ phase: 'idle' });
  });

  it('disarms an armed replace flow when escape is pressed without discarding a valid backup checkpoint', async () => {
    primeExportSnapshot();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT
    });

    const onStatusMessage = vi.fn<OnStatusMessage>();
    const { result } = renderSubject({ onStatusMessage });

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    act(() => {
      result.current.handleArmReplace();
    });

    expect(result.current.replaceConfirmState).toBe('armed');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.replaceConfirmState).toBe('idle');
    expect(result.current.replaceBackupState).toEqual({
      phase: 'ready',
      fileName: FILE_NAME,
      verification: 'verified'
    });
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'info',
      text: 'Replace disarmed. Local data unchanged.'
    });
  });

  it('removes armed replace listeners on unmount', async () => {
    primeExportSnapshot();
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: FILE_NAME,
      exportedAt: EXPORTED_AT
    });

    const onStatusMessage = vi.fn<OnStatusMessage>();
    const { result, unmount } = renderSubject({ onStatusMessage });

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    act(() => {
      result.current.handleArmReplace();
    });

    expect(result.current.replaceConfirmState).toBe('armed');
    expect(onStatusMessage).toHaveBeenCalledTimes(2);

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onStatusMessage).toHaveBeenCalledTimes(2);
  });
});
