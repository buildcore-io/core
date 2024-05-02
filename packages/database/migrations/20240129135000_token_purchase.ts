import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.TOKEN_PURCHASE, undefined, (t) => {
    baseRecord(knex, t);

    t.string('token');
    t.string('tokenStatus');
    t.string('sell');
    t.string('buy');
    t.double('count');
    t.double('price');
    t.string('triggeredBy');
    t.string('billPaymentId');
    t.string('buyerBillPaymentId');
    t.specificType('royaltyBillPayments', 'TEXT[]');
    t.string('sourceNetwork');
    t.string('targetNetwork');
    t.double('sellerTokenTradingFeePercentage');
    t.double('sellerTier');

    t.boolean('in24h').defaultTo(false);
    t.boolean('in48h').defaultTo(false);
    t.boolean('in7d').defaultTo(false);
  });
}

export async function down(): Promise<void> {}
