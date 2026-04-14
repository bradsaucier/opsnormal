import {
  createRejectedImportPreview,
  parseImportPayload,
  summarizeParsedPayload,
  validateImportFileSize,
} from './importValidation';

interface WorkerPreviewRequest {
  buffer: ArrayBuffer;
  size: number;
}

self.onmessage = async (event: MessageEvent<WorkerPreviewRequest>) => {
  try {
    const request = event.data;

    if (
      !(request.buffer instanceof ArrayBuffer) ||
      !Number.isFinite(request.size)
    ) {
      throw new Error(
        'Import rejected. Preview worker did not receive a transferable payload.',
      );
    }

    validateImportFileSize({ size: request.size });

    const rawText = new TextDecoder().decode(request.buffer);
    const payload = await parseImportPayload(rawText);

    self.postMessage({
      ok: true,
      summary: summarizeParsedPayload(payload),
    });
  } catch (error) {
    const rejectedPreview = createRejectedImportPreview(error);

    if (rejectedPreview) {
      self.postMessage({
        ok: false,
        preview: rejectedPreview,
      });
      return;
    }

    self.postMessage({
      ok: false,
      preview: {
        kind: 'invalid',
        issuePath: null,
        issueMessage:
          error instanceof Error ? error.message : 'Import preparation failed.',
      },
    });
  }
};
