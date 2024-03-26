import { COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.SOON_SNAP, undefined, (t) => {
    baseRecord(knex, t);
    t.double('count');
    t.double('paidOut');
    t.timestamp('lastPaidOutOn');
    t.string('ethAddress');
    t.boolean('ethAddressVerified');
  });
}

export async function down(): Promise<void> {}
