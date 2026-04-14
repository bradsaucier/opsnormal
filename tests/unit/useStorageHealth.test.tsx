import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StorageHealth,
  StorageHealthOptions,
} from "../../src/lib/storage";

const storageMocks = vi.hoisted(() => ({
  getStorageHealth:
    vi.fn<(options?: StorageHealthOptions) => Promise<StorageHealth>>(),
  subscribeToStorageDiagnostics: vi.fn<(callback: () => void) => () => void>(),
}));

vi.mock("../../src/lib/storage", () => ({
  getStorageHealth: storageMocks.getStorageHealth,
  subscribeToStorageDiagnostics: storageMocks.subscribeToStorageDiagnostics,
}));

import { useStorageHealth } from "../../src/hooks/useStorageHealth";

function buildStorageHealth(
  overrides: Partial<StorageHealth> = {},
): StorageHealth {
  return {
    persisted: false,
    persistenceAvailable: true,
    estimateAvailable: true,
    usageBytes: 10,
    quotaBytes: 100,
    percentUsed: 0.1,
    status: "monitor",
    message: "Storage health nominal.",
    safari: {
      connectionDropsDetected: 0,
      reconnectSuccesses: 0,
      reconnectFailures: 0,
      reconnectState: "steady",
      lastReconnectError: null,
      persistAttempted: false,
      persistGranted: false,
      standaloneMode: false,
      installRecommended: false,
      webKitRisk: false,
      lastVerificationResult: "verified",
      lastVerifiedAt: "2026-04-10T12:00:00.000Z",
    },
    ...overrides,
  };
}

function installDisplayModeQuery(useLegacyListeners = false) {
  const mediaQueryList = {
    matches: false,
    media: "(display-mode: standalone)",
    onchange: null,
    addEventListener: useLegacyListeners ? undefined : vi.fn(),
    removeEventListener: useLegacyListeners ? undefined : vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return mediaQueryList;
}

describe("useStorageHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storageMocks.getStorageHealth.mockReset();
    storageMocks.subscribeToStorageDiagnostics.mockReset();
    storageMocks.getStorageHealth.mockResolvedValue(buildStorageHealth());
    storageMocks.subscribeToStorageDiagnostics.mockImplementation(
      () => () => undefined,
    );
    installDisplayModeQuery();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hydrates initial storage health and refreshes on focus and diagnostics events", async () => {
    let diagnosticsCallback: (() => void) | undefined;
    storageMocks.subscribeToStorageDiagnostics.mockImplementation(
      (callback) => {
        diagnosticsCallback = callback;
        return () => undefined;
      },
    );

    const { result } = renderHook(() => useStorageHealth());

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const baselineCalls = storageMocks.getStorageHealth.mock.calls.length;

    expect(result.current.storageHealth?.status).toBe("monitor");
    expect(baselineCalls).toBeGreaterThan(0);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      diagnosticsCallback?.();
      await Promise.resolve();
    });

    expect(storageMocks.getStorageHealth.mock.calls.length).toBe(
      baselineCalls + 2,
    );
  });

  it("requests storage protection with the persistence flags and coalesces in-flight calls", async () => {
    const protectedHealth = buildStorageHealth({
      persisted: true,
      status: "protected",
    });
    let resolveRequest: ((value: StorageHealth) => void) | null = null;

    storageMocks.getStorageHealth.mockImplementation(
      (options: StorageHealthOptions = {}) =>
        new Promise((resolve) => {
          if (options.requestPersistence) {
            resolveRequest = resolve;
            return;
          }

          resolve(buildStorageHealth());
        }),
    );

    const { result } = renderHook(() => useStorageHealth());

    let firstRequest!: Promise<StorageHealth>;
    let secondRequest!: Promise<StorageHealth>;

    await act(async () => {
      firstRequest = result.current.requestStorageProtection();
      secondRequest = result.current.requestStorageProtection();
      await Promise.resolve();
    });

    expect(storageMocks.getStorageHealth).toHaveBeenCalledWith({
      requestPersistence: true,
      allowRepeatRequest: true,
    });
    expect(result.current.isRequestingStorageProtection).toBe(true);

    await act(async () => {
      resolveRequest?.(protectedHealth);
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(result.current.storageHealth?.status).toBe("protected");
    expect(result.current.isRequestingStorageProtection).toBe(false);
  });

  it("refreshes when the tab returns to the foreground", async () => {
    renderHook(() => useStorageHealth());

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    const baselineCalls = storageMocks.getStorageHealth.mock.calls.length;

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(storageMocks.getStorageHealth.mock.calls.length).toBe(
      baselineCalls + 1,
    );
  });

  it("falls back to legacy media-query listeners and removes them on unmount", () => {
    const mediaQueryList = installDisplayModeQuery(true);
    const { unmount } = renderHook(() => useStorageHealth());

    expect(mediaQueryList.addListener.mock.calls).toHaveLength(1);

    unmount();

    expect(mediaQueryList.removeListener.mock.calls).toHaveLength(1);
  });
});
