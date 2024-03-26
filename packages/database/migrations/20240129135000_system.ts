import { COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.SYSTEM, undefined, (table) => {
    baseRecord(knex, table);
    table.double('tokenTradingFeePercentage');
    table.double('tokenPurchaseFeePercentage');
  });
}

export async function down(): Promise<void> {}
