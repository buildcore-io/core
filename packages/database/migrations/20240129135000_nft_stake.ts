import { COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.NFT_STAKE, undefined, (table) => {
    baseRecord(knex, table);
    table.string('member');
    table.string('space');
    table.string('collection');
    table.string('nft');
    table.double('weeks');
    table.timestamp('expiresAt');
    table.boolean('expirationProcessed');
    table.string('type');
  });
}

export async function down(): Promise<void> {}
