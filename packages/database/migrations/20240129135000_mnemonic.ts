import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.MNEMONIC, undefined, (table) => {
    baseRecord(knex, table);
    table.text('mnemonic');
    table.string('network');
    table.string('lockedBy').defaultTo('');
    table.specificType('consumedOutputIds', 'TEXT[]').defaultTo('{}');
    table.specificType('consumedNftOutputIds', 'TEXT[]').defaultTo('{}');
    table.specificType('consumedAliasOutputIds', 'TEXT[]').defaultTo('{}');
  });
}

export async function down(): Promise<void> {}
