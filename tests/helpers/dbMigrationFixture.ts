import type { DailyEntry } from '../../src/types';

export const DEXIE_VERSION_1_NATIVE_INDEXED_DB_VERSION = 10;
export const LEGACY_DAILY_ENTRIES_STORE =
  '++id, &[date+sectorId], date, sectorId, updatedAt';
export const CURRENT_DAILY_ENTRIES_STORE = '++id, &[date+sectorId]';
export const REMOVED_LEGACY_SECONDARY_INDEX_NAMES = [
  'date',
  'sectorId',
  'updatedAt',
] as const;

export type MigrationFixtureEntry = Readonly<Omit<Required<DailyEntry>, 'id'>>;

type SeedableDailyEntriesStore = {
  add: (entry: MigrationFixtureEntry) => PromiseLike<unknown>;
  put: (entry: Required<DailyEntry>) => PromiseLike<unknown>;
};

export interface SeedableLegacyDailyEntriesDatabase {
  dailyEntries: SeedableDailyEntriesStore;
}

const FIXTURE_BASE_ENTRIES: readonly MigrationFixtureEntry[] = [
  {
    date: '2026-03-01',
    sectorId: 'work-school',
    status: 'nominal',
    updatedAt: '2026-03-01T08:00:00.000Z',
  },
  {
    date: '2026-03-15',
    sectorId: 'household',
    status: 'degraded',
    updatedAt: '2026-03-15T08:05:00.000Z',
  },
  {
    date: '2026-03-30',
    sectorId: 'relationships',
    status: 'nominal',
    updatedAt: '2026-03-30T08:10:00.000Z',
  },
  {
    date: '2028-02-29',
    sectorId: 'body',
    status: 'degraded',
    updatedAt: '2028-02-29T08:15:00.000Z',
  },
] as const;

export const MIGRATION_V1_OVERWRITE_ENTRY_INITIAL: MigrationFixtureEntry = {
  date: '2028-03-01',
  sectorId: 'rest',
  status: 'nominal',
  updatedAt: '2028-03-01T09:00:00.000Z',
};

export const MIGRATION_V1_OVERWRITE_ENTRY_UPDATED: MigrationFixtureEntry = {
  date: '2028-03-01',
  sectorId: 'rest',
  status: 'degraded',
  updatedAt: '2028-03-01T10:00:00.000Z',
};

export const MIGRATION_V1_INITIAL_INSERT_ENTRIES: readonly MigrationFixtureEntry[] =
  [...FIXTURE_BASE_ENTRIES, MIGRATION_V1_OVERWRITE_ENTRY_INITIAL] as const;

export const MIGRATION_V1_EXPECTED_ENTRIES: readonly MigrationFixtureEntry[] =
  Object.freeze(
    normalizeMigrationEntries([
      ...FIXTURE_BASE_ENTRIES,
      MIGRATION_V1_OVERWRITE_ENTRY_UPDATED,
    ]),
  );

export const MIGRATION_V1_DUPLICATE_INSERT_ENTRY: MigrationFixtureEntry = {
  date: MIGRATION_V1_OVERWRITE_ENTRY_UPDATED.date,
  sectorId: MIGRATION_V1_OVERWRITE_ENTRY_UPDATED.sectorId,
  status: 'nominal',
  updatedAt: '2028-03-01T10:30:00.000Z',
};

export function compoundKeyForEntry(
  entry: Pick<MigrationFixtureEntry, 'date' | 'sectorId'>,
): string {
  return `${entry.date}:${entry.sectorId}`;
}

export function normalizeMigrationEntries(
  entries: ReadonlyArray<
    Pick<DailyEntry, 'date' | 'sectorId' | 'status' | 'updatedAt'>
  >,
): MigrationFixtureEntry[] {
  return [...entries]
    .map(({ date, sectorId, status, updatedAt }) => ({
      date,
      sectorId,
      status,
      updatedAt,
    }))
    .sort((left, right) =>
      compoundKeyForEntry(left).localeCompare(compoundKeyForEntry(right)),
    );
}

function coerceAutoIncrementKey(key: unknown): number {
  if (typeof key === 'number' && Number.isFinite(key)) {
    return key;
  }

  if (typeof key === 'string') {
    const parsed = Number(key);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(
    `Expected Dexie to return a numeric auto-increment key. Received ${String(key)}.`,
  );
}

export async function seedV1Entries(
  database: SeedableLegacyDailyEntriesDatabase,
): Promise<void> {
  for (const entry of FIXTURE_BASE_ENTRIES) {
    await database.dailyEntries.add(entry);
  }

  const insertedId = coerceAutoIncrementKey(
    await database.dailyEntries.add(MIGRATION_V1_OVERWRITE_ENTRY_INITIAL),
  );

  await database.dailyEntries.put({
    id: insertedId,
    ...MIGRATION_V1_OVERWRITE_ENTRY_UPDATED,
  });
}
