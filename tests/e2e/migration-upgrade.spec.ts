import { expect, test, type Page } from '@playwright/test';

import { OPSNORMAL_LATEST_DB_SCHEMA_VERSION } from '../../src/db/migrations';
import type { DailyEntry } from '../../src/types';
import {
  DEXIE_VERSION_1_NATIVE_INDEXED_DB_VERSION,
  MIGRATION_V1_DUPLICATE_INSERT_ENTRY,
  MIGRATION_V1_EXPECTED_ENTRIES,
  MIGRATION_V1_INITIAL_INSERT_ENTRIES,
  MIGRATION_V1_OVERWRITE_ENTRY_UPDATED,
  normalizeMigrationEntries,
  REMOVED_LEGACY_SECONDARY_INDEX_NAMES,
} from '../helpers/dbMigrationFixture';

type BrowserMigrationSnapshot = {
  autoIncrement: boolean;
  entries: Array<
    Pick<DailyEntry, 'date' | 'sectorId' | 'status' | 'updatedAt'>
  >;
  indexNames: string[];
  keyPath: string | null;
  nativeVersion: number;
};

type DuplicateInsertResult = {
  errorName: string | null;
  succeeded: boolean;
};

async function deleteOpsNormalDatabase(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('opsnormal');

      request.onsuccess = () => resolve();
      request.onerror = () => {
        reject(
          request.error ?? new Error('Failed to delete OpsNormal database.'),
        );
      };
      request.onblocked = () => {
        reject(
          new Error(
            'Deleting the OpsNormal database was blocked by another open connection.',
          ),
        );
      };
    });
  });
}

async function seedLegacyVersion1Database(page: Page): Promise<void> {
  await deleteOpsNormalDatabase(page);

  await page.evaluate(
    async ({
      initialEntries,
      nativeVersion,
      overwriteEntry,
    }: {
      initialEntries: typeof MIGRATION_V1_INITIAL_INSERT_ENTRIES;
      nativeVersion: number;
      overwriteEntry: typeof MIGRATION_V1_OVERWRITE_ENTRY_UPDATED;
    }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('opsnormal', nativeVersion);

        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.createObjectStore('dailyEntries', {
            keyPath: 'id',
            autoIncrement: true,
          });

          store.createIndex('[date+sectorId]', ['date', 'sectorId'], {
            unique: true,
          });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('sectorId', 'sectorId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        };

        request.onerror = () => {
          reject(
            request.error ?? new Error('Failed to open the legacy database.'),
          );
        };

        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('dailyEntries', 'readwrite');
          const store = transaction.objectStore('dailyEntries');

          for (const entry of initialEntries) {
            store.add(entry);
          }

          transaction.oncomplete = () => {
            database.close();

            const updateRequest = indexedDB.open('opsnormal', nativeVersion);

            updateRequest.onerror = () => {
              reject(
                updateRequest.error ??
                  new Error('Failed to reopen the legacy database for update.'),
              );
            };

            updateRequest.onsuccess = () => {
              const reopenedDatabase = updateRequest.result;
              const updateTransaction = reopenedDatabase.transaction(
                'dailyEntries',
                'readwrite',
              );
              const updateStore = updateTransaction.objectStore('dailyEntries');
              const index = updateStore.index('[date+sectorId]');
              const getExistingRequest = index.get([
                overwriteEntry.date,
                overwriteEntry.sectorId,
              ]);

              getExistingRequest.onerror = () => {
                reopenedDatabase.close();
                reject(
                  getExistingRequest.error ??
                    new Error('Failed to read the legacy row before update.'),
                );
              };

              getExistingRequest.onsuccess = () => {
                const existingRow = getExistingRequest.result as
                  | { id?: number }
                  | undefined;

                if (typeof existingRow?.id !== 'number') {
                  reopenedDatabase.close();
                  reject(
                    new Error(
                      'Expected a seeded legacy row before applying the overwrite fixture.',
                    ),
                  );
                  return;
                }

                updateStore.put({
                  id: existingRow.id,
                  ...overwriteEntry,
                });
              };

              updateTransaction.oncomplete = () => {
                reopenedDatabase.close();
                resolve();
              };
              updateTransaction.onerror = () => {
                reopenedDatabase.close();
                reject(
                  updateTransaction.error ??
                    new Error('Failed to apply the legacy overwrite fixture.'),
                );
              };
              updateTransaction.onabort = () => {
                reopenedDatabase.close();
                reject(
                  updateTransaction.error ??
                    new Error('Legacy overwrite transaction aborted.'),
                );
              };
            };
          };

          transaction.onerror = () => {
            database.close();
            reject(
              transaction.error ??
                new Error('Failed to seed the legacy version 1 database.'),
            );
          };
          transaction.onabort = () => {
            database.close();
            reject(
              transaction.error ??
                new Error('Legacy version 1 seed transaction aborted.'),
            );
          };
        };
      });
    },
    {
      initialEntries: MIGRATION_V1_INITIAL_INSERT_ENTRIES,
      nativeVersion: DEXIE_VERSION_1_NATIVE_INDEXED_DB_VERSION,
      overwriteEntry: MIGRATION_V1_OVERWRITE_ENTRY_UPDATED,
    },
  );
}

