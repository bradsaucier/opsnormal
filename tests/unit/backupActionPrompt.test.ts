import { describe, expect, it } from 'vitest';

import {
  createBackupActionPrompt,
  type BackupActionPrompt
} from '../../src/features/export/backupActionPrompt';
import type { StorageHealth } from '../../src/lib/storage';

function buildStorageHealth(overrides: Partial<StorageHealth> = {}): StorageHealth {
  return {
    persisted: false,
    persistenceAvailable: true,
    estimateAvailable: true,
    usageBytes: 100,
    quotaBytes: 1000,
    percentUsed: 0.1,
    status: 'monitor',
    message: 'Persistent storage not granted. Export routinely.',
    safari: {
      connectionDropsDetected: 0,
      reconnectSuccesses: 0,
      reconnectFailures: 0,
      reconnectState: 'steady',
      lastReconnectError: null,
      persistAttempted: false,
      persistGranted: false,
      standaloneMode: false,
      installRecommended: false,
      webKitRisk: false,
      lastVerificationResult: 'unknown',
      lastVerifiedAt: null
    },
    ...overrides
  };
}

function expectPromptTitle(prompt: BackupActionPrompt | null, title: string) {
  expect(prompt).not.toBeNull();
  expect(prompt?.title).toBe(title);
}

describe('createBackupActionPrompt', () => {
  it('surfaces an immediate export warning after reconnect or verification diagnostics', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        safari: {
          ...buildStorageHealth().safari,
          reconnectState: 'recovering'
        }
      }),
      '2026-04-09T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'Confirm state and refresh the JSON backup');
    expect(prompt?.detail).toContain('write-verification warning');
  });

  it('warns when Safari browser-tab risk does not have a fresh backup inside the inactivity window', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
          installRecommended: true
        }
      }),
      '2026-04-01T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'Safari tab risk requires a fresh backup');
    expect(prompt?.detail).toContain('Home Screen');
  });

  it('warns at the exact Safari backup-age boundary', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
          installRecommended: true
        }
      }),
      '2026-04-04T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'Safari tab risk requires a fresh backup');
  });

  it('treats corrupted unparseable timestamp metadata as a stale backup', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
          installRecommended: true
        }
      }),
      'corrupted-garbage-string-payload',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'Safari tab risk requires a fresh backup');
  });

  it('does not warn for Safari browser-tab risk when the JSON backup is still fresh', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: true,
          installRecommended: true
        }
      }),
      '2026-04-08T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(prompt).toBeNull();
  });


  it('keeps the Safari freshness prompt quiet for installed iPhone and iPad paths', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'monitor',
        safari: {
          ...buildStorageHealth().safari,
          webKitRisk: false,
          standaloneMode: true
        }
      }),
      '2026-04-01T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(prompt).toBeNull();
  });

  it('prioritizes reconnect guidance over stale Safari-tab freshness guidance', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning',
        safari: {
          ...buildStorageHealth().safari,
          reconnectState: 'failed',
          webKitRisk: true,
          installRecommended: true
        }
      }),
      '2026-04-01T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'Confirm state and refresh the JSON backup');
  });

  it('warns when elevated storage risk has no recorded JSON backup', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        status: 'warning'
      }),
      null,
      new Date('2026-04-10T12:00:00.000Z')
    );

    expectPromptTitle(prompt, 'No external JSON backup recorded');
  });

  it('stays quiet when there is no actionable backup signal', () => {
    const prompt = createBackupActionPrompt(
      buildStorageHealth({
        persisted: true,
        status: 'protected'
      }),
      '2026-04-09T12:00:00.000Z',
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(prompt).toBeNull();
  });
});
