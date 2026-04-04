import Dexie from 'dexie';

export const OPSNORMAL_DB_NAME = 'opsnormal';

export const OPSNORMAL_DB_SCHEMA_VERSIONS = [
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
] as const;

export function applyOpsNormalDbSchema(database: Dexie): void {
  for (const schemaVersion of OPSNORMAL_DB_SCHEMA_VERSIONS) {
    database.version(schemaVersion.version).stores(schemaVersion.stores);
  }
}
