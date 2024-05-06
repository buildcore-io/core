import { COL, SUB_COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.PROJECT, undefined, (table) => {
    baseRecord(knex, table);

    table.text('name');
    table.text('contactEmail');
    table.boolean('deactivated');
    table.string('config_billing');
    table.specificType('config_tiers', 'FLOAT[]');
    table.specificType('config_tokenTradingFeeDiscountPercentage', 'FLOAT[]');
    table.string('config_nativeTokenSymbol');
    table.string('config_nativeTokenUid');
    table.jsonb('otr').defaultTo({});
  });

  await createTable(knex, COL.PROJECT, SUB_COL.ADMINS, (table) => {
    baseSubCollection(knex, table);
  });

  await createTable(knex, COL.PROJECT, SUB_COL._API_KEY, (table) => {
    baseSubCollection(knex, table);
    table.text('token');
  });
}

export async function down(): Promise<void> {}
