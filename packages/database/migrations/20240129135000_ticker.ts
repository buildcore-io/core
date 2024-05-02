import { COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.TICKER, undefined, (t) => {
    baseRecord(knex, t);
    t.double('price');
  });
}

export async function down(): Promise<void> {}
