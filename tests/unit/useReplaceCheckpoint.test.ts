import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/export', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/export')>('../../src/lib/export');

  return {
    ...actual,
    canUseVerifiedFileSave: vi.fn(() => false),
    checkpointJsonBackupToDisk: vi.fn(),
    exportCurrentEntriesAsJson: vi.fn()
  };

  it('removes armed replace listeners on unmount', async () => {
    const onStatusMessage = vi.fn();

    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      exportedAt: '2026-04-02T21:00:00.000Z'
    });

    const { result, unmount } = renderHook(() =>
      useReplaceCheckpoint({
        onBackupCompleted: vi.fn(),
        onStatusMessage,
        pendingImport: buildPreview()
      })
    );

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

import {
  checkpointJsonBackupToDisk,
  exportCurrentEntriesAsJson
} from '../../src/lib/export';
import { useReplaceCheckpoint } from '../../src/features/export/useReplaceCheckpoint';
import type { ImportPreview, JsonExportPayload } from '../../src/types';

const exportCurrentEntriesAsJsonMock = vi.mocked(exportCurrentEntriesAsJson);
const checkpointJsonBackupToDiskMock = vi.mocked(checkpointJsonBackupToDisk);

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

describe('useReplaceCheckpoint', () => {
  beforeEach(() => {
    exportCurrentEntriesAsJsonMock.mockReset();
    checkpointJsonBackupToDiskMock.mockReset();
  });

  it('transitions from manual checkpoint to ready after operator acknowledgment', async () => {
    const onStatusMessage = vi.fn();
    const onBackupCompleted = vi.fn();

    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      exportedAt: '2026-04-02T21:00:00.000Z'
    });

    const { result } = renderHook(() =>
      useReplaceCheckpoint({
        onBackupCompleted,
        onStatusMessage,
        pendingImport: buildPreview()
      })
    );

    await act(async () => {
      await result.current.handlePrepareReplaceBackup();
    });

    expect(result.current.replaceBackupState).toEqual({
      phase: 'manual-awaiting-ack',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json'
    });
    expect(onBackupCompleted).toHaveBeenCalledWith('2026-04-02T21:00:00.000Z');

    act(() => {
      result.current.setManualBackupConfirmed(true);
    });

    act(() => {
      result.current.handleAcknowledgeManualBackup();
    });

    expect(result.current.replaceBackupState).toEqual({
      phase: 'ready',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      verification: 'manual'
    });
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text:
        'Manual backup checkpoint acknowledged for opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json. Replace is unlocked, but the browser did not verify the disk write.'
    });
  });

  it('resets checkpoint state cleanly when the replace workflow is reset', async () => {
    const onStatusMessage = vi.fn();

    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'fallback-download-triggered',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      exportedAt: '2026-04-02T21:00:00.000Z'
    });

    const { result } = renderHook(() =>
      useReplaceCheckpoint({
        onBackupCompleted: vi.fn(),
        onStatusMessage,
        pendingImport: buildPreview()
      })
    );

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

  it('disarms an armed replace flow when escape is pressed', async () => {
    const onStatusMessage = vi.fn();

    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      exportedAt: '2026-04-02T21:00:00.000Z'
    });

    const { result } = renderHook(() =>
      useReplaceCheckpoint({
        onBackupCompleted: vi.fn(),
        onStatusMessage,
        pendingImport: buildPreview()
      })
    );

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
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'info',
      text: 'Replace disarmed. Local data unchanged.'
    });
  });

  it('removes armed replace listeners on unmount', async () => {
    const onStatusMessage = vi.fn();

    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });
    checkpointJsonBackupToDiskMock.mockResolvedValue({
      kind: 'verified-save-succeeded',
      fileName: 'opsnormal-pre-replace-backup-2026-04-02T21-00-00.000Z.json',
      exportedAt: '2026-04-02T21:00:00.000Z'
    });

    const { result, unmount } = renderHook(() =>
      useReplaceCheckpoint({
        onBackupCompleted: vi.fn(),
        onStatusMessage,
        pendingImport: buildPreview()
      })
    );

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
