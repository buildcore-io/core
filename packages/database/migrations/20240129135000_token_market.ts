import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.TOKEN_MARKET, undefined, (t) => {
    baseRecord(knex, t);

    t.string('owner');
    t.string('token');
    t.string('tokenStatus');
    t.string('type');
    t.double('count');
    t.double('price');
    t.double('totalDeposit');
    t.double('balance');
    t.double('fulfilled');
    t.string('status');
    t.string('orderTransactionId');
    t.string('paymentTransactionId');
    t.string('creditTransactionId');
    t.timestamp('expiresAt');
    t.boolean('shouldRetry');
    t.string('sourceNetwork');
    t.string('targetNetwork');
    t.string('targetAddress');
  });
}

export async function down(): Promise<void> {}
