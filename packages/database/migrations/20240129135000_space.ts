import { COL, SUB_COL } from '@build-5/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.SPACE, undefined, (table) => {
    baseRecord(knex, table);
    table.string('name');
    table.text('about');
    table.boolean('open');
    table.boolean('tokenBased');
    table.double('minStakedValue');
    table.text('github');
    table.text('twitter');
    table.text('discord');
    table.text('avatarUrl');
    table.text('bannerUrl');
    table.double('totalGuardians');
    table.double('totalMembers');
    table.double('totalPendingMembers');

    table.string('smrAddress').defaultTo('');
    table.string('rmsAddress').defaultTo('');
    table.string('iotaAddress').defaultTo('');
    table.string('atoiAddress').defaultTo('');

    table.specificType('prevValidatedAddresses', 'TEXT[]').defaultTo('{}');
    table.string('vaultAddress');
    table.string('collectionId');
    table.boolean('claimed');
    table.string('ipfsMedia');
    table.string('ipfsMetadata');
    table.string('ipfsRoot');
    table.string('mediaStatus');
    table.double('mediaUploadErrorCount');
    table.string('alias_address');
    table.string('alias_aliasId');
    table.string('alias_blockId');
    table.timestamp('alias_mintedOn');
    table.string('alias_mintedBy');
  });

  await createTable(knex, COL.SPACE, SUB_COL.GUARDIANS, (table) => {
    baseSubCollection(knex, table);
  });

  await createTable(knex, COL.SPACE, SUB_COL.MEMBERS, (table) => {
    baseSubCollection(knex, table);
  });

  await createTable(knex, COL.SPACE, SUB_COL.BLOCKED_MEMBERS, (table) => {
    baseSubCollection(knex, table);
  });

  await createTable(knex, COL.SPACE, SUB_COL.KNOCKING_MEMBERS, (table) => {
    baseSubCollection(knex, table);
  });
}

export async function down(): Promise<void> {}
