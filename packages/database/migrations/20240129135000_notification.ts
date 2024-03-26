import { COL } from '@build-5/interfaces';
import { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.NOTIFICATION, undefined, (table) => {
    baseRecord(knex, table);

    table.string('space');
    table.string('member');
    table.string('type');
    table.jsonb('params').defaultTo({});
  });
}

export async function down(_knex: Knex): Promise<void> {}
