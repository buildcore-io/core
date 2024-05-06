import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.STAKE_REWARD, undefined, (t) => {
    baseRecord(knex, t);

    t.timestamp('startDate');
    t.timestamp('endDate');
    t.timestamp('tokenVestingDate');
    t.double('tokensToDistribute');
    t.string('token');
    t.double('totalStaked');
    t.double('totalAirdropped');
    t.string('status');
  });
}

export async function down(): Promise<void> {}
