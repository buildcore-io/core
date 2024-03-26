import { COL, SUB_COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  for (const col of [COL.MILESTONE, COL.MILESTONE_SMR, COL.MILESTONE_RMS]) {
    await createTable(knex, col, undefined, (t) => {
      baseRecord(knex, t);

      t.boolean('completed');
      t.timestamp('completedOn');

      t.string('listenerNodeId');

      t.integer('milestone');
      t.timestamp('milestoneTimestamp');

      t.integer('trxConflictCount');
      t.integer('trxFailedCount');
      t.integer('trxValidCount');
    });

    await createTable(knex, col, SUB_COL.TRANSACTIONS, (t) => {
      baseSubCollection(knex, t);
      t.integer('PayloadSize');
      t.text('blockId');
      t.integer('milestone');
      t.jsonb('payload').defaultTo({});
      t.boolean('processed').defaultTo(false);
      t.timestamp('processedOn');
    });
  }
}

export async function down(): Promise<void> {}
