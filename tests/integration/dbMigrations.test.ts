import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { applyOpsNormalDbSchema } from '../../src/db/schema';
import { applyOpsNormalDbMigrations } from '../../src/db/migrations';
import type { DailyEntry } from '../../src/types';

const TEST_DB_NAME = 'opsnormal-db-migration-integration-test';
const TRANSFORM_TEST_DB_NAME =
  'opsnormal-db-migration-transform-integration-test';

class LegacyOpsNormalDbV1 extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt',
    });
  }
}

class CurrentOpsNormalDb extends Dexie {
  dailyEntries!: EntityTable<DailyEntry, 'id'>;

  constructor(name: string) {
    super(name);
    applyOpsNormalDbSchema(this);
  }
}

interface MigrationProbeRecord {
  id?: number;
  name: string;
  priority?: 'medium';
}

class LegacyMigrationProbeDbV1 extends Dexie {
  records!: EntityTable<MigrationProbeRecord, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      records: '++id, name',
    });
  }
}

class CurrentMigrationProbeDb extends Dexie {
  records!: EntityTable<Required<MigrationProbeRecord>, 'id'>;

  constructor(name: string) {
    super(name);
    applyOpsNormalDbMigrations(this, [
      {
        version: 1,
        name: 'initial-records-schema',
        stores: {
          records: '++id, name',
        },
      },
      {
        version: 2,
        name: 'add-default-priority',
        stores: {
          records: '++id, name, priority',
        },
        async upgrade(transaction: Transaction) {
          await transaction
            .table('records')
            .toCollection()
            .modify((record: MigrationProbeRecord) => {
              record.priority = 'medium';
            });
        },
      },
    ]);
  }
}

describe('database schema migrations', () => {
  afterEach(async () => {
    await Dexie.delete(TEST_DB_NAME);
    await Dexie.delete(TRANSFORM_TEST_DB_NAME);
  });

  it('opens a version 1 database at the latest schema without losing daily entries', async () => {
    const legacyDb = new LegacyOpsNormalDbV1(TEST_DB_NAME);

    try {
      await legacyDb.open();
      await legacyDb.dailyEntries.bulkAdd([
        {
          date: '2026-03-27',
          sectorId: 'body',
          status: 'nominal',
          updatedAt: '2026-03-27T12:00:00.000Z',
        },
        {
          date: '2026-03-28',
          sectorId: 'rest',
          status: 'degraded',
          updatedAt: '2026-03-28T12:05:00.000Z',
        },
      ]);
    } finally {
      legacyDb.close();
    }

    const currentDb = new CurrentOpsNormalDb(TEST_DB_NAME);

    try {
      await currentDb.open();

      const entries = await currentDb.dailyEntries
        .orderBy('[date+sectorId]')
        .toArray();
      const secondaryIndexes = currentDb.dailyEntries.schema.indexes.map(
        (index) => index.name,
      );

      expect(
        entries.map(({ date, sectorId, status, updatedAt }) => ({
          date,
          sectorId,
          status,
          updatedAt,
        })),
      ).toEqual([
        {
          date: '2026-03-27',
          sectorId: 'body',
          status: 'nominal',
          updatedAt: '2026-03-27T12:00:00.000Z',
        },
        {
          date: '2026-03-28',
          sectorId: 'rest',
          status: 'degraded',
          updatedAt: '2026-03-28T12:05:00.000Z',
        },
      ]);
      expect(secondaryIndexes).toEqual(['[date+sectorId]']);
    } finally {
      currentDb.close();
    }
  });

  it('executes upgrade callbacks when a migration transforms stored records', async () => {
    const legacyDb = new LegacyMigrationProbeDbV1(TRANSFORM_TEST_DB_NAME);

    try {
      await legacyDb.open();
      await legacyDb.records.add({
        name: 'alpha',
      });
    } finally {
      legacyDb.close();
    }

    const currentDb = new CurrentMigrationProbeDb(TRANSFORM_TEST_DB_NAME);

    try {
      await currentDb.open();

      const migratedRecords = await currentDb.records.toArray();
      const secondaryIndexes = currentDb.records.schema.indexes.map(
        (index) => index.name,
      );

      expect(migratedRecords).toEqual([
        {
          id: 1,
          name: 'alpha',
          priority: 'medium',
        },
      ]);
      expect(secondaryIndexes).toEqual(['name', 'priority']);
    } finally {
      currentDb.close();
    }
  });
});
