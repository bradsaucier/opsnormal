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
import { UnverifiedImportRejectedError } from '../../src/lib/errors';
import type {
  ImportPreview,
  JsonExportPayload,
  SuccessfulImportPreview,
} from '../../src/types';

const applyImportMock = vi.mocked(applyImport);
const previewImportFileMock = vi.mocked(previewImportFile);

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
      return {
        kind,
        maxBytes: 5 * 1024 * 1024,
      };
    case 'blocked-key':
      return {
        kind,
        blockedKey: '__proto__',
      };
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

    expect(result.current.pendingImport).toMatchObject({
      kind: 'good',
      integrityStatus: 'verified',
    });
    expect(result.current.pendingFileName).toBe('verified-export.json');
    expect(result.current.importMode).toBe('merge');
    expect(result.current.pendingImportCanCommit).toBe(true);
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

    expect(result.current.pendingImport).toMatchObject({
      kind: 'good',
      integrityStatus: 'verified',
    });
    expect(result.current.pendingFileName).toBe('second.json');
  });

  it('locks risky imports until the operator acknowledges the staged file risk', async () => {
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue({
      ...buildPreview({ checksum: 'a'.repeat(64) }),
      kind: 'stale',
      ageMs: 7 * 24 * 60 * 60 * 1000,
    });

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'stale.json', { type: 'application/json' }),
        ),
      );
    });

    expect(result.current.pendingImport?.kind).toBe('stale');
    expect(result.current.pendingImportRequiresAcknowledgment).toBe(true);
    expect(result.current.pendingImportCanCommit).toBe(false);

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(applyImportMock).not.toHaveBeenCalled();
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text: 'Import remains locked. Review the staged risk and acknowledge it before the write path unlocks.',
    });

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    expect(result.current.pendingImportCanCommit).toBe(true);
  });

  it('locks legacy-unverified imports until the operator acknowledges the staged file risk', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview());

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
          new File(['{}'], 'legacy.json', { type: 'application/json' }),
        ),
      );
    });

    expect(result.current.pendingImport?.kind).toBe('legacy-unverified');
    expect(result.current.pendingImportRequiresAcknowledgment).toBe(true);
    expect(result.current.pendingImportCanCommit).toBe(false);

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    expect(result.current.pendingImportCanCommit).toBe(true);
  });

  it('clears the risky-file acknowledgment when the operator changes import mode', async () => {
    previewImportFileMock.mockResolvedValue({
      ...buildPreview({ checksum: 'a'.repeat(64) }),
      kind: 'stale',
      ageMs: 7 * 24 * 60 * 60 * 1000,
    });

    const onReplaceWorkflowResetRequested = vi.fn();
    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested,
        onStatusMessage: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'stale.json', { type: 'application/json' }),
        ),
      );
    });

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    expect(result.current.pendingImportCanCommit).toBe(true);

    act(() => {
      result.current.setImportModeWithReset('replace');
    });

    expect(result.current.importMode).toBe('replace');
    expect(result.current.riskyImportAcknowledged).toBe(false);
    expect(result.current.pendingImportCanCommit).toBe(false);
    expect(onReplaceWorkflowResetRequested).toHaveBeenCalledTimes(2);
  });

  it('clears the risky-file acknowledgment when a new file is selected', async () => {
    previewImportFileMock
      .mockResolvedValueOnce({
        ...buildPreview({ checksum: 'a'.repeat(64) }),
        kind: 'stale',
        ageMs: 7 * 24 * 60 * 60 * 1000,
      })
      .mockResolvedValueOnce({
        ...buildPreview({ checksum: 'b'.repeat(64) }),
        kind: 'stale',
        ageMs: 8 * 24 * 60 * 60 * 1000,
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
          new File(['{}'], 'stale-a.json', { type: 'application/json' }),
        ),
      );
    });

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    expect(result.current.pendingImportCanCommit).toBe(true);

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'stale-b.json', { type: 'application/json' }),
        ),
      );
    });

    expect(result.current.pendingFileName).toBe('stale-b.json');
    expect(result.current.riskyImportAcknowledged).toBe(false);
    expect(result.current.pendingImport?.kind).toBe('stale');
    expect(result.current.pendingImportCanCommit).toBe(false);
  });

  it('stages checksum-failed files in read-only preview mode', async () => {
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue(
      buildRejectedPreview('checksum-failed'),
    );

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'checksum-failed.json', {
            type: 'application/json',
          }),
        ),
      );
    });

    expect(result.current.pendingImport).toEqual({
      kind: 'checksum-failed',
    });
    expect(result.current.pendingImportCanCommit).toBe(false);
    expect(result.current.pendingImportRequiresAcknowledgment).toBe(false);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'error',
      text: 'Backup file failed the integrity check. Local data unchanged.',
    });
  });

  it('recovers from a rejected preview when the operator selects a valid file next', async () => {
    previewImportFileMock
      .mockResolvedValueOnce(buildRejectedPreview('checksum-failed'))
      .mockResolvedValueOnce(buildPreview({ checksum: 'a'.repeat(64) }));

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
          new File(['{}'], 'checksum-failed.json', {
            type: 'application/json',
          }),
        ),
      );
    });

    expect(result.current.pendingImport).toEqual({
      kind: 'checksum-failed',
    });
    expect(result.current.pendingImportCanCommit).toBe(false);

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'verified.json', {
            type: 'application/json',
          }),
        ),
      );
    });

    expect(result.current.pendingImport).toMatchObject({
      kind: 'good',
      integrityStatus: 'verified',
    });
    expect(result.current.pendingFileName).toBe('verified.json');
    expect(result.current.pendingImportCanCommit).toBe(true);
  });

  it('applies merge imports and stages undo without changing the workflow contract', async () => {
    const onImportApplied = vi.fn();
    const onOpenUndoSection = vi.fn();
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );
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

    const stagedPayload =
      result.current.pendingImport && 'payload' in result.current.pendingImport
        ? result.current.pendingImport.payload
        : undefined;

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(applyImportMock).toHaveBeenCalledWith(stagedPayload, 'merge', {
      allowUnverified: false,
    });
    expect(onImportApplied).toHaveBeenCalledTimes(1);
    expect(onOpenUndoSection).toHaveBeenCalledTimes(1);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'Merge import complete. 1 rows applied.',
    });
  });

  it('arms replace first, then executes replace on the confirmed path', async () => {
    const onArmReplace = vi.fn();

    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );
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

    expect(applyImportMock).toHaveBeenCalledWith(
      expect.any(Object),
      'replace',
      {
        allowUnverified: false,
      },
    );
  });

  it('passes the unverified opt-in only for acknowledged legacy imports', async () => {
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
          new File(['{}'], 'legacy.json', { type: 'application/json' }),
        ),
      );
    });

    const stagedPayload =
      result.current.pendingImport && 'payload' in result.current.pendingImport
        ? result.current.pendingImport.payload
        : undefined;

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(applyImportMock).toHaveBeenCalledWith(stagedPayload, 'merge', {
      allowUnverified: true,
    });
  });

  it('keeps stale checksum-backed imports on the verified apply path', async () => {
    previewImportFileMock.mockResolvedValue({
      ...buildPreview({ checksum: 'a'.repeat(64) }),
      kind: 'stale',
      ageMs: 7 * 24 * 60 * 60 * 1000,
    });
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
          new File(['{}'], 'stale.json', { type: 'application/json' }),
        ),
      );
    });

    const stagedPayload =
      result.current.pendingImport && 'payload' in result.current.pendingImport
        ? result.current.pendingImport.payload
        : undefined;

    act(() => {
      result.current.setRiskyImportAcknowledged(true);
    });

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(applyImportMock).toHaveBeenCalledWith(stagedPayload, 'merge', {
      allowUnverified: false,
    });
  });

  it('surfaces a deterministic message when apply rejects an unverified payload', async () => {
    const onStatusMessage = vi.fn();

    previewImportFileMock.mockResolvedValue(
      buildPreview({ checksum: 'a'.repeat(64) }),
    );
    applyImportMock.mockRejectedValue(new UnverifiedImportRejectedError());

    const { result } = renderHook(() =>
      useImportWorkflow({
        onImportApplied: vi.fn(),
        onOpenImportSection: vi.fn(),
        onOpenUndoSection: vi.fn(),
        onReplaceWorkflowResetRequested: vi.fn(),
        onStatusMessage,
      }),
    );

    await act(async () => {
      await result.current.handleImportSelection(
        createFileSelectionEvent(
          new File(['{}'], 'verified.json', { type: 'application/json' }),
        ),
      );
    });

    await act(async () => {
      await result.current.handleConfirmImport({
        onArmReplace: vi.fn(),
        replaceConfirmState: 'idle',
      });
    });

    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'error',
      text: 'Import rejected. The backup file has no integrity checksum. Reload the file and acknowledge the unverified-import risk before retrying.',
    });
  });
});
