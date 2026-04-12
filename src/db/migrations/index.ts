import type Dexie from 'dexie';

import migration001InitialSchema from './001-initial-schema';
import migration002RemoveLegacyDailyEntrySecondaryIndexes from './002-remove-legacy-daily-entry-secondary-indexes';
import type { OpsNormalDbMigration } from './types';

export type OpsNormalDbSchemaVersion = Pick<OpsNormalDbMigration, 'version' | 'stores'>;

// Architecture: ADR-0018 requires a typed, strictly ordered migration registry.
// That keeps schema evolution reviewable and lets upgrade tests assert exact version order.
export const OPSNORMAL_DB_MIGRATIONS = [
  migration001InitialSchema,
  migration002RemoveLegacyDailyEntrySecondaryIndexes
] as const satisfies readonly OpsNormalDbMigration[];

export const OPSNORMAL_LATEST_DB_SCHEMA_VERSION =
  OPSNORMAL_DB_MIGRATIONS[OPSNORMAL_DB_MIGRATIONS.length - 1]?.version ?? 0;

export function validateOpsNormalDbMigrations(
  migrations: readonly OpsNormalDbMigration[]
): void {
  if (migrations.length === 0) {
    throw new Error('OpsNormal database migration registry cannot be empty.');
  }

  let previousVersion = 0;

  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(
        `OpsNormal database migration version must be a positive integer. Received ${String(migration.version)} for ${migration.name}.`
      );
    }

    if (migration.version <= previousVersion) {
      throw new Error(
        `OpsNormal database migration versions must increase strictly. ${migration.name} cannot follow version ${String(previousVersion)} with version ${String(migration.version)}.`
      );
    }

    previousVersion = migration.version;
  }
}

export function getOpsNormalDbSchemaVersions(
  migrations: readonly OpsNormalDbMigration[] = OPSNORMAL_DB_MIGRATIONS
): readonly OpsNormalDbSchemaVersion[] {
  validateOpsNormalDbMigrations(migrations);
  return migrations.map(({ version, stores }) => ({ version, stores }));
}

export function applyOpsNormalDbMigrations(
  database: Dexie,
  migrations: readonly OpsNormalDbMigration[] = OPSNORMAL_DB_MIGRATIONS
): void {
  validateOpsNormalDbMigrations(migrations);

  for (const migration of migrations) {
    const schema = database.version(migration.version).stores(migration.stores);

    if (migration.upgrade) {
      schema.upgrade(migration.upgrade);
    }
  }
}

export type { OpsNormalDbMigration } from './types';
