import { COL, SUB_COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.PROPOSAL, SUB_COL.MEMBERS, (t) => {
    baseSubCollection(knex, t);
    t.boolean('voted');
    t.double('weight');
    t.string('tranId');
    t.jsonb('values').defaultTo({});
  });

  await createTable(knex, COL.PROPOSAL, SUB_COL.OWNERS, (t) => {
    baseSubCollection(knex, t);
  });

  await createTable(knex, COL.PROPOSAL, undefined, (t) => {
    baseRecord(knex, t);
    t.string('space');
    t.text('name');
    t.text('description');
    t.text('additionalInfo');
    t.integer('type');
    t.boolean('approved');
    t.boolean('rejected');
    t.string('approvedBy');
    t.string('rejectedBy');
    t.string('eventId');
    t.double('totalWeight');
    t.string('token');
    t.boolean('completed');
    t.double('rank');

    t.timestamp('settings_startDate');
    t.timestamp('settings_endDate');
    t.boolean('settings_guardiansOnly');
    t.string('settings_addRemoveGuardian');
    t.jsonb('settings_spaceUpdateData').defaultTo({});
    t.boolean('settings_onlyGuardians');
    t.specificType('settings_stakeRewardIds', 'TEXT[]').defaultTo('{}');

    t.specificType('settings_awards', 'TEXT[]').defaultTo('{}');

    t.jsonb('questions').defaultTo([]);
    t.jsonb('members').defaultTo([]);

    t.jsonb('results').defaultTo({});
  });
}

export async function down(): Promise<void> {}
