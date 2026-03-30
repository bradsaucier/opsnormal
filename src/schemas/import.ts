import { z } from 'zod';

import { EXPORT_SCHEMA_VERSION, OPSNORMAL_APP_NAME, SECTORS } from '../types';

const sectorIds = SECTORS.map((sector) => sector.id) as [
  (typeof SECTORS)[number]['id'],
  ...(typeof SECTORS)[number]['id'][]
];

const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');
const SectorIdSchema = z.enum(sectorIds);
const EntryStatusSchema = z.enum(['nominal', 'degraded']);
const ChecksumSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Checksum must be a 64-character lowercase SHA-256 hex digest.');

export const DailyEntrySchema = z
  .object({
    id: z.number().int().positive().optional(),
    date: DateKeySchema,
    sectorId: SectorIdSchema,
    status: EntryStatusSchema,
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict();

export const JsonImportSchema = z
  .object({
    app: z.literal(OPSNORMAL_APP_NAME),
    schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    entries: z.array(DailyEntrySchema).max(10000),
    checksum: ChecksumSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.entries.forEach((entry, index) => {
      const compoundKey = `${entry.date}:${entry.sectorId}`;

      if (seen.has(compoundKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', index],
          message: `Duplicate entry detected for ${compoundKey}.`
        });
        return;
      }

      seen.add(compoundKey);
    });
  });

export type ParsedJsonImport = z.infer<typeof JsonImportSchema>;
