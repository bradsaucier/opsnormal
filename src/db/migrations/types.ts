import type { Transaction } from 'dexie';

export type OpsNormalDbStores = Record<string, string | null>;
export type OpsNormalDbMigrationUpgrade = (
  transaction: Transaction,
) => PromiseLike<void> | void;

export interface OpsNormalDbMigration {
  version: number;
  name: string;
  stores: OpsNormalDbStores;
  upgrade?: OpsNormalDbMigrationUpgrade;
}
