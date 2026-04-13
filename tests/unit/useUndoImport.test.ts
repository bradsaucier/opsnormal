import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUndoImport } from '../../src/features/export/useUndoImport';

describe('useUndoImport', () => {
  it('stages a session-scoped undo and clears it after a successful restore', async () => {
    const onStatusMessage = vi.fn();
    const undo = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useUndoImport({
        onStatusMessage,
      }),
    );

    act(() => {
      result.current.stageUndoImport(undo);
    });

    expect(result.current.canUndoImport).toBe(true);

    await act(async () => {
      await result.current.handleUndoImport();
    });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndoImport).toBe(false);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'success',
      text: 'Undo complete. The pre-import database snapshot has been restored.',
    });
  });

  it('replaces an older staged undo with the newest import rollback', async () => {
    const firstUndo = vi.fn(() => Promise.resolve());
    const secondUndo = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useUndoImport({
        onStatusMessage: vi.fn(),
      }),
    );

    act(() => {
      result.current.stageUndoImport(firstUndo);
      result.current.stageUndoImport(secondUndo);
    });

    await act(async () => {
      await result.current.handleUndoImport();
    });

    expect(firstUndo).not.toHaveBeenCalled();
    expect(secondUndo).toHaveBeenCalledTimes(1);
  });
});
