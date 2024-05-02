import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.MEMBER, undefined, (table) => {
    baseRecord(knex, table);
    table.string('nonce');
    table.string('name');
    table.text('about');
    table.string('avatarNft');
    table.text('avatar');
    table.text('discord');
    table.text('twitter');
    table.text('github');

    table.string('smrAddress').defaultTo('');
    table.string('rmsAddress').defaultTo('');
    table.string('iotaAddress').defaultTo('');
    table.string('atoiAddress').defaultTo('');

    table.specificType('prevValidatedAddresses', 'TEXT[]').defaultTo('{}');
    table.double('tokenTradingFeePercentage');
    table.double('tokenPurchaseFeePercentage');
    table.double('awardsCompleted');

    table.jsonb('spaces').defaultTo({});
  });
}

export async function down(): Promise<void> {}
