import type { OpsNormalDbMigration } from './types';

const migration: OpsNormalDbMigration = {
  version: 2,
  name: 'remove-legacy-daily-entry-secondary-indexes',
  stores: {
    dailyEntries: '++id, &[date+sectorId]',
  },
};

export default migration;
