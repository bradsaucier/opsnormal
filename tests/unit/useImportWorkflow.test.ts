import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/importService', () => ({
  applyImport: vi.fn(),
  previewImportFile: vi.fn(),
}));

import {
  applyImport,
  previewImportFile,
} from '../../src/services/importService';
import { useImportWorkflow } from '../../src/features/export/useImportWorkflow';
import type { ImportPreview, JsonExportPayload } from '../../src/types';

const applyImportMock = vi.mocked(applyImport);
const previewImportFileMock = vi.mocked(previewImportFile);

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

function createFileSelectionEvent(file: File): ChangeEvent<HTMLInputElement> {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });

  return {
    currentTarget: input,
    target: input,
  } as ChangeEvent<HTMLInputElement>;
}

describe('useImportWorkflow', () => {
  beforeEach(() => {
    applyImportMock.mockReset();
    previewImportFileMock.mockReset();
  });

  it('stages a validated preview and opens the import section', async () => {
    const onOpenImportSection = vi.fn();
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection,
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'verified-export.json', {
            type: 'application/json',
          }),
        ),
      );
    });

    expect(result.current.pendingImport?.integrityStatus).toBe('verified');
    expect(result.current.pendingFileName).toBe('verified-export.json');
    expect(result.current.importMode).toBe('merge');
    expect(onOpenImportSection).toHaveBeenCalledTimes(1);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'Import staged. 1 entries validated. Review the preview and confirm the write path.',
    });
  });

  it('abandons an earlier preview request when a newer file is selected', async () => {
    const secondPreview = buildPreview({ checksum: 'b'.repeat(64) });

    previewImportFileMock
      .mockImplementationOnce(
        (_file, signal) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener(
              'abort',
              () => {
                const error = new Error('Import preview cancelled.');
                error.name = 'AbortError';
                reject(error);
              },
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(secondPreview);

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage: vi.fn(),
      }),
    );

    let firstSelection: Promise<void>;

    await act(async () => {
      firstSelection = result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'first.json', { type: 'application/json' }),
        ),
      );
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'second.json', { type: 'application/json' }),
        ),
      );
    });

    await act(async () => {
      await firstSelection;
    });

    expect(result.current.pendingImport?.integrityStatus).toBe('verified');
    expect(result.current.pendingFileName).toBe('second.json');
  });

  it('applies merge imports and stages undo without changing the workflow contract', async () => {
    const onImportApplied = vi.fn();
    const onOpenUndoSection = vi.fn();
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue(buildPreview());
    applyImportMock.mockResolvedValue({
      importedCount: 1,
      undo: vi.fn(() => Promise.resolve()),
    });

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied,
        onOpenImportSection: vi.fn(),
        onOpenUndoSection,
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'merge.json', { type: 'application/json' }),
        ),
      );
    });

    const stagedPayload = result.current.pendingImport?.payload;

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(applyImportMock).toHaveBeenCalledWith(stagedPayload, 'merge');
    expect(onImportApplied).toHaveBeenCalledTimes(1);
    expect(onOpenUndoSection).toHaveBeenCalledTimes(1);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'Merge import complete. 1 rows applied.',
    });
  });

  it('arms replace first, then executes replace on the confirmed path', async () => {
    const onArmReplace = vi.fn();

    previewImportFileMock.mockResolvedValue(buildPreview());
    applyImportMock.mockResolvedValue({
      importedCount: 1,
      undo: vi.fn(() => Promise.resolve()),
    });

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'replace.json', { type: 'application/json' }),
        ),
      );
    });

    act(() => {
      result.current.setImportModeWithReset('replace');
    });

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace,
        replaceConfirmState: 'idle',
      });
    });

    expect(onArmReplace).toHaveBeenCalledTimes(1);
    expect(applyImportMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace,
        replaceConfirmState: 'armed',
      });
    });

    expect(applyImportMock).toHaveBeenCalledWith(expect.any(Object), 'replace');
  });
});