async function readMigrationSnapshot(
  page: Page,
): Promise<BrowserMigrationSnapshot> {
  return await page.evaluate(async () => {
    return await new Promise<BrowserMigrationSnapshot>((resolve, reject) => {
      const request = indexedDB.open('opsnormal');

      request.onerror = () => {
        reject(
          request.error ?? new Error('Failed to open OpsNormal after upgrade.'),
        );
      };

      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('dailyEntries', 'readonly');
        const store = transaction.objectStore('dailyEntries');
        const getAllRequest = store.getAll();

        getAllRequest.onerror = () => {
          database.close();
          reject(
            getAllRequest.error ??
              new Error('Failed to read upgraded daily entries.'),
          );
        };

        getAllRequest.onsuccess = () => {
          const keyPath = Array.isArray(store.keyPath)
            ? JSON.stringify(store.keyPath)
            : store.keyPath;

          database.close();
          resolve({
            autoIncrement: store.autoIncrement,
            entries: (
              getAllRequest.result as Array<{
                date: string;
                sectorId: string;
                status: string;
                updatedAt: string;
              }>
            ).map(({ date, sectorId, status, updatedAt }) => ({
              date,
              sectorId: sectorId as DailyEntry['sectorId'],
              status: status as DailyEntry['status'],
              updatedAt,
            })),
            indexNames: Array.from(store.indexNames),
            keyPath,
            nativeVersion: database.version,
          });
        };
      };
    });
  });
}

async function attemptDuplicateInsert(
  page: Page,
): Promise<DuplicateInsertResult> {
  return await page.evaluate(async (duplicateEntry) => {
    return await new Promise<DuplicateInsertResult>((resolve, reject) => {
      const request = indexedDB.open('opsnormal');

      request.onerror = () => {
        reject(
          request.error ??
            new Error('Failed to reopen OpsNormal for duplicate insert test.'),
        );
      };

      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('dailyEntries', 'readwrite');
        const store = transaction.objectStore('dailyEntries');
        const addRequest = store.add(duplicateEntry);
        let errorName: string | null = null;

        addRequest.onerror = (event) => {
          event.preventDefault();
          errorName = addRequest.error?.name ?? null;
        };

        transaction.oncomplete = () => {
          database.close();
          resolve({
            errorName,
            succeeded: errorName === null,
          });
        };
        transaction.onerror = (event) => {
          event.preventDefault();
        };
        transaction.onabort = () => {
          database.close();
          resolve({
            errorName: errorName ?? transaction.error?.name ?? null,
            succeeded: false,
          });
        };
      };
    });
  }, MIGRATION_V1_DUPLICATE_INSERT_ENTRY);
}

test.describe('OpsNormal migration upgrade proof @migration-proof', () => {
  test('upgrades a seeded version 1 database without losing entries or uniqueness', async ({
    page,
  }) => {
    const blockApplicationScripts = (route: { abort: () => Promise<void> }) =>
      route.abort();

    await page.route('**/*.js', blockApplicationScripts);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedLegacyVersion1Database(page);
    await page.unroute('**/*.js', blockApplicationScripts);
    await page.close();

    const appPage = await page.context().newPage();
    await appPage.goto('/?migration-proof=1', { waitUntil: 'load' });
    await expect(
      appPage.getByRole('heading', { name: 'OpsNormal' }),
    ).toBeVisible();

    await expect
      .poll(async () => (await readMigrationSnapshot(appPage)).nativeVersion, {
        message:
          'Expected the real browser migration to finish before reading the upgraded schema.',
        timeout: 10000,
      })
      .toBe(OPSNORMAL_LATEST_DB_SCHEMA_VERSION * 10);

    const snapshot = await readMigrationSnapshot(appPage);
    const duplicateInsert = await attemptDuplicateInsert(appPage);

    expect(snapshot.nativeVersion).toBe(
      OPSNORMAL_LATEST_DB_SCHEMA_VERSION * 10,
    );
    expect(normalizeMigrationEntries(snapshot.entries)).toEqual(
      MIGRATION_V1_EXPECTED_ENTRIES,
    );
    expect(snapshot.indexNames).toEqual(['[date+sectorId]']);
    expect(snapshot.keyPath).toBe('id');
    expect(snapshot.autoIncrement).toBe(true);

    for (const removedIndexName of REMOVED_LEGACY_SECONDARY_INDEX_NAMES) {
      expect(snapshot.indexNames).not.toContain(removedIndexName);
    }

    expect(duplicateInsert).toEqual({
      errorName: 'ConstraintError',
      succeeded: false,
    });

    await appPage.close();
  });
});
