import { JsonImportSchema } from '../../src/schemas/import';
import type { JsonExportPayload } from '../../src/types';

export function parseExportPayload(rawText: string): JsonExportPayload {
  const parsed: unknown = JSON.parse(rawText) as unknown;
  return JsonImportSchema.parse(parsed);
}
