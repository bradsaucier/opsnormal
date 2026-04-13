import type Dexie from 'dexie';

import {
  applyOpsNormalDbMigrations,
  getOpsNormalDbSchemaVersions,
  OPSNORMAL_DB_MIGRATIONS,
  OPSNORMAL_LATEST_DB_SCHEMA_VERSION,
} from './migrations';

export const OPSNORMAL_DB_NAME = 'opsnormal';

export const OPSNORMAL_DB_SCHEMA_VERSIONS = getOpsNormalDbSchemaVersions(
  OPSNORMAL_DB_MIGRATIONS,
);
export { OPSNORMAL_DB_MIGRATIONS, OPSNORMAL_LATEST_DB_SCHEMA_VERSION };

export function applyOpsNormalDbSchema(database: Dexie): void {
  applyOpsNormalDbMigrations(database, OPSNORMAL_DB_MIGRATIONS);
}
