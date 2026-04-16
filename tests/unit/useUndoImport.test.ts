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

  it('disables the staged undo and emits a warning when a daily-status write lands', async () => {
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

    act(() => {
      window.dispatchEvent(
        new CustomEvent('opsnormal:entry-written', {
          detail: { source: 'daily-status' },
        }),
      );
    });

    expect(result.current.canUndoImport).toBe(false);
    expect(result.current.undoInvalidated).toBe(true);
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text: 'Undo disabled: a daily check-in landed after this import. Export a fresh backup before proceeding.',
    });

    await act(async () => {
      await result.current.handleUndoImport();
    });

    expect(undo).not.toHaveBeenCalled();
    expect(onStatusMessage).toHaveBeenLastCalledWith({
      tone: 'warning',
      text: 'Undo disabled: a daily check-in landed after this import. Export a fresh backup before proceeding.',
    });
  });

  it('re-enables undo when a new import stages a fresh snapshot', async () => {
    const firstUndo = vi.fn(() => Promise.resolve());
    const secondUndo = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() =>
      useUndoImport({
        onStatusMessage: vi.fn(),
      }),
    );

    act(() => {
      result.current.stageUndoImport(firstUndo);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('opsnormal:entry-written', {
          detail: { source: 'daily-status' },
        }),
      );
    });

    expect(result.current.canUndoImport).toBe(false);
    expect(result.current.undoInvalidated).toBe(true);

    act(() => {
      result.current.stageUndoImport(secondUndo);
    });

    expect(result.current.canUndoImport).toBe(true);
    expect(result.current.undoInvalidated).toBe(false);

    await act(async () => {
      await result.current.handleUndoImport();
    });

    expect(firstUndo).not.toHaveBeenCalled();
    expect(secondUndo).toHaveBeenCalledTimes(1);
  });
});
