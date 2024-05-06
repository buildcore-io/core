import { COL, SUB_COL } from '@buildcore/interfaces';
import type { Knex } from 'knex';
import { baseRecord, baseSubCollection, createTable } from './20240129091246_common';

export async function up(knex: Knex): Promise<void> {
  await createTable(knex, COL.AWARD, undefined, (table) => {
    baseRecord(knex, table);

    table.text('name');
    table.text('description');
    table.string('space');
    table.timestamp('endDate');
    table.double('issued');
    table.double('badgesMinted');
    table.boolean('approved');
    table.boolean('rejected');
    table.boolean('completed');
    table.string('network');
    table.double('aliasStorageDeposit');
    table.double('collectionStorageDeposit');
    table.double('nttStorageDeposit');
    table.double('nativeTokenStorageDeposit');
    table.boolean('funded');
    table.string('fundingAddress');
    table.string('fundedBy');
    table.string('address');
    table.double('airdropClaimed');
    table.string('aliasBlockId');
    table.string('aliasId');
    table.string('collectionBlockId');
    table.string('collectionId');
    table.string('mediaStatus');
    table.double('mediaUploadErrorCount');
    table.boolean('isLegacy');
    table.text('badge_name');
    table.text('badge_description');
    table.double('badge_total');
    table.string('badge_type');
    table.double('badge_tokenReward');
    table.string('badge_tokenUid');
    table.string('badge_tokenId');
    table.string('badge_tokenSymbol');
    table.text('badge_image');
    table.string('badge_ipfsMedia');
    table.string('badge_ipfsMetadata');
    table.string('badge_ipfsRoot');
    table.double('badge_lockTime');
  });

  await createTable(knex, COL.AWARD, SUB_COL.OWNERS, (table) => {
    baseSubCollection(knex, table);
  });

  await createTable(knex, COL.AWARD, SUB_COL.PARTICIPANTS, (table) => {
    baseSubCollection(knex, table);
    table.text('comment');
    table.boolean('completed');
    table.double('count');
    table.double('tokenReward');
  });
}

export async function down(): Promise<void> {}
