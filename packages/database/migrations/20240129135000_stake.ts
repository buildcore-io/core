import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.STAKE, undefined, (table) => {
    baseRecord(knex, table);
    table.string('member');
    table.string('space');
    table.string('token');
    table.double('amount');
    table.double('value');
    table.double('weeks');

    table.timestamp('expiresAt');
    table.boolean('expirationProcessed');

    table.string('orderId');
    table.string('billPaymentId');
    table.string('type');
    table.jsonb('customMetadata').defaultTo({});
  });
}

export async function down(): Promise<void> {}
