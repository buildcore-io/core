import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.SWAP, undefined, (t) => {
    baseRecord(knex, t);

    t.string('recipient');
    t.string('network');
    t.string('address');
    t.string('orderId');
    t.specificType('nftIdsAsk', 'TEXT[]');
    t.double('baseTokenAmountAsk');
    t.jsonb('nativeTokensAsk').defaultTo('[]');
    t.string('status');

    t.jsonb('bidOutputs').defaultTo('[]');
    t.jsonb('askOutputs').defaultTo('[]');
  });
}

export async function down(): Promise<void> {}
