import Dexie, { type EntityTable } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyOpsNormalDbMigrations,
  OPSNORMAL_DB_MIGRATIONS,
  OPSNORMAL_LATEST_DB_SCHEMA_VERSION,
} from '../../src/db/migrations';
import type { DailyEntry } from '../../src/types';
import {
  CURRENT_DAILY_ENTRIES_STORE,
  LEGACY_DAILY_ENTRIES_STORE,
  MIGRATION_V1_DUPLICATE_INSERT_ENTRY,
  MIGRATION_V1_EXPECTED_ENTRIES,
  normalizeMigrationEntries,
  REMOVED_LEGACY_SECONDARY_INDEX_NAMES,
  seedV1Entries,
} from '../helpers/dbMigrationFixture';

const TEST_DB_NAME = 'opsnormal-db-migration-browser-proof-test';

class LegacyOpsNormalDbV1 extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      dailyEntries: LEGACY_DAILY_ENTRIES_STORE,
    });
  }
}

class CurrentOpsNormalDb extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor(name: string) {
    super(name);
    applyOpsNormalDbMigrations(this, OPSNORMAL_DB_MIGRATIONS);
  }
}

describe('database browser migration proof', () => {
  afterEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
  });

  it('reopens a seeded version 1 database at the registry head without data loss', async () => {
    const legacyDb = new LegacyOpsNormalDbV1(TEST_DB_NAME);

    try {
      await legacyDb.open();
      await seedV1Entries(legacyDb);
    } finally {
      legacyDb.close();
    }

    const currentDb = new CurrentOpsNormalDb(TEST_DB_NAME);

    try {
      await currentDb.open();

      expect(currentDb.verno).toBe(OPSNORMAL_LATEST_DB_SCHEMA_VERSION);

      const entries = normalizeMigrationEntries(
        await currentDb.dailyEntries.orderBy('[date+sectorId]').toArray(),
      );
      const indexNames = currentDb.dailyEntries.schema.indexes.map(
        (index) => index.name,
      );

      expect(entries).toHaveLength(MIGRATION_V1_EXPECTED_ENTRIES.length);
      expect(entries).toEqual(MIGRATION_V1_EXPECTED_ENTRIES);

      for (const expectedEntry of MIGRATION_V1_EXPECTED_ENTRIES) {
        const stored = await currentDb.dailyEntries
          .where('[date+sectorId]')
          .equals([expectedEntry.date, expectedEntry.sectorId])
          .first();

        expect(stored).toBeDefined();
        expect(normalizeMigrationEntries([stored!])).toEqual([expectedEntry]);
      }

      await expect(
        currentDb.dailyEntries.add(MIGRATION_V1_DUPLICATE_INSERT_ENTRY),
      ).rejects.toMatchObject({
        name: 'ConstraintError',
      });

      expect(currentDb.dailyEntries.schema.primKey.auto).toBe(true);
      expect(currentDb.dailyEntries.schema.primKey.keyPath).toBe('id');
      expect(indexNames).toEqual(['[date+sectorId]']);
      expect(CURRENT_DAILY_ENTRIES_STORE).toContain('&[date+sectorId]');

      for (const removedIndexName of REMOVED_LEGACY_SECONDARY_INDEX_NAMES) {
        expect(indexNames).not.toContain(removedIndexName);
      }
    } finally {
      currentDb.close();
    }
  });
});
