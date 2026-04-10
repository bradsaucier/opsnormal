import { describe, expect, it } from 'vitest';

import {
  getOpsNormalDbSchemaVersions,
  OPSNORMAL_DB_MIGRATIONS,
  validateOpsNormalDbMigrations,
  type OpsNormalDbMigration
} from '../../src/db/migrations';

describe('OpsNormal database migration registry', () => {
  it('derives schema versions from the migration registry in order', () => {
    expect(getOpsNormalDbSchemaVersions(OPSNORMAL_DB_MIGRATIONS)).toEqual([
      {
        version: 1,
        stores: {
          dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
        }
      },
      {
        version: 2,
        stores: {
          dailyEntries: '++id, &[date+sectorId]'
        }
      }
    ]);
  });

  it('rejects an empty migration registry', () => {
    expect(() => validateOpsNormalDbMigrations([])).toThrow(
      'OpsNormal database migration registry cannot be empty.'
    );
  });

  it('rejects duplicate or descending migration versions', () => {
    const invalidMigrations: OpsNormalDbMigration[] = [
      {
        version: 1,
        name: 'initial-schema',
        stores: {
          dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
        }
      },
      {
        version: 1,
        name: 'duplicate-version',
        stores: {
          dailyEntries: '++id, &[date+sectorId]'
        }
      }
    ];

    expect(() => validateOpsNormalDbMigrations(invalidMigrations)).toThrow(
      /versions must increase strictly/i
    );
  });
});
