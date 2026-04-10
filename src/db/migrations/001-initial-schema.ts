import type { OpsNormalDbMigration } from './types';

const migration: OpsNormalDbMigration = {
  version: 1,
  name: 'initial-daily-entries-schema',
  stores: {
    dailyEntries: '++id, &[date+sectorId], date, sectorId, updatedAt'
  }
};

export default migration;
