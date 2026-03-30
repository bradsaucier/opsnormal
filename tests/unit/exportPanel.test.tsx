import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/appDb', () => ({
  getAllEntries: vi.fn(() => Promise.resolve([]))
}));

vi.mock('../../src/services/importService', () => ({
  applyImport: vi.fn(),
  previewImportFile: vi.fn()
}));

import { ExportPanel } from '../../src/features/export/ExportPanel';
import { previewImportFile } from '../../src/services/importService';
import type { ImportPreview, JsonExportPayload } from '../../src/types';

const previewImportFileMock = vi.mocked(previewImportFile);

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
    overwriteCount: 0,
    newEntryCount: 1,
    totalEntries: 1,
    dateRange: {
      start: '2026-03-28',
      end: '2026-03-28'
    }
  };
}

describe('ExportPanel import warnings', () => {
  beforeEach(() => {
    previewImportFileMock.mockReset();
  });

  it('flags legacy imports as unverified before confirm', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview());

    render(<ExportPanel storageHealth={null} />);

    const input = screen.getByTestId('import-file-input');
    const file = new File(['{}'], 'legacy-export.json', { type: 'application/json' });
    await userEvent.upload(input, file);

    expect(await screen.findByRole('heading', { name: 'Import ready' })).toBeInTheDocument();
    expect(screen.getByText(/legacy backup detected/i)).toBeInTheDocument();
  });

  it('shows verified status text when checksum validation is present', async () => {
    previewImportFileMock.mockResolvedValue(buildPreview({ checksum: 'a'.repeat(64) }));

    render(<ExportPanel storageHealth={null} />);

    const input = screen.getByTestId('import-file-input');
    const file = new File(['{}'], 'verified-export.json', { type: 'application/json' });
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(
        screen.getByText(/integrity verified\. the embedded sha-256 checksum matched/i)
      ).toBeInTheDocument()
    );
  });
});
