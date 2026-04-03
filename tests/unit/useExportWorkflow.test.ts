import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/export', () => ({
  downloadTextFile: vi.fn(),
  exportCurrentEntriesAsCsv: vi.fn(),
  exportCurrentEntriesAsJson: vi.fn(),
  formatLastExportCompletedAt: vi.fn((value: string | null) =>
    value ? `formatted:${value}` : 'formatted:none'
  ),
  getLastExportCompletedAt: vi.fn(),
  recordExportCompleted: vi.fn()
}));

import {
  downloadTextFile,
  exportCurrentEntriesAsCsv,
  exportCurrentEntriesAsJson,
  getLastExportCompletedAt,
  recordExportCompleted
} from '../../src/lib/export';
import { useExportWorkflow } from '../../src/features/export/useExportWorkflow';

const downloadTextFileMock = vi.mocked(downloadTextFile);
const exportCurrentEntriesAsCsvMock = vi.mocked(exportCurrentEntriesAsCsv);
const exportCurrentEntriesAsJsonMock = vi.mocked(exportCurrentEntriesAsJson);
const getLastExportCompletedAtMock = vi.mocked(getLastExportCompletedAt);
const recordExportCompletedMock = vi.mocked(recordExportCompleted);

describe('useExportWorkflow', () => {
  beforeEach(() => {
    downloadTextFileMock.mockReset();
    exportCurrentEntriesAsCsvMock.mockReset();
    exportCurrentEntriesAsJsonMock.mockReset();
    getLastExportCompletedAtMock.mockReset();
    recordExportCompletedMock.mockReset();
  });

  it('hydrates backup posture from the persisted export timestamp', () => {
    getLastExportCompletedAtMock.mockReturnValue('2026-04-02T21:00:00.000Z');

    const { result } = renderHook(() =>
      useExportWorkflow({
        onStatusMessage: vi.fn()
      })
    );

    expect(getLastExportCompletedAtMock).toHaveBeenCalledTimes(1);
    expect(result.current.backupStatus).toBe('formatted:2026-04-02T21:00:00.000Z');
  });

  it('records a JSON export completion and emits the success message', async () => {
    const onStatusMessage = vi.fn();

    getLastExportCompletedAtMock.mockReturnValue(null);
    exportCurrentEntriesAsJsonMock.mockResolvedValue({
      entryCount: 3,
      exportedAt: '2026-04-02T21:00:00.000Z',
      payload: '{"app":"OpsNormal"}'
    });

    const { result } = renderHook(() =>
      useExportWorkflow({
        onStatusMessage
      })
    );

    await act(async () => {
      await result.current.handleJsonExport();
    });

    expect(downloadTextFileMock).toHaveBeenCalledWith(
      'opsnormal-export.json',
      '{"app":"OpsNormal"}',
      'application/json'
    );
    expect(recordExportCompletedMock).toHaveBeenCalledWith('2026-04-02T21:00:00.000Z');
    expect(result.current.backupStatus).toBe('formatted:2026-04-02T21:00:00.000Z');
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'JSON export complete. 3 entries written to disk.'
    });
  });

  it('emits the CSV export success message without updating backup posture', async () => {
    const onStatusMessage = vi.fn();

    getLastExportCompletedAtMock.mockReturnValue(null);
    exportCurrentEntriesAsCsvMock.mockResolvedValue({
      entryCount: 5,
      payload: 'date,sectorId,status,updatedAt'
    });

    const { result } = renderHook(() =>
      useExportWorkflow({
        onStatusMessage
      })
    );

    await act(async () => {
      await result.current.handleCsvExport();
    });

    expect(downloadTextFileMock).toHaveBeenCalledWith(
      'opsnormal-export.csv',
      'date,sectorId,status,updatedAt',
      'text/csv;charset=utf-8'
    );
    expect(recordExportCompletedMock).not.toHaveBeenCalled();
    expect(result.current.backupStatus).toBe('formatted:none');
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'CSV export complete. 5 entries written to disk.'
    });
  });
});
